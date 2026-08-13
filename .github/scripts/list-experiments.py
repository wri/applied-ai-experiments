#!/usr/bin/env python3
# /// script
# dependencies = [
#   "pyyaml"
# ]
# ///
"""
List experiments, or count them by type.

Usage: uv run .github/scripts/list-experiments.py [--stats]

Reads metadata through experiment_doc.load_meta — the one entry point that knows
where an experiment's metadata lives. The previous version of this lived inline in
the justfile and parsed `info.yaml` directly, so it kept reporting "no metadata"
for every experiment for as long as it took someone to notice.
"""

import argparse
import sys
from collections import Counter
from pathlib import Path

import experiment_doc

REPO_ROOT = Path(__file__).resolve().parents[2]
EXPERIMENTS_DIR = REPO_ROOT / "experiments"


def experiments() -> list[tuple[str, dict]]:
    out = []
    for exp_dir in sorted(EXPERIMENTS_DIR.iterdir()):
        if not exp_dir.is_dir() or exp_dir.name.startswith("."):
            continue
        meta, _, error = experiment_doc.load_meta(exp_dir)
        if error:
            print(f"warning: {exp_dir.name}: {error}", file=sys.stderr)
        out.append((exp_dir.name, meta or {}))
    return out


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--stats", action="store_true", help="count by type instead of listing")
    args = parser.parse_args()

    if not EXPERIMENTS_DIR.exists():
        print(f"Error: {EXPERIMENTS_DIR} not found", file=sys.stderr)
        return 1

    rows = experiments()

    if args.stats:
        types = Counter(meta.get("type", "unknown") for _, meta in rows)
        statuses = Counter(meta.get("status", "unknown") for _, meta in rows)
        print(f"{len(rows)} experiments\n")
        print("By type:")
        for name, count in sorted(types.items()):
            print(f"  {name}: {count}")
        print("\nBy status:")
        for name, count in sorted(statuses.items()):
            print(f"  {name}: {count}")
        return 0

    width = max((len(slug) for slug, _ in rows), default=0)
    for slug, meta in rows:
        status = meta.get("status") or "no metadata"
        exp_type = meta.get("type") or "-"
        print(f"{slug:<{width}}  {status:<9}  {exp_type}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
