"""Run the benchmark against several specs, and compare what breaks.

An arm is a spec with something taken out of it (see fixtures/ablations.yaml).
A sweep runs each arm the same number of times and reports the difference, so
"how much is COOPS.md worth" becomes a number rather than an opinion.

Two decisions in here are worth knowing about.

**Arms interleave rather than run in blocks.** run.py samples source.coop
throughput at both ends of every session because it varies by an order of
magnitude with the network route. Running every baseline pass in the first
hour and every ablated pass in the second would confound the arm with the
route perfectly, and no later analysis separates them. Interleaving turns that
drift into within-arm variance, which the range column already shows. It also
means a sweep stopped halfway leaves every arm with the same number of passes,
which is still analysable.

**The report never averages two different specs together.** Runs are grouped
on (arm, spec fingerprint), so editing a policy mid-sweep splits the arm in
two and says so, rather than quietly reporting the mean of two experiments.

Usage:
    python harness/sweep.py --model opus --passes 3 --dry-run
    python harness/sweep.py --model opus --passes 3
    python harness/sweep.py --report
"""

from __future__ import annotations

import argparse
import json
import statistics
import subprocess
import sys
import tempfile
import traceback
from pathlib import Path

import ablation
import run as runner
from grade import load_questions, stage_summary
from layout import group_by_arm, is_scored, read_meta, regraded, run_dirs

REPO_ROOT = Path(__file__).resolve().parent.parent
RESULTS = REPO_ROOT / "results"
QUESTIONS = REPO_ROOT / "fixtures" / "questions.yaml"
REPORT = RESULTS / "ablations.md"


# --- running -----------------------------------------------------------------

def plan(config: dict, arms: list[str], passes: int, order: str) -> list[tuple[int, str]]:
    """The (pass, arm) sequence a sweep will execute, in order."""
    names = arms or list(config["arms"])
    if order == "blocked":
        return [(p, a) for a in names for p in range(passes)]
    return [(p, a) for p in range(passes) for a in names]


def describe(config: dict, receipts: dict, arms: list[str], passes: int,
             model: str) -> list[str]:
    """The pre-flight summary: what each arm removes, and what it will cost."""
    names = arms or list(config["arms"])
    lines = [f"sweep: {model} x {len(names)} arms x {passes} passes "
             f"= {len(names) * passes} sessions", ""]
    for name in names:
        receipt = receipts[name]
        if not receipt:
            lines.append(f"  {name:<14} no operations")
            continue
        for i, (path, removed) in enumerate(sorted(receipt.items())):
            head = name if i == 0 else ""
            lines.append(f"  {head:<14} -{removed:>4} lines  {path}")
    return lines


def sweep(model: str, config: dict, arms: list[str], passes: int, order: str,
          **session_kwargs) -> dict[str, int]:
    """Run every (pass, arm) in order, surviving a session that fails.

    A sweep is hours long. One container dying in hour three must not throw
    away the two hours before it, so a failure is printed, counted, and
    stepped over.
    """
    failures: dict[str, int] = {}
    steps = plan(config, arms, passes, order)
    for i, (p, arm) in enumerate(steps, start=1):
        print(f"[sweep {i}/{len(steps)}] pass {p + 1}, arm {arm}", flush=True)
        try:
            runner.run_session(model, False, arm=arm, **session_kwargs)
        except Exception:                      # noqa: BLE001 - keep sweeping
            failures[arm] = failures.get(arm, 0) + 1
            print(f"[sweep] arm {arm} pass {p + 1} failed:", file=sys.stderr)
            traceback.print_exc()
    return failures


# --- reporting ---------------------------------------------------------------

def arm_rows(results_dir: Path, model: str, questions: list) -> tuple[list, list]:
    """One row per (arm, spec), plus the runs excluded and why."""
    rows, excluded = [], []
    groups = group_by_arm(run_dirs(results_dir, model))
    # Runs predating the ablation harness carry no fingerprint, so a results
    # directory holding both sorts a str against None unless the key says
    # otherwise. Every real tree has both for as long as the old runs are kept.
    for (arm, spec), dirs in sorted(groups.items(), key=lambda kv: (kv[0][0], kv[0][1] or "")):
        kept, grades = [], []
        for run_dir in dirs:
            meta = read_meta(run_dir)
            if not is_scored(meta):
                excluded.append((run_dir, meta.get("status", "unknown")))
                continue
            if regraded(meta):
                # Scored against goldens it never saw. That is a fact about
                # the fixtures, not about the withheld text.
                excluded.append((run_dir, "regraded"))
                continue
            graded = run_dir / "grades.json"
            if not graded.exists():
                excluded.append((run_dir, "not graded"))
                continue
            grades.append(json.loads(graded.read_text(encoding="utf-8")))
            kept.append(run_dir)
        if not kept:
            continue
        accs = [sum(1 for v in g.values() if v == "correct") / len(g)
                for g in grades if g]
        rows.append({
            "arm": arm,
            "spec": (spec or "-")[:4],
            "runs": len(kept),
            "mean": statistics.fmean(accs) if accs else None,
            "lo": min(accs) if accs else None,
            "hi": max(accs) if accs else None,
            "stages": [stage_summary(g, questions) for g in grades],
            "why": read_meta(kept[0]).get("ablation", {}).get("why", ""),
            "grades": grades,
        })
    return rows, excluded


def _pct(x) -> str:
    return "  -  " if x is None else f"{x * 100:4.0f}%"


def arm_table(rows: list) -> list[str]:
    """The headline table: accuracy and per-stage scores, one row per arm."""
    stages = sorted({s for r in rows for st in r["stages"] for s in st})
    head = (f"{'arm':<14} {'spec':<5} {'runs':>4} {'mean':>6} {'range':>11}  "
            + "  ".join(f"S{s}" .rjust(9) for s in stages))
    out = [head, "-" * len(head)]
    for r in rows:
        cells = []
        for s in stages:
            raws = [st[s]["raw"] for st in r["stages"] if s in st]
            conds = [st[s]["conditional"] for st in r["stages"] if s in st]
            raws = [v for v in raws if v is not None]
            conds = [v for v in conds if v is not None]
            raw = f"{statistics.fmean(raws) * 100:3.0f}" if raws else "  -"
            cond = f"{statistics.fmean(conds) * 100:3.0f}" if conds else "  -"
            cells.append(f"{raw}/{cond}".rjust(9))
        span = ("     -     " if r["lo"] is None
                else f"{r['lo'] * 100:3.0f}-{r['hi'] * 100:<3.0f}".rjust(11))
        out.append(f"{r['arm']:<14} {r['spec']:<5} {r['runs']:>4} "
                   f"{_pct(r['mean']):>6} {span}  " + "  ".join(cells))
    return out


def question_table(rows: list, baseline: str, questions: list) -> list[str]:
    """Per-question pass rate, which is where a bimodal result actually shows.

    Scores are bimodal because the questions are staged: one early error
    cascades into everything downstream, so a mean total mixes "got the
    concept wrong" with "tripped at question nine". A per-question rate does
    not. Questions every arm agrees on are dropped, so the few that carry the
    result are not buried under thirty identical lines.
    """
    # Prefer a baseline that carries a fingerprint. Runs predating the harness
    # group under the same name but cannot say what spec they saw, and in a
    # real tree they span several -- three runs there covered two task briefs
    # and two tie-break rules. Comparing an arm against that average measures
    # the repository's history rather than the withheld text.
    candidates = [r for r in rows if r["arm"] == baseline]
    base = next((r for r in candidates if r["spec"] != "-"), None) or \
        next(iter(candidates), None)
    if base is None:
        return ["", f"(no runs for the baseline arm {baseline!r}, so no deltas)"]

    stage_of = {f"q{q['id']}": q.get("stage", "") for q in questions}
    qids = sorted({q for r in rows for g in r["grades"] for q in g})

    def rate(row, qid):
        seen = [g for g in row["grades"] if qid in g]
        if not seen:
            return None
        return sum(1 for g in seen if g[qid] == "correct") / len(seen)

    others = [r for r in rows if r is not base]
    head = f"{'Q':<5}{'st':>3}  {baseline + ' ' + base['spec']:>12}"
    for r in others:
        head += f"  {r['arm'] + ' ' + r['spec']:>19}{'d':>6}"
    out, hidden = [head, "-" * len(head)], 0
    for qid in qids:
        b = rate(base, qid)
        cells, moved = [], False
        for r in others:
            v = rate(r, qid)
            if v is None or b is None:
                cells.append(f"  {'-':>19}{'-':>6}")
                continue
            delta = (v - b) * 100
            moved = moved or abs(delta) >= 1
            cells.append(f"  {v * 100:18.0f}%{delta:>6.0f}")
        if not moved:
            hidden += 1
            continue
        out.append(f"{qid:<5}{stage_of.get(qid, ''):>3}  "
                   f"{'-' if b is None else format(b * 100, '11.0f') + '%':>12}"
                   + "".join(cells))
    if hidden:
        out.append(f"({hidden} questions scored the same in every arm, hidden)")
    return out


def report(results_dir: Path, questions_path: Path, config: dict | None) -> list[str]:
    questions = load_questions(questions_path)
    baseline = (config or {}).get("baseline", "full")
    out: list[str] = []
    models = sorted({d.parent.name for d in run_dirs(results_dir)})
    for model in models:
        rows, excluded = arm_rows(results_dir, model, questions)
        if len(rows) < 2:
            continue
        out += [f"Ablation arms - {model}", ""]
        out += arm_table(rows)
        out += ["", f"Per-question pass rate - {model}", ""]
        out += question_table(rows, baseline, questions)
        seen: dict[str, list[str]] = {}
        for r in rows:
            seen.setdefault(r["arm"], []).append(r["spec"])
        for arm, specs in seen.items():
            if len(specs) > 1:
                out += ["", f"! arm {arm} saw {len(specs)} different specs "
                            f"({', '.join(specs)}); they are reported "
                            f"separately, never pooled"]
        for run_dir, why in excluded:
            out.append(f"! excluded {run_dir.parent.name}/{run_dir.name}: {why}")
        for r in rows:
            if r["why"]:
                out += ["", f"{r['arm']}: {' '.join(r['why'].split())}"]
        out.append("")
    return out or ["no model has runs for more than one arm yet"]


# --- cli ---------------------------------------------------------------------

def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--model", choices=sorted(runner.PRICES))
    ap.add_argument("--passes", type=int, default=3,
                    help="passes per arm (default 3)")
    ap.add_argument("--arms", default="",
                    help="comma-separated subset; default is every arm")
    ap.add_argument("--ablations", type=Path, default=runner.ABLATIONS)
    ap.add_argument("--input-mode", choices=sorted(runner.INPUT_FILES),
                    default="csv")
    ap.add_argument("--label", default="")
    ap.add_argument("--max-attempts", type=int, default=runner.MAX_ATTEMPTS)
    ap.add_argument("--order", choices=("interleaved", "blocked"),
                    default="interleaved",
                    help="interleaved keeps network drift inside an arm "
                         "rather than between arms; blocked is for debugging")
    ap.add_argument("--results", type=Path, default=RESULTS)
    ap.add_argument("--questions", type=Path, default=QUESTIONS)
    ap.add_argument("--dry-run", action="store_true",
                    help="validate every arm, print what it removes, run nothing")
    ap.add_argument("--report", action="store_true",
                    help="compare the runs already on disk and exit")
    args = ap.parse_args()

    try:
        config = ablation.load_arms(args.ablations)
    except ablation.AblationError as exc:
        print(f"ablation: {exc}", file=sys.stderr)
        return 2

    if args.report:
        lines = report(args.results, args.questions, config)
        print("\n".join(lines))
        args.results.mkdir(parents=True, exist_ok=True)
        REPORT.write_text("\n".join(lines) + "\n", encoding="utf-8")
        print(f"wrote {REPORT}")
        return 0

    if not args.model:
        ap.error("--model is required unless --report is given")
    arms = [a for a in args.arms.split(",") if a]
    unknown = [a for a in arms if a not in config["arms"]]
    if unknown:
        print(f"ablation: unknown arms {unknown}, expected some of "
              f"{sorted(config['arms'])}", file=sys.stderr)
        return 2

    # Validate every arm before the first container, so a heading that has
    # been reworded since the arm was written costs a second, not four hours.
    with tempfile.TemporaryDirectory(prefix="ablation-check-") as tmp:
        try:
            receipts = ablation.validate_arms(config, REPO_ROOT, Path(tmp))
        except ablation.AblationError as exc:
            print(f"ablation: {exc}", file=sys.stderr)
            return 2
        print("\n".join(describe(config, receipts, arms, args.passes, args.model)))

    if args.dry_run:
        return 0

    failures = sweep(args.model, config, arms, args.passes, args.order,
                     input_mode=args.input_mode, label=args.label,
                     max_attempts=args.max_attempts, ablations=args.ablations)
    if failures:
        print(f"[sweep] failed sessions by arm: {failures}", file=sys.stderr)

    subprocess.run([sys.executable, str(Path(__file__).parent / "grade.py")],
                   cwd=REPO_ROOT, check=False)
    print("\n".join(report(args.results, args.questions, config)))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
