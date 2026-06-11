#!/usr/bin/env python3
# /// script
# dependencies = [
#   "pyyaml"
# ]
# ///
"""
Backfill the optional portfolio fields (maturity, investment_type, origin) on
experiments that lack them, using conservative heuristics:

  maturity        — from the l1-explore / l2-demonstrate / l3-operationalize tag
                    when present; else L2 for completed-with-demo, else L1
  investment_type — mapped from type: spike→spike, evaluation/benchmark→probe,
                    everything else→exploration
  origin          — team-driven (the corpus default)

By default prints a review table and writes nothing. Re-run with --write to
apply. Fields already set are never touched.
"""

import argparse
import re
import sys
from pathlib import Path

import yaml

REPO_ROOT = Path(__file__).resolve().parents[2]
EXPERIMENTS_DIR = REPO_ROOT / "experiments"

TAG_TO_MATURITY = {
    "l1-explore": "L1",
    "l2-demonstrate": "L2",
    "l3-operationalize": "L3",
}

TYPE_TO_INVESTMENT = {
    "spike": "spike",
    "evaluation": "probe",
    "benchmark": "probe",
    "prototype": "exploration",
    "research": "exploration",
    "notebook": "exploration",
    "marimo": "exploration",
}


def propose(data: dict) -> dict[str, tuple[str, str]]:
    """Return {field: (value, rationale)} for each missing portfolio field."""
    proposals: dict[str, tuple[str, str]] = {}

    if not data.get("maturity"):
        tags = data.get("tags") or []
        tag_maturity = next((TAG_TO_MATURITY[t] for t in tags if t in TAG_TO_MATURITY), None)
        if tag_maturity:
            proposals["maturity"] = (tag_maturity, "from maturity tag")
        elif data.get("status") == "completed" and (data.get("demo") or {}).get("enabled"):
            proposals["maturity"] = ("L2", "completed with demo")
        else:
            proposals["maturity"] = ("L1", "default")

    if not data.get("investment_type"):
        investment = TYPE_TO_INVESTMENT.get(data.get("type", ""), "exploration")
        proposals["investment_type"] = (investment, f"from type: {data.get('type')}")

    if not data.get("origin"):
        proposals["origin"] = ("team-driven", "default")

    return proposals


def apply_to_text(text: str, proposals: dict[str, tuple[str, str]]) -> str:
    """Insert the proposed fields as a Portfolio block, preserving comments.
    Mirrors the placement used by create-experiment-from-issue.py."""
    lines = [f"{field}: {value}" for field, (value, _) in proposals.items()]
    block = "# ---- Portfolio ----\n" + "\n".join(lines) + "\n\n"
    anchor = re.search(r"^# ---- (?:Demo|Results)", text, re.MULTILINE)
    if anchor:
        return text[: anchor.start()] + block + text[anchor.start() :]
    return text.rstrip("\n") + "\n\n" + block


def main() -> int:
    parser = argparse.ArgumentParser(description="Backfill portfolio fields")
    parser.add_argument("--write", action="store_true", help="Apply proposals to disk")
    args = parser.parse_args()

    rows: list[tuple[str, dict[str, tuple[str, str]]]] = []

    for exp_dir in sorted(EXPERIMENTS_DIR.iterdir()):
        yaml_path = exp_dir / "info.yaml"
        if not exp_dir.is_dir() or exp_dir.name.startswith(".") or not yaml_path.exists():
            continue
        try:
            data = yaml.safe_load(yaml_path.read_text()) or {}
        except Exception as e:  # noqa: BLE001
            print(f"skip {exp_dir.name}: YAML parse error: {e}", file=sys.stderr)
            continue
        proposals = propose(data)
        if proposals:
            rows.append((exp_dir.name, proposals))
            if args.write:
                yaml_path.write_text(apply_to_text(yaml_path.read_text(), proposals))

    if not rows:
        print("Nothing to backfill — all experiments have portfolio fields.")
        return 0

    slug_width = max(len(slug) for slug, _ in rows)
    print(f"{'experiment':<{slug_width}}  {'maturity':<22} {'investment_type':<28} origin")
    print("-" * (slug_width + 64))
    for slug, proposals in rows:
        cells = []
        for field in ("maturity", "investment_type", "origin"):
            if field in proposals:
                value, why = proposals[field]
                cells.append(f"{value} ({why})")
            else:
                cells.append("— (already set)")
        print(f"{slug:<{slug_width}}  {cells[0]:<22} {cells[1]:<28} {cells[2]}")

    verb = "Wrote" if args.write else "Proposed"
    print(
        f"\n{verb} backfill for {len(rows)} experiments"
        + ("" if args.write else " — review above, then re-run with --write")
    )
    return 0


if __name__ == "__main__":
    main()
