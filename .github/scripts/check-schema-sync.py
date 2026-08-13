#!/usr/bin/env python3
"""Verify the non-Python schema copies match experiment_schema.py.

`experiment_schema.py` is the single source of truth for the metadata contract,
but two consumers can't import Python and therefore restate its enums:

  - packages/shared-types/src/index.ts  — TypeScript unions and const arrays
  - hub/src/data/taxonomy.json          — theme and target display metadata

This script diffs them and exits 1 on drift, so a one-sided edit fails loudly
instead of silently shipping (which is how `development` came to exist in the
taxonomy but not the validator).

Usage: uv run .github/scripts/check-schema-sync.py
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

from experiment_schema import (
    VALID_DEMO_TYPES,
    VALID_STATUS,
    VALID_TARGETS,
    VALID_THEMES,
    VALID_TYPES,
)

REPO_ROOT = Path(__file__).resolve().parents[2]
TS_TYPES = REPO_ROOT / "packages" / "shared-types" / "src" / "index.ts"
TAXONOMY = REPO_ROOT / "hub" / "src" / "data" / "taxonomy.json"


def ts_union(source: str, type_name: str) -> list[str] | None:
    """Extract the string members of `export type <name> = "a" | "b";`."""
    match = re.search(
        rf"export type {re.escape(type_name)}\s*=\s*(.+?);",
        source,
        re.DOTALL,
    )
    if not match:
        return None
    return re.findall(r'"([^"]+)"', match.group(1))


def ts_const_array(source: str, const_name: str) -> list[str] | None:
    """Extract the members of `export const NAME = [...] as const;`."""
    match = re.search(
        rf"export const {re.escape(const_name)}\s*=\s*\[(.*?)\]\s*as const;",
        source,
        re.DOTALL,
    )
    if not match:
        return None
    return re.findall(r'"([^"]+)"', match.group(1))


def compare(label: str, expected: list[str], actual: list[str] | None) -> list[str]:
    """Return a list of human-readable problems for one enum pair."""
    if actual is None:
        return [f"{label}: not found — expected it to restate {expected}"]
    if actual == expected:
        return []
    problems = []
    missing = [v for v in expected if v not in actual]
    extra = [v for v in actual if v not in expected]
    if missing:
        problems.append(f"{label}: missing {missing}")
    if extra:
        problems.append(f"{label}: has unknown value(s) {extra}")
    if not missing and not extra:
        problems.append(
            f"{label}: same values, different order\n    schema: {expected}\n    found:  {actual}"
        )
    return problems


def main() -> int:
    problems: list[str] = []

    # --- TypeScript ---------------------------------------------------------
    if not TS_TYPES.exists():
        problems.append(f"{TS_TYPES.relative_to(REPO_ROOT)}: not found")
    else:
        ts = TS_TYPES.read_text()
        rel = TS_TYPES.relative_to(REPO_ROOT)
        for label, expected, actual in (
            ("ExperimentType", VALID_TYPES, ts_union(ts, "ExperimentType")),
            ("ExperimentStatus", VALID_STATUS, ts_union(ts, "ExperimentStatus")),
            ("Targets", VALID_TARGETS, ts_union(ts, "Targets")),
            ("VALID_THEMES", VALID_THEMES, ts_const_array(ts, "VALID_THEMES")),
            ("VALID_TARGETS", VALID_TARGETS, ts_const_array(ts, "VALID_TARGETS")),
        ):
            problems += compare(f"{rel} → {label}", expected, actual)

        # DemoConfig.type is an inline union, so it needs its own extraction.
        demo_match = re.search(r"type\?:\s*((?:\s*\|?\s*\"[^\"]+\")+);", ts)
        demo_actual = re.findall(r'"([^"]+)"', demo_match.group(1)) if demo_match else None
        problems += compare(
            f"{rel} → DemoConfig.type",
            sorted(VALID_DEMO_TYPES),
            sorted(demo_actual) if demo_actual else None,
        )

    # --- taxonomy.json ------------------------------------------------------
    if not TAXONOMY.exists():
        problems.append(f"{TAXONOMY.relative_to(REPO_ROOT)}: not found")
    else:
        rel = TAXONOMY.relative_to(REPO_ROOT)
        try:
            tax = json.loads(TAXONOMY.read_text())
        except json.JSONDecodeError as e:
            problems.append(f"{rel}: invalid JSON — {e}")
            tax = {}

        problems += compare(f"{rel} → themes", VALID_THEMES, list(tax.get("themes", {})))
        problems += compare(f"{rel} → targets", VALID_TARGETS, list(tax.get("targets", {})))
        problems += compare(f"{rel} → statuses", VALID_STATUS, list(tax.get("statuses", [])))

        # Every theme must sit in exactly one pillar, or the themes index and
        # theme pages disagree about what exists. Pillar grouping order is
        # meaningful and independent of the enum order, so compare as sets.
        pillar_themes = [t for p in tax.get("pillars", []) for t in p.get("themes", [])]
        problems += compare(
            f"{rel} → pillars (flattened)", sorted(VALID_THEMES), sorted(pillar_themes)
        )
        duplicates = {t for t in pillar_themes if pillar_themes.count(t) > 1}
        if duplicates:
            problems.append(
                f"{rel} → pillars: theme(s) in more than one pillar: {sorted(duplicates)}"
            )

    # --- Report -------------------------------------------------------------
    if problems:
        print("Schema drift detected:\n", file=sys.stderr)
        for problem in problems:
            print(f"  - {problem}", file=sys.stderr)
        print(
            "\nThe canonical source is .github/scripts/experiment_schema.py — "
            "update it first, then mirror the change.",
            file=sys.stderr,
        )
        return 1

    print("Schema sync OK — TypeScript types and taxonomy.json match experiment_schema.py")
    return 0


if __name__ == "__main__":
    sys.exit(main())
