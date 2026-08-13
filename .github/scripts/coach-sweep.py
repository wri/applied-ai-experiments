#!/usr/bin/env python3
"""
Portfolio-wide coach sweep: run the experiment-coach status script over every
experiment and summarize stages and gate failures.

Usage: python .github/scripts/coach-sweep.py
Exit code is always 0 — this is a health report, not a gate.
"""

import datetime
import json
import subprocess
import sys
from collections import Counter
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
EXPERIMENTS_DIR = REPO_ROOT / "experiments"
COACH_SCRIPT = REPO_ROOT / ".claude" / "skills" / "experiment-coach" / "scripts" / "coach_status.py"

# Matches the staleness rule in docs/content-guide.md ("more than 4 weeks").
STALE_DAYS = 28


def stale_started_advisory() -> None:
    """Advisory only, never a gate: started experiments untouched for >4 weeks
    with nothing in results.learnings — learning is accruing but not being captured."""
    try:
        import experiment_doc
    except ImportError:
        return

    today = datetime.date.today()
    stale: list[tuple[str, int]] = []
    for exp_dir in sorted(EXPERIMENTS_DIR.iterdir()):
        if (
            not exp_dir.is_dir()
            or exp_dir.name.startswith(".")
            or not (exp_dir / "brief.md").exists()
        ):
            continue
        try:
            info, body, _ = experiment_doc.load_meta(exp_dir)
        except Exception:  # noqa: BLE001
            continue
        if info.get("status") != "started":
            continue
        # Learnings live in the `## Learnings` body section, never in frontmatter —
        # reading `results.learnings` off `info` alone is always empty, which made
        # this advisory fire on experiments that had captured learnings all along.
        learnings, _ = experiment_doc.extract_learnings(body)
        if learnings or (info.get("results") or {}).get("learnings"):
            continue
        # "No transferable learnings" is a real answer for infrastructure and
        # worked-example experiments; asking again every sweep is just noise.
        if experiment_doc.learnings_opted_out(body):
            continue
        updated = info.get("updated_at") or info.get("created_at")
        if isinstance(updated, datetime.datetime):
            updated = updated.date()
        elif isinstance(updated, str):
            try:
                updated = datetime.date.fromisoformat(updated[:10])
            except ValueError:
                updated = None
        if isinstance(updated, datetime.date) and (today - updated).days > STALE_DAYS:
            stale.append((exp_dir.name, (today - updated).days))

    if stale:
        print(
            f"\nAdvisory — `started` for >{STALE_DAYS} days with no learnings captured "
            '(capture one with: just learning <slug> "..."):'
        )
        for slug, days in stale:
            print(f"  - {slug} (last updated {days} days ago)")


def main() -> int:
    if not COACH_SCRIPT.exists():
        # The experiment-coach skill lives under .claude/, which is gitignored by
        # design, so this is the normal outcome in CI and in a fresh clone. Say so
        # loudly — a quiet pass reads as "all gates checked, all clear".
        print(
            "!! SKIPPED: stage inference and gate checks did not run.\n"
            f"   The coach script is not present at {COACH_SCRIPT.relative_to(REPO_ROOT)}\n"
            "   (.claude/ is gitignored, so it is local-only by design).\n"
            "   Only the staleness advisory below ran. Do not read this as a clean gate sweep.",
            file=sys.stderr,
        )
        stale_started_advisory()
        return 0

    stages: Counter[str] = Counter()
    failures: dict[str, list[str]] = {}
    pending: dict[str, list[str]] = {}
    errors: list[str] = []

    for exp_dir in sorted(EXPERIMENTS_DIR.iterdir()):
        if (
            not exp_dir.is_dir()
            or exp_dir.name.startswith(".")
            or not (exp_dir / "brief.md").exists()
        ):
            continue
        try:
            out = subprocess.run(
                [sys.executable, str(COACH_SCRIPT), str(exp_dir)],
                capture_output=True,
                text=True,
                timeout=30,
            ).stdout
            status = json.loads(out)
        except Exception as e:  # noqa: BLE001
            errors.append(f"{exp_dir.name}: {type(e).__name__}: {e}")
            continue
        if "error" in status:
            errors.append(f"{exp_dir.name}: {status['error']}")
            continue
        stages[status.get("inferred_stage", "unknown")] += 1
        gate_failures = status.get("gate_failures") or []
        if gate_failures:
            failures[exp_dir.name] = [
                f"{g.get('gate', '?')}: {g.get('message', '')}" for g in gate_failures
            ]
        pending_items = status.get("pending") or []
        if pending_items:
            pending[exp_dir.name] = [
                f"{p.get('section', '?')} — {p.get('reason', '')}" for p in pending_items
            ]

    print("Stages:")
    for stage, count in stages.most_common():
        print(f"  {count:3d}  {stage}")

    if failures:
        print(f"\nGate failures in {len(failures)} experiments:")
        for slug, gates in sorted(failures.items()):
            print(f"  {slug}:")
            for gate in gates:
                print(f"    - {gate}")
    else:
        print("\nNo gate failures.")

    # Advisory, never a failure: parts of a close-out that can't be answered yet.
    # Listed so they stay visible — a partial close-out is fine, forgetting it isn't.
    if pending:
        print(f"\nPending close-out sections in {len(pending)} experiments (advisory):")
        for slug, items in sorted(pending.items()):
            print(f"  {slug}:")
            for item in items:
                print(f"    - {item}")

    if errors:
        print(f"\nCoach errors ({len(errors)}):", file=sys.stderr)
        for err in errors:
            print(f"  - {err}", file=sys.stderr)

    stale_started_advisory()

    return 0


if __name__ == "__main__":
    sys.exit(main())
