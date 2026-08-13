#!/usr/bin/env python3
# /// script
# dependencies = [
#   "pyyaml"
# ]
# ///
"""
Generate experiment-index.json from every experiment's brief.md.

Usage: python .github/scripts/generate-index.py
       uv run .github/scripts/generate-index.py
"""

import json
import sys
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

# Enums come from experiment_schema.py — the single source of truth.
import experiment_doc  # noqa: E402
from experiment_schema import NOTEBOOK_DEMO_TYPES, REFERENCE_SCAFFOLDS, REQUIRED_FIELDS

REPO_ROOT = Path(__file__).resolve().parents[2]
EXPERIMENTS_DIR = REPO_ROOT / "experiments"
OUTPUT_FILE = REPO_ROOT / "experiment-index.json"


def load_experiment(exp_dir: Path) -> dict[str, Any] | None:
    """Load an experiment's metadata from its brief.md.

    Prose that lives in the brief body (description, results.summary,
    results.learnings) is read from there directly, so there is no second copy of
    it anywhere and nothing to keep in sync.
    """
    data, body, error = experiment_doc.load_meta(exp_dir)
    if error:
        print(f"Warning: Failed to parse metadata for {exp_dir}: {error}", file=sys.stderr)
        return None

    if not data:
        print(f"Warning: No metadata for {exp_dir}", file=sys.stderr)
        return None

    # Prose fields come from the body. The `results.get(...)` fallbacks below only
    # cover a brief that has the key in frontmatter but nothing in the body yet.
    if body:
        description = experiment_doc.extract_description(body)
        if description:
            data["description"] = description
        summary = experiment_doc.extract_summary(body)
        learnings, _ = experiment_doc.extract_learnings(body)
        # Always emit `results` so the index shape is uniform whether or not an
        # experiment has findings yet; the hub reads .results?.learnings?.length.
        results = dict(data.get("results") or {})
        results["summary"] = summary if summary else results.get("summary")
        results["learnings"] = learnings if learnings else (results.get("learnings") or [])
        data["results"] = results

    # Check for required fields (warn but don't fail)
    missing = [f for f in REQUIRED_FIELDS if f not in data]
    if missing:
        print(f"Warning: {exp_dir} missing fields: {missing}", file=sys.stderr)

    # Ensure slug exists (use directory name as fallback)
    if "slug" not in data:
        data["slug"] = exp_dir.name

    # Add computed fields (prefixed with _ to indicate they're generated)
    demo_cfg = data.get("demo", {})
    demo_enabled = demo_cfg.get("enabled", False)
    output_dir = demo_cfg.get("output_dir", "demo/dist")
    # Keyed on demo.enabled, NOT on the build output existing — the deploy runs
    # generate-index BEFORE build-demos, so on a cold cache every demo's dist was
    # still absent here and the hub published with every "Open demo" link hidden
    # and a demo count of 0. astro.config.mjs already keys the sitemap this way for
    # the same reason. `_demo_built` keeps the on-disk fact for local debugging.
    data["_has_demo"] = bool(demo_enabled)
    data["_demo_built"] = bool(demo_enabled and (exp_dir / output_dir).exists())
    data["_is_notebook"] = demo_enabled and demo_cfg.get("type", "") in NOTEBOOK_DEMO_TYPES
    data["_has_brief"] = (exp_dir / "brief.md").exists()
    # Demonstrates the repo's own conventions rather than asking an AI question.
    # Stays listed and browsable; the hub withholds it from every cross-experiment
    # aggregation. Computed here so the hub filters on a flag rather than keeping
    # its own copy of the slug list.
    data["_reference_scaffold"] = data["slug"] in REFERENCE_SCAFFOLDS

    return data


def main():
    if not EXPERIMENTS_DIR.exists():
        print(f"Error: {EXPERIMENTS_DIR} not found", file=sys.stderr)
        sys.exit(1)

    experiments = []

    for exp_dir in sorted(EXPERIMENTS_DIR.iterdir()):
        if not exp_dir.is_dir():
            continue

        # Skip hidden directories
        if exp_dir.name.startswith("."):
            continue

        if not (exp_dir / "brief.md").exists():
            print(f"Warning: No brief.md in {exp_dir}", file=sys.stderr)
            continue

        exp = load_experiment(exp_dir)
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
    by_targets: dict[str, list[str]] = {}

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

        # Index by what the work targets (capability / infra / feature)
        targets = exp.get("targets")
        if targets:
            by_targets.setdefault(targets, []).append(slug)

    # Build final index
    index = {
        "generated_at": datetime.now(UTC).isoformat(),
        "count": len(experiments),
        "by_type": by_type,
        "by_theme": by_theme,
        "by_status": by_status,
        "by_targets": by_targets,
        "experiments": experiments,
    }

    # Write output
    with open(OUTPUT_FILE, "w") as f:
        json.dump(index, f, indent=2, default=str)

    print(f"Generated {OUTPUT_FILE} with {len(experiments)} experiments")

    # Summary
    print(f"\nBy type: {', '.join(f'{k}({len(v)})' for k, v in sorted(by_type.items()))}")
    print(f"By status: {', '.join(f'{k}({len(v)})' for k, v in sorted(by_status.items()))}")


if __name__ == "__main__":
    main()
