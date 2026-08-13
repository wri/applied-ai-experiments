#!/usr/bin/env python3
# /// script
# dependencies = [
#   "pyyaml"
# ]
# ///
"""
Validate every experiment's brief.md metadata against the schema.

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

# Every enum lives in experiment_schema.py — the single source of truth.
# Do not re-declare values here.
import experiment_doc  # noqa: E402
import yaml
from experiment_schema import (
    PLACEHOLDER_CHECKED_FIELDS,
    RECOMMENDED_FIELDS,
    REFERENCE_SCAFFOLDS,
    REQUIRED_FIELDS,
    VALID_DEMO_TYPES,
    VALID_STATUS,
    VALID_TARGETS,
    VALID_THEMES,
    VALID_TYPES,
    is_placeholder,
)

REPO_ROOT = Path(__file__).resolve().parents[2]
EXPERIMENTS_DIR = REPO_ROOT / "experiments"

# Free-form list fields the hub renders. Never enum-checked, but the shape
# matters: a scalar where a list is expected breaks the build or renders wrong.
LIST_OF_STRING_FIELDS = ["themes", "tags"]

#: Soft cap on classification breadth. A warning, never an error: an experiment
#: that genuinely spans three themes should say so, but tagging everything with
#: everything makes the facets useless. Themes are ordered — the first is primary.
MAX_CLASSIFIERS = 2


def validate_experiment(exp_dir: Path, strict: bool = False) -> tuple[list[str], list[str]]:
    """
    Validate one experiment's metadata and return (errors, warnings).

    Metadata is the brief's frontmatter plus the prose fields read out of the brief
    body — `description` lives in the lede blockquote, so validating the frontmatter
    alone would report it missing.

    Args:
        exp_dir: The experiment directory
        strict: If True, include stricter validation

    Returns:
        Tuple of (errors, warnings) lists
    """
    errors = []
    warnings = []

    data, body, parse_error = experiment_doc.load_meta(exp_dir)
    if parse_error:
        return [f"Failed to parse metadata: {parse_error}"], []

    if not data:
        return ["No metadata found (expected a YAML frontmatter block in brief.md)"], []

    data = dict(data)
    if body:
        # Prose fields live in the markdown body; resolve them the same way
        # generate-index.py does, or validation would report them missing.
        # The body is the authoring surface, so it wins over any YAML copy —
        # otherwise a scaffold's leftover CHANGEME would mask the real value.
        description = experiment_doc.extract_description(body)
        if description:
            data["description"] = description
        summary = experiment_doc.extract_summary(body)
        learnings, _ = experiment_doc.extract_learnings(body)
        if summary or learnings:
            results = dict(data.get("results") or {})
            if summary:
                results["summary"] = summary
            if learnings:
                results["learnings"] = learnings
            data["results"] = results

    # Check required fields
    for field in REQUIRED_FIELDS:
        if field not in data:
            errors.append(f"Missing required field: {field}")

    # Check recommended fields (soft warnings)
    for field in RECOMMENDED_FIELDS:
        if field not in data:
            warnings.append(f"Missing recommended field: {field}")

    # Validate slug matches folder name
    folder_name = exp_dir.name
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

    # Shape-check the free-form list fields the hub renders. These were
    # previously unvalidated, so a scalar slipped through CI and broke the build.
    for field in LIST_OF_STRING_FIELDS:
        value = data.get(field)
        if value is None:
            continue
        if not isinstance(value, list):
            errors.append(f"{field} must be a list of strings (got {type(value).__name__})")
            continue
        for i, item in enumerate(value):
            if not isinstance(item, str):
                errors.append(f"{field}[{i}] must be a string")
            elif item != item.strip():
                warnings.append(f"{field}[{i}] has surrounding whitespace: {item!r}")
        if len(value) > MAX_CLASSIFIERS:
            warnings.append(
                f"{field} has {len(value)} entries; the convention is at most "
                f"{MAX_CLASSIFIERS} — keep the most distinctive"
            )

    # Validate themes (warn on non-standard, don't error — the portfolio grows
    # faster than the enum)
    themes = data.get("themes")
    if isinstance(themes, list):
        for theme in themes:
            if isinstance(theme, str) and theme not in VALID_THEMES:
                warnings.append(f"Non-standard theme: '{theme}'. Standard themes: {VALID_THEMES}")

    # What conceptual layer the work targets (capability / infra / feature).
    # Optional, but warned on so the portfolio stays classifiable.
    targets = data.get("targets")
    if targets is None:
        warnings.append(
            f"Missing targets — set one of {VALID_TARGETS} "
            "(see docs/experiments-process.md#what-an-experiment-targets)"
        )
    elif targets not in VALID_TARGETS:
        errors.append(f"Invalid targets: {targets}. Must be one of {VALID_TARGETS}")

    # Validate demo config if enabled
    demo = data.get("demo") or {}
    if not isinstance(demo, dict):
        errors.append("demo must be a mapping")
        demo = {}
    if demo.get("enabled"):
        demo_type = demo.get("type")
        if demo_type and demo_type not in VALID_DEMO_TYPES:
            errors.append(f"Invalid demo type: {demo_type}. Must be one of {VALID_DEMO_TYPES}")
        if not demo.get("output_dir"):
            errors.append("Demo enabled but no output_dir specified")
        build_command = demo.get("build_command")
        if build_command is not None and not isinstance(build_command, str):
            errors.append("demo.build_command must be a string")

    # Prototype demo warning (reference scaffolds are exempt — example-experiment
    # exists to show file structure, not to ship a demo)
    slug = data.get("slug") or exp_dir.name
    if exp_type == "prototype" and not demo.get("enabled") and slug not in REFERENCE_SCAFFOLDS:
        warnings.append("'prototype' experiments typically have demo.enabled: true")

    # Unfilled template boilerplate is an error, not a warning: `description`
    # propagates into the deployed demo's <meta> tags (sync-demo-meta.py) and
    # onto the generated social card, and a literal "YYYY-MM-DD" in updated_at
    # sorts above every real date on the hub home page.
    for field in PLACEHOLDER_CHECKED_FIELDS:
        if is_placeholder(data.get(field)):
            errors.append(
                f"{field} is unfilled template text ({data[field]!r}) — "
                "run `uv run .github/scripts/fill-metadata.py` or set it by hand"
            )

    # Results validation
    results = data.get("results", {})
    if isinstance(results, dict):
        learnings = results.get("learnings")
        if learnings is not None:
            if not isinstance(learnings, list):
                errors.append("results.learnings must be a list of strings")
            elif learnings:
                for i, learning in enumerate(learnings):
                    if not isinstance(learning, str):
                        errors.append(f"results.learnings[{i}] must be a string")

        # Warn if done without learnings
        if status == "done" and (not learnings or len(learnings) == 0):
            warnings.append("Done experiment should have results.learnings")

    # Done experiments need a results block with a summary — unless the close-out is
    # legitimately still in progress.
    #
    # A partial close-out is a normal, common state: the build is finished and the
    # learnings are real, but a signal can't be answered until colleagues finish
    # testing or an eval runs. Warning about it makes `just validate-strict` fail on a
    # brief that is exactly as complete as it honestly can be — and that command is
    # what the PR checklist asks for, so the author's only options were to fabricate a
    # verdict or ignore the gate. Neither is what we want.
    #
    # So: warn only when nobody has started writing After. Once it's underway, the
    # empty pieces are reported by the coach's pending advisory (`just doctor`), which
    # keeps them visible without blocking the PR.
    if status == "done":
        after_underway = bool(body) and experiment_doc.after_is_underway(body)
        if not isinstance(results, dict) or not results:
            if not after_underway:
                warnings.append("Done experiment has no results block (results: null/missing)")
        else:
            summary = results.get("summary")
            empty_summary = summary is None or (isinstance(summary, str) and not summary.strip())
            if empty_summary and not after_underway:
                warnings.append(
                    "Done experiment should have results.summary — add an "
                    "`**Outcome:**` line at the top of the brief's After section"
                )

    # Date format validation.
    # and it was previously unchecked.
    for date_field in ["created_at", "updated_at"]:
        value = data.get(date_field)
        if value and not isinstance(value, (str, type(None))):
            # YAML might parse dates as date objects, which is fine
            try:
                str(value)
            except Exception:
                errors.append(f"{date_field} must be a valid date")

    # brief.md is the artifact every content gate is built around, so its
    # absence is worth surfacing rather than discovering on the rendered page.
    if slug not in REFERENCE_SCAFFOLDS and not (exp_dir / "brief.md").exists():
        warnings.append(
            "No brief.md — the hub renders the experiment detail page with no narrative"
        )

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


def metadata_path(exp_dir: Path) -> Path | None:
    """The file that holds this experiment's metadata, if it has any."""
    brief = exp_dir / "brief.md"
    if brief.exists() and experiment_doc.load(brief).has_frontmatter:
        return brief
    return None


def fix_experiment(path: Path) -> tuple[str, str, list[str]]:
    """Compute normalizing fixes for one brief's frontmatter block.

    Returns (original_text, fixed_text, descriptions). Operates on raw text so
    comments and formatting are preserved; uses the parsed YAML only to decide
    what needs fixing. The text is the frontmatter only — the markdown body is
    never touched.
    """
    original = experiment_doc.load(path).frontmatter_text or ""
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
            "results:\n  summary: null\n  learnings: []",
            text,
            count=1,
            flags=re.MULTILINE,
        )
        if n:
            text = new_text
            fixes.append("normalize empty results block to {summary: null, learnings: []}")

    # Half-empty results: `summary:` / `learnings:` present as bare keys parse to
    # None, which the whole-block normalizer above deliberately skips. Give them
    # explicit empty values so the shape is uniform.
    results = data.get("results")
    if isinstance(results, dict):
        for key, empty in (("summary", "null"), ("learnings", "[]")):
            if key in results and results[key] is None:
                new_text, n = re.subn(
                    rf"^(\s+){key}:[ \t]*(#[^\n]*)?$",
                    rf"\g<1>{key}: {empty}",
                    text,
                    count=1,
                    flags=re.MULTILINE,
                )
                if n:
                    text = new_text
                    fixes.append(f"give empty results.{key} an explicit value ({empty})")

    # updated_at: fill from git history when missing
    if "updated_at" not in data:
        last = git_last_modified(path.parent)
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
        help="Propose normalizing fixes as diffs (results shape, updated_at)",
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

        if not (exp_dir / "brief.md").exists():
            all_errors[str(exp_dir)] = ["No brief.md — every experiment's metadata lives there"]
            continue

        total_experiments += 1

        if args.fix:
            target = metadata_path(exp_dir)
            if target is None:
                continue
            original, fixed, fixes = fix_experiment(target)
            if fixes:
                rel = target.relative_to(REPO_ROOT)
                print(f"\n{rel}: {'; '.join(fixes)}")
                diff = difflib.unified_diff(
                    original.splitlines(keepends=True),
                    fixed.splitlines(keepends=True),
                    fromfile=f"a/{rel}",
                    tofile=f"b/{rel}",
                )
                sys.stdout.writelines(diff)
                if args.write:
                    # Bind `fixed` explicitly: the lambda is called immediately,
                    # but a late-binding closure over a loop variable is a trap
                    # worth not leaving in a writer.
                    experiment_doc.edit_frontmatter(target, lambda _, new=fixed: new)
                total_fixes += len(fixes)
                fixed_files += 1

        errors, warnings = validate_experiment(exp_dir, strict=args.strict)

        if errors:
            all_errors[str(exp_dir)] = errors
        if warnings:
            all_warnings[str(exp_dir)] = warnings

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
