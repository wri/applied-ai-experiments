#!/usr/bin/env python3
# /// script
# dependencies = [
#   "pyyaml"
# ]
# ///
"""
Validate all info.yaml files against schema.

Usage: python .github/scripts/validate-experiments.py [--strict]
       uv run .github/scripts/validate-experiments.py [--strict]

Exit code 0 = success, 1 = errors found
"""

import argparse
import sys
from pathlib import Path

import yaml

REPO_ROOT = Path(__file__).resolve().parents[2]
EXPERIMENTS_DIR = REPO_ROOT / "experiments"

# Required fields for all experiments (5 core fields)
REQUIRED_FIELDS = ["slug", "title", "type", "status", "description"]

# Recommended fields (soft warnings, don't block validation)
RECOMMENDED_FIELDS = ["owner", "created_at"]

# Valid values for enum fields
VALID_TYPES = ["evaluation", "benchmark", "spike", "prototype", "research", "notebook", "marimo"]
VALID_STATUS = ["idea", "started", "paused", "completed", "archived"]
VALID_THEMES = [
    "cost-perf",
    "evals",
    "patterns",
    "geospatial",
    "reliability",
    "agents",
    "scouting",
    "prototyping",
]
VALID_RUNTIMES = ["python", "typescript", "notebook", "marimo", "mixed", "none"]
VALID_DEMO_TYPES = ["sveltekit", "static", "notebook-html", "astro", "marimo-html", "marimo-wasm"]


def validate_experiment(yaml_path: Path, strict: bool = False) -> tuple[list[str], list[str]]:
    """
    Validate an info.yaml and return (errors, warnings).

    Args:
        yaml_path: Path to the YAML file
        strict: If True, include stricter validation

    Returns:
        Tuple of (errors, warnings) lists
    """
    errors = []
    warnings = []

    try:
        with open(yaml_path) as f:
            data = yaml.safe_load(f)
    except Exception as e:
        return [f"Failed to parse YAML: {e}"], []

    if not data:
        return ["Empty YAML file"], []

    # Check required fields
    for field in REQUIRED_FIELDS:
        if field not in data:
            errors.append(f"Missing required field: {field}")

    # Check recommended fields (soft warnings)
    for field in RECOMMENDED_FIELDS:
        if field not in data:
            warnings.append(f"Missing recommended field: {field}")

    # Validate slug matches folder name
    folder_name = yaml_path.parent.name
    if data.get("slug") and data["slug"] != folder_name:
        errors.append(f"slug '{data['slug']}' doesn't match folder name '{folder_name}'")

    # Validate type
    exp_type = data.get("type")
    if exp_type and exp_type not in VALID_TYPES:
        errors.append(f"Invalid type: {exp_type}. Must be one of {VALID_TYPES}")

    # Validate status
    status = data.get("status")
    if status and status not in VALID_STATUS:
        errors.append(f"Invalid status: {status}. Must be one of {VALID_STATUS}")

    # Validate themes (warn on non-standard, don't error)
    for theme in data.get("themes", []):
        if theme not in VALID_THEMES:
            warnings.append(f"Non-standard theme: '{theme}'. Standard themes: {VALID_THEMES}")

    # Validate runtime if present
    runtime = data.get("runtime")
    if runtime and runtime not in VALID_RUNTIMES:
        errors.append(f"Invalid runtime: {runtime}. Must be one of {VALID_RUNTIMES}")

    # Validate demo config if enabled
    demo = data.get("demo", {})
    if demo.get("enabled"):
        demo_type = demo.get("type")
        if demo_type and demo_type not in VALID_DEMO_TYPES:
            errors.append(f"Invalid demo type: {demo_type}. Must be one of {VALID_DEMO_TYPES}")
        if not demo.get("output_dir"):
            errors.append("Demo enabled but no output_dir specified")

    # Prototype demo warning
    if exp_type == "prototype":
        if not demo.get("enabled"):
            warnings.append("'prototype' experiments typically have demo.enabled: true")

    # Owner validation (string only)
    owner = data.get("owner")
    if owner is not None:
        if isinstance(owner, dict):
            errors.append("owner must be a string, not an object. Use owner: \"Name\"")
        elif not isinstance(owner, str):
            errors.append("owner must be a string")

    # Results validation
    results = data.get("results", {})
    if isinstance(results, dict):
        lessons = results.get("lessons")
        if lessons is not None:
            if not isinstance(lessons, list):
                errors.append("results.lessons must be a list of strings")
            elif lessons:
                for i, lesson in enumerate(lessons):
                    if not isinstance(lesson, str):
                        errors.append(f"results.lessons[{i}] must be a string")

        # Warn if completed without lessons
        if status == "completed" and (not lessons or len(lessons) == 0):
            warnings.append("Completed experiment should have results.lessons")

    # Date format validation
    for date_field in ["created_at", "updated_at"]:
        value = data.get(date_field)
        if value and not isinstance(value, (str, type(None))):
            # YAML might parse dates as date objects, which is fine
            try:
                str(value)
            except Exception:
                errors.append(f"{date_field} must be a valid date")

    return errors, warnings


def main():
    parser = argparse.ArgumentParser(description="Validate experiment metadata")
    parser.add_argument(
        "--strict", action="store_true", help="Treat warnings as errors"
    )
    parser.add_argument(
        "--quiet", "-q", action="store_true", help="Only show errors"
    )
    args = parser.parse_args()

    if not EXPERIMENTS_DIR.exists():
        print(f"Error: {EXPERIMENTS_DIR} not found", file=sys.stderr)
        sys.exit(1)

    all_errors: dict[str, list[str]] = {}
    all_warnings: dict[str, list[str]] = {}
    total_experiments = 0

    for exp_dir in sorted(EXPERIMENTS_DIR.iterdir()):
        if not exp_dir.is_dir():
            continue

        # Skip hidden directories
        if exp_dir.name.startswith("."):
            continue

        # Find metadata file (prefer info.yaml, fall back to experiment.yaml for migration)
        yaml_path = exp_dir / "info.yaml"
        if not yaml_path.exists():
            yaml_path = exp_dir / "experiment.yaml"

        if not yaml_path.exists():
            all_errors[str(exp_dir)] = ["No info.yaml or experiment.yaml found"]
            continue

        total_experiments += 1
        errors, warnings = validate_experiment(yaml_path, strict=args.strict)

        if errors:
            all_errors[str(yaml_path)] = errors
        if warnings:
            all_warnings[str(yaml_path)] = warnings

    print(f"\nValidated {total_experiments} experiments")

    # Show warnings
    if all_warnings and not args.quiet:
        print(f"\nWarnings in {len(all_warnings)} experiments:")
        for path, warnings in all_warnings.items():
            print(f"\n  {path}:")
            for warning in warnings:
                print(f"    - {warning}")

    # Show errors
    if all_errors:
        print(f"\nErrors in {len(all_errors)} experiments:", file=sys.stderr)
        for path, errors in all_errors.items():
            print(f"\n  {path}:", file=sys.stderr)
            for error in errors:
                print(f"    - {error}", file=sys.stderr)

    # Determine exit code
    if all_errors:
        print(f"\nValidation FAILED with {sum(len(e) for e in all_errors.values())} errors", file=sys.stderr)
        sys.exit(1)
    elif all_warnings and args.strict:
        print(f"\nValidation FAILED (strict mode) with {sum(len(w) for w in all_warnings.values())} warnings", file=sys.stderr)
        sys.exit(1)
    else:
        print("\nValidation PASSED")
        sys.exit(0)


if __name__ == "__main__":
    main()
