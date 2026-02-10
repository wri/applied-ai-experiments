#!/usr/bin/env python3
# /// script
# dependencies = [
#   "pyyaml"
# ]
# ///
"""
Generate experiment-index.json from all info.yaml files.

Usage: python .github/scripts/generate-index.py
       uv run .github/scripts/generate-index.py
"""

import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import yaml

REPO_ROOT = Path(__file__).resolve().parents[2]
EXPERIMENTS_DIR = REPO_ROOT / "experiments"
OUTPUT_FILE = REPO_ROOT / "experiment-index.json"

REQUIRED_FIELDS = ["slug", "title", "type", "status", "description"]
NOTEBOOK_DEMO_TYPES = {"notebook-html", "marimo-html", "marimo-wasm"}


def load_experiment(yaml_path: Path) -> dict[str, Any] | None:
    """Load and validate an info.yaml file."""
    try:
        with open(yaml_path) as f:
            data = yaml.safe_load(f)
    except Exception as e:
        print(f"Warning: Failed to parse {yaml_path}: {e}", file=sys.stderr)
        return None

    if not data:
        print(f"Warning: Empty YAML file: {yaml_path}", file=sys.stderr)
        return None

    # Check for required fields (warn but don't fail)
    missing = [f for f in REQUIRED_FIELDS if f not in data]
    if missing:
        print(f"Warning: {yaml_path} missing fields: {missing}", file=sys.stderr)

    # Ensure slug exists (use directory name as fallback)
    exp_dir = yaml_path.parent
    if "slug" not in data:
        data["slug"] = exp_dir.name

    # Add computed fields (prefixed with _ to indicate they're generated)
    demo_cfg = data.get("demo", {})
    demo_enabled = demo_cfg.get("enabled", False)
    output_dir = demo_cfg.get("output_dir", "demo/dist")
    data["_has_demo"] = demo_enabled and (exp_dir / output_dir).exists()
    data["_is_notebook"] = demo_enabled and demo_cfg.get("type", "") in NOTEBOOK_DEMO_TYPES
    data["_has_brief"] = (exp_dir / "brief.md").exists()

    return data


def main():
    if not EXPERIMENTS_DIR.exists():
        print(f"Error: {EXPERIMENTS_DIR} not found", file=sys.stderr)
        sys.exit(1)

    experiments = []

    # Look for both info.yaml (preferred) and experiment.yaml (legacy)
    for exp_dir in sorted(EXPERIMENTS_DIR.iterdir()):
        if not exp_dir.is_dir():
            continue

        # Skip hidden directories
        if exp_dir.name.startswith("."):
            continue

        # Try info.yaml first, fall back to experiment.yaml for migration
        yaml_path = exp_dir / "info.yaml"
        if not yaml_path.exists():
            yaml_path = exp_dir / "experiment.yaml"

        if not yaml_path.exists():
            print(f"Warning: No metadata file in {exp_dir}", file=sys.stderr)
            continue

        exp = load_experiment(yaml_path)
        if exp:
            experiments.append(exp)

    # Sort by updated_at (or created_at), most recent first
    # Convert dates to strings for comparison (YAML may parse as date objects)
    def get_sort_key(x):
        date_val = x.get("updated_at") or x.get("created_at") or "1970-01-01"
        return str(date_val)

    experiments.sort(key=get_sort_key, reverse=True)

    # Build facet indexes
    by_type: dict[str, list[str]] = {}
    by_theme: dict[str, list[str]] = {}
    by_status: dict[str, list[str]] = {}

    for exp in experiments:
        slug = exp["slug"]

        # Index by type
        exp_type = exp.get("type", "unknown")
        by_type.setdefault(exp_type, []).append(slug)

        # Index by themes
        for theme in exp.get("themes", []):
            by_theme.setdefault(theme, []).append(slug)

        # Index by status
        status = exp.get("status", "unknown")
        by_status.setdefault(status, []).append(slug)

    # Build final index
    index = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "count": len(experiments),
        "by_type": by_type,
        "by_theme": by_theme,
        "by_status": by_status,
        "experiments": experiments,
    }

    # Write output
    with open(OUTPUT_FILE, "w") as f:
        json.dump(index, f, indent=2, default=str)

    print(f"Generated {OUTPUT_FILE} with {len(experiments)} experiments")

    # Summary
    print(f"\nBy type: {', '.join(f'{k}({len(v)})' for k, v in sorted(by_type.items()))}")
    print(
        f"By status: {', '.join(f'{k}({len(v)})' for k, v in sorted(by_status.items()))}"
    )


if __name__ == "__main__":
    main()
