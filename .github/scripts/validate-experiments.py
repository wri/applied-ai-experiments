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
       uv run .github/scripts/validate-experiments.py --fix          # print proposed diffs
       uv run .github/scripts/validate-experiments.py --fix --write  # apply them

Exit code 0 = success, 1 = errors found
"""

import argparse
import difflib
import re
import subprocess
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

# Optional portfolio fields — backwards-compatible; absent values are fine
VALID_MATURITY = ["L1", "L2", "L3"]
VALID_INVESTMENT_TYPE = ["probe", "spike", "exploration"]
VALID_ORIGIN = ["team-driven", "prospecting"]

# Schema versioning: absent = pre-versioning (warn), > CURRENT = unknown (error)
CURRENT_SCHEMA_VERSION = 2

# Recordings are URL-only — hosted on object storage / YouTube / Loom,
# never committed to the repo
VALID_MEDIA_TYPES = ["video", "youtube", "loom"]

# Owner conventions: '@github-handle' or bare handle for individuals, or a known team
KNOWN_TEAM_OWNERS = ["Applied AI Group"]
PLACEHOLDER_OWNERS = {"your name", "changeme", "todo", "tbd"}


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

    # Validate optional portfolio fields
    maturity = data.get("maturity")
    if maturity and maturity not in VALID_MATURITY:
        errors.append(f"Invalid maturity: {maturity}. Must be one of {VALID_MATURITY}")

    investment_type = data.get("investment_type")
    if investment_type and investment_type not in VALID_INVESTMENT_TYPE:
        errors.append(
            f"Invalid investment_type: {investment_type}. Must be one of {VALID_INVESTMENT_TYPE}"
        )

    origin = data.get("origin")
    if origin and origin not in VALID_ORIGIN:
        errors.append(f"Invalid origin: {origin}. Must be one of {VALID_ORIGIN}")

    depends_on = data.get("depends_on")
    if depends_on is not None:
        if not isinstance(depends_on, list):
            errors.append("depends_on must be a list of slugs")
        else:
            for i, dep in enumerate(depends_on):
                if not isinstance(dep, str):
                    errors.append(f"depends_on[{i}] must be a string slug")

    surface = data.get("surface")
    if surface is not None and not isinstance(surface, str):
        errors.append("surface must be a string or null")

    # Validate demo config if enabled
    demo = data.get("demo", {})
    if demo.get("enabled"):
        demo_type = demo.get("type")
        if demo_type and demo_type not in VALID_DEMO_TYPES:
            errors.append(f"Invalid demo type: {demo_type}. Must be one of {VALID_DEMO_TYPES}")
        if not demo.get("output_dir"):
            errors.append("Demo enabled but no output_dir specified")

    # Prototype demo warning
    if exp_type == "prototype" and not demo.get("enabled"):
        warnings.append("'prototype' experiments typically have demo.enabled: true")

    # Owner validation (string only, no placeholders, conventional format)
    owner = data.get("owner")
    if owner is not None:
        if isinstance(owner, dict):
            errors.append('owner must be a string, not an object. Use owner: "Name"')
        elif not isinstance(owner, str):
            errors.append("owner must be a string")
        elif owner.strip().lower() in PLACEHOLDER_OWNERS:
            errors.append(f"owner is a placeholder ('{owner}') — set a real owner")
        elif " " in owner.strip() and owner.strip() not in KNOWN_TEAM_OWNERS:
            warnings.append(
                f"owner '{owner}' is neither an @github-handle nor a known team "
                f"({', '.join(KNOWN_TEAM_OWNERS)}) — prefer '@handle' for individuals"
            )

    # Schema version: absent means "copied from a pre-versioning experiment"
    schema_version = data.get("schema_version")
    if schema_version is None:
        warnings.append(
            f"Missing schema_version (current: {CURRENT_SCHEMA_VERSION}) — "
            "likely copied from an old experiment; run --fix to add it"
        )
    elif (
        not isinstance(schema_version, int)
        or schema_version > CURRENT_SCHEMA_VERSION
        or schema_version < 1
    ):
        errors.append(
            f"Unknown schema_version: {schema_version!r}. Current is {CURRENT_SCHEMA_VERSION}"
        )

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

    # Completed experiments need a results block with a summary (aligns with the
    # coach's completed-needs-summary gate; results: null silently skipped before)
    if status == "completed":
        if not isinstance(results, dict) or not results:
            warnings.append("Completed experiment has no results block (results: null/missing)")
        else:
            summary = results.get("summary")
            if summary is None or (isinstance(summary, str) and not summary.strip()):
                warnings.append("Completed experiment should have results.summary")

    # Media validation: recordings are external URLs only
    media = data.get("media")
    if media is not None:
        if not isinstance(media, dict):
            errors.append("media must be a mapping (e.g. media: {recordings: [...]})")
        else:
            recordings = media.get("recordings")
            if recordings is not None and not isinstance(recordings, list):
                errors.append("media.recordings must be a list")
            for i, rec in enumerate(recordings or []):
                if not isinstance(rec, dict):
                    errors.append(f"media.recordings[{i}] must be a mapping with a src")
                    continue
                src = rec.get("src")
                if not src or not isinstance(src, str):
                    errors.append(f"media.recordings[{i}].src is required")
                elif not src.startswith("https://"):
                    errors.append(
                        f"media.recordings[{i}].src must be an https:// URL — "
                        "recordings are hosted externally (object storage, YouTube, Loom), "
                        "never committed to the repo"
                    )
                rec_type = rec.get("type")
                if rec_type is not None and rec_type not in VALID_MEDIA_TYPES:
                    errors.append(
                        f"media.recordings[{i}].type: {rec_type!r}. Must be one of {VALID_MEDIA_TYPES}"
                    )

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


def git_last_modified(path: Path) -> str | None:
    """Date (YYYY-MM-DD) of the last commit touching this path."""
    try:
        out = subprocess.run(
            ["git", "log", "-1", "--format=%as", "--", str(path)],
            capture_output=True,
            text=True,
            cwd=REPO_ROOT,
            check=True,
        ).stdout.strip()
        return out or None
    except Exception:
        return None


def fix_experiment(yaml_path: Path) -> tuple[str, str, list[str]]:
    """Compute normalizing fixes for one info.yaml.

    Returns (original_text, fixed_text, descriptions). Operates on raw text so
    comments and formatting are preserved; uses the parsed YAML only to decide
    what needs fixing.
    """
    original = yaml_path.read_text()
    text = original
    fixes: list[str] = []
    try:
        data = yaml.safe_load(original) or {}
    except Exception:
        return original, original, []  # unparseable files are reported as errors, not fixed

    # results: null / ~ / {} → canonical empty shape. Only when the parsed value
    # confirms it's empty — a bare `results:` heading with indented children
    # parses as a dict and is left alone.
    if "results" in data and (data["results"] is None or data["results"] == {}):
        new_text, n = re.subn(
            r"^results:[^\n#]*(#[^\n]*)?$",
            "results:\n  summary: null\n  lessons: []",
            text,
            count=1,
            flags=re.MULTILINE,
        )
        if n:
            text = new_text
            fixes.append("normalize empty results block to {summary: null, lessons: []}")

    # schema_version: insert right after the slug line
    if "schema_version" not in data:
        new_text, n = re.subn(
            r"^(slug:[^\n]*\n)",
            rf"\g<1>schema_version: {CURRENT_SCHEMA_VERSION}\n",
            text,
            count=1,
            flags=re.MULTILINE,
        )
        if n:
            text = new_text
            fixes.append(f"add schema_version: {CURRENT_SCHEMA_VERSION}")

    # updated_at: fill from git history when missing
    if "updated_at" not in data:
        last = git_last_modified(yaml_path.parent)
        if last:
            new_text, n = re.subn(
                r"^(created_at:[^\n]*\n)",
                rf"\g<1>updated_at: {last}\n",
                text,
                count=1,
                flags=re.MULTILINE,
            )
            if n:
                text = new_text
                fixes.append(f"add updated_at: {last} (from git log)")

    return original, text, fixes


def main():
    parser = argparse.ArgumentParser(description="Validate experiment metadata")
    parser.add_argument("--strict", action="store_true", help="Treat warnings as errors")
    parser.add_argument("--quiet", "-q", action="store_true", help="Only show errors")
    parser.add_argument(
        "--fix",
        action="store_true",
        help="Propose normalizing fixes as diffs (results shape, schema_version, updated_at)",
    )
    parser.add_argument(
        "--write", action="store_true", help="With --fix: apply the proposed fixes to disk"
    )
    args = parser.parse_args()
    if args.write and not args.fix:
        parser.error("--write requires --fix")

    if not EXPERIMENTS_DIR.exists():
        print(f"Error: {EXPERIMENTS_DIR} not found", file=sys.stderr)
        sys.exit(1)

    all_errors: dict[str, list[str]] = {}
    all_warnings: dict[str, list[str]] = {}
    total_experiments = 0
    total_fixes = 0
    fixed_files = 0

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

        if args.fix:
            original, fixed, fixes = fix_experiment(yaml_path)
            if fixes:
                rel = yaml_path.relative_to(REPO_ROOT)
                print(f"\n{rel}: {'; '.join(fixes)}")
                diff = difflib.unified_diff(
                    original.splitlines(keepends=True),
                    fixed.splitlines(keepends=True),
                    fromfile=f"a/{rel}",
                    tofile=f"b/{rel}",
                )
                sys.stdout.writelines(diff)
                if args.write:
                    yaml_path.write_text(fixed)
                total_fixes += len(fixes)
                fixed_files += 1

        errors, warnings = validate_experiment(yaml_path, strict=args.strict)

        if errors:
            all_errors[str(yaml_path)] = errors
        if warnings:
            all_warnings[str(yaml_path)] = warnings

    if args.fix:
        action = "Applied" if args.write else "Proposed"
        print(
            f"\n{action} {total_fixes} fixes across {fixed_files} files"
            + ("" if args.write else " (re-run with --write to apply)")
        )

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
        print(
            f"\nValidation FAILED with {sum(len(e) for e in all_errors.values())} errors",
            file=sys.stderr,
        )
        sys.exit(1)
    elif all_warnings and args.strict:
        print(
            f"\nValidation FAILED (strict mode) with {sum(len(w) for w in all_warnings.values())} warnings",
            file=sys.stderr,
        )
        sys.exit(1)
    else:
        print("\nValidation PASSED")
        sys.exit(0)


if __name__ == "__main__":
    main()
