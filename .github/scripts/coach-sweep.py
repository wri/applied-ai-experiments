#!/usr/bin/env python3
"""
Portfolio-wide coach sweep: run the experiment-coach status script over every
experiment and summarize stages and gate failures.

Usage: python .github/scripts/coach-sweep.py
Exit code is always 0 — this is a health report, not a gate.
"""

import json
import subprocess
import sys
from collections import Counter
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
EXPERIMENTS_DIR = REPO_ROOT / "experiments"
COACH_SCRIPT = REPO_ROOT / ".claude" / "skills" / "experiment-coach" / "scripts" / "coach_status.py"


def main() -> int:
    if not COACH_SCRIPT.exists():
        print(f"coach script not found: {COACH_SCRIPT}", file=sys.stderr)
        return 0

    stages: Counter[str] = Counter()
    failures: dict[str, list[str]] = {}
    errors: list[str] = []

    for exp_dir in sorted(EXPERIMENTS_DIR.iterdir()):
        if (
            not exp_dir.is_dir()
            or exp_dir.name.startswith(".")
            or not (exp_dir / "info.yaml").exists()
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

    if errors:
        print(f"\nCoach errors ({len(errors)}):", file=sys.stderr)
        for err in errors:
            print(f"  - {err}", file=sys.stderr)

    return 0


if __name__ == "__main__":
    sys.exit(main())
