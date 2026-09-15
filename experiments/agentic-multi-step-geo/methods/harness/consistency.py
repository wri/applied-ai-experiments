"""Measure agreement across repeated sessions on the stage-7 workflow artifact.

Consistency is not accuracy. Ten sessions can agree perfectly and all be wrong,
so every cross-run metric here is also computed against the oracle. The report
shows both side by side: consistency@N next to accuracy@N.

Each session writes answers/workflow.csv — one row per cadaster it flagged
non-compliant on an EUDR-relevant crop. Because the flagged SET is
agent-determined (it inherits the stage-4 scope classification), set-level
agreement measures whether models agree on who is in scope at all, not merely on
the arithmetic.

Usage:
    python harness/consistency.py --model sonnet
"""

from __future__ import annotations

import argparse
import csv
import itertools
import json
import statistics
from collections import Counter
from pathlib import Path

from layout import is_scored, read_meta, run_dirs

REPO_ROOT = Path(__file__).resolve().parent.parent


def load_artifact(path: Path) -> dict:
    """Read one session's workflow.csv into {cod_imovel: row}."""
    if not path.exists():
        return {}
    with open(path, newline="", encoding="utf-8") as fh:
        rows = list(csv.DictReader(fh))
    out: dict = {}
    for row in rows:
        key = (row.get("cod_imovel") or "").strip()
        if not key:
            continue
        try:
            loss = float(row.get("post2020_loss_ha", "") or 0)
        except ValueError:
            loss = 0.0
        out[key] = {
            "post2020_loss_ha": loss,
            "top_contact_entity_id": (row.get("top_contact_entity_id") or "").strip(),
        }
    return out


def _jaccard(a: set, b: set) -> float:
    if not a and not b:
        return 1.0
    return len(a & b) / len(a | b)


def _kendall_tau(x: list, y: list):
    """Kendall tau-b over paired rankings. None when fewer than two pairs."""
    n = len(x)
    if n < 2:
        return None
    concordant = discordant = tx = ty = 0
    for i, j in itertools.combinations(range(n), 2):
        dx, dy = x[i] - x[j], y[i] - y[j]
        if dx == 0 and dy == 0:
            tx += 1
            ty += 1
        elif dx == 0:
            tx += 1
        elif dy == 0:
            ty += 1
        elif (dx > 0) == (dy > 0):
            concordant += 1
        else:
            discordant += 1
    total = concordant + discordant
    denom = ((total + tx) * (total + ty)) ** 0.5
    return (concordant - discordant) / denom if denom else None


def _fleiss_kappa(assignments: list):
    """Fleiss' kappa over per-cadaster contact choices across runs.

    assignments is a list of per-cadaster rows, each a list of the entity ids
    the N runs chose for that cadaster.
    """
    if not assignments:
        return None
    n_raters = len(assignments[0])
    if n_raters < 2:
        return None
    categories = sorted({c for row in assignments for c in row})
    if len(categories) < 2:
        return 1.0
    p_i = []
    col_totals: Counter = Counter()
    for row in assignments:
        counts = Counter(row)
        col_totals.update(counts)
        agree = sum(v * (v - 1) for v in counts.values())
        p_i.append(agree / (n_raters * (n_raters - 1)))
    p_bar = statistics.mean(p_i)
    total = len(assignments) * n_raters
    p_e = sum((col_totals[c] / total) ** 2 for c in categories)
    return (p_bar - p_e) / (1 - p_e) if p_e < 1 else 1.0


def _pairwise_flag_jaccard(runs: list) -> float:
    sets = [set(r) for r in runs]
    pairs = list(itertools.combinations(sets, 2))
    if not pairs:
        return 1.0
    return statistics.mean(_jaccard(a, b) for a, b in pairs)


def compare_runs(runs: list, oracle: dict | None) -> dict:
    """Cross-run agreement on the workflow artifact, plus oracle deviation.

    runs: list of {cod_imovel: row} dicts, one per session.
    oracle: the same shape from the golden workflow.csv, or None.
    """
    universe = sorted({k for r in runs for k in r})
    n = len(runs)

    # Cadasters flagged by some runs but not all — where models disagree about
    # who is in scope, the sharpest output of this stage.
    unstable = [k for k in universe
                if 0 < sum(1 for r in runs if k in r) < n]

    # Cadasters every run flagged, for the metrics that need aligned rows.
    shared = [k for k in universe if all(k in r for r in runs)]

    taus = []
    if len(shared) >= 2:
        for a, b in itertools.combinations(runs, 2):
            tau = _kendall_tau([a[k]["post2020_loss_ha"] for k in shared],
                               [b[k]["post2020_loss_ha"] for k in shared])
            if tau is not None:
                taus.append(tau)

    agreements = []
    assignments = []
    for k in shared:
        choices = [r[k]["top_contact_entity_id"] for r in runs]
        assignments.append(choices)
        modal = Counter(choices).most_common(1)[0][1]
        agreements.append(modal / n)

    cvs = {}
    for k in shared:
        values = [r[k]["post2020_loss_ha"] for r in runs]
        mean = statistics.mean(values)
        if mean:
            cvs[k] = statistics.pstdev(values) / mean

    result = {
        "n_runs": n,
        "flag_jaccard": _pairwise_flag_jaccard(runs),
        "unstable_cadasters": unstable,
        "ranking_tau": statistics.mean(taus) if taus else None,
        "contact_agreement": statistics.mean(agreements) if agreements else None,
        "contact_kappa": _fleiss_kappa(assignments),
        "loss_cv": cvs,
        "oracle": None,
    }

    if oracle is not None:
        oracle_flags = set(oracle)
        result["oracle"] = {
            "flag_jaccard": statistics.mean(
                _jaccard(set(r), oracle_flags) for r in runs),
            "contact_agreement": (statistics.mean(
                statistics.mean(
                    1.0 if r.get(k, {}).get("top_contact_entity_id")
                    == oracle[k]["top_contact_entity_id"] else 0.0
                    for k in oracle) for r in runs) if oracle else None),
        }
    return result


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--model", default="sonnet")
    ap.add_argument("--results", type=Path, default=REPO_ROOT / "results")
    ap.add_argument("--oracle", type=Path,
                    default=REPO_ROOT / "fixtures/golden/workflow.csv")
    args = ap.parse_args()

    runs = [load_artifact(d / "answers" / "workflow.csv")
            for d in run_dirs(args.results, args.model)
            if is_scored(read_meta(d))]
    runs = [r for r in runs if r]
    if not runs:
        print(f"no workflow artifacts under {args.results / args.model}")
        return 1

    oracle = load_artifact(args.oracle) or None
    out = compare_runs(runs, oracle)
    dest = args.results / "consistency.json"
    dest.write_text(json.dumps(out, indent=2, sort_keys=True) + "\n",
                    encoding="utf-8")

    fj = out["flag_jaccard"]
    ca = out["contact_agreement"]
    line = f"consistency@{out['n_runs']}: flags {fj:.3f}"
    if ca is not None:
        line += f", contacts {ca:.3f}"
    if out["oracle"] is not None:
        line += f"  |  vs oracle: flags {out['oracle']['flag_jaccard']:.3f}"
    print(line)
    print(f"wrote {dest}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
