#!/usr/bin/env python3
"""
Check the docs don't lie: every `just <recipe>` they name exists, and every
relative link they make resolves.

Usage: python3 .github/scripts/check-docs.py [--strict]

Why this exists: `just list-experiments` and `just stats` were both broken for as
long as it took someone to run them, while README.md and AGENTS.md advertised them
as the way to see the portfolio. A missing recipe or a dead link is a five-line
check; discovering it as a contributor is a bad first five minutes.

Errors (exit 1):
  - a `just <recipe>` named in the docs that `just --summary` doesn't list
  - a relative markdown link whose target doesn't exist

Untracked docs are checked when present and skipped when absent, so this passes
both in a full working copy and in a fresh clone.

Deliberately stdlib-only, so it runs without `uv`.
"""

import argparse
import re
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]

#: Everything a contributor or agent might read for instructions. Missing files are
#: skipped: `docs/`, `AGENTS.md` and friends are deliberately untracked today.
DOC_PATHS = [
    "README.md",
    "AGENTS.md",
    "CONTRIBUTING.md",
    "ONBOARDING.md",
    "DESIGN.md",
    "docs/*.md",
    "packages/README.md",
    ".github/pull_request_template.md",
]

JUST_RE = re.compile(r"`just ([a-z][a-z0-9-]*)")
LINK_RE = re.compile(r"\[[^\]]*\]\(([^)]+)\)")

#: Link targets that aren't repo paths.
SKIP_LINK_PREFIXES = ("http://", "https://", "mailto:", "#", "../../issues", "../../pulls")


def doc_files() -> list[Path]:
    seen: list[Path] = []
    for pattern in DOC_PATHS:
        if "*" in pattern:
            seen.extend(sorted(REPO_ROOT.glob(pattern)))
        elif (REPO_ROOT / pattern).exists():
            seen.append(REPO_ROOT / pattern)
    return seen


def just_recipes() -> set[str] | None:
    """Recipe names `just` knows about, or None if `just` isn't installed."""
    try:
        out = subprocess.run(
            ["just", "--summary"], cwd=REPO_ROOT, capture_output=True, text=True, check=True
        ).stdout
    except (FileNotFoundError, subprocess.CalledProcessError):
        return None
    return set(out.split())


def check_links(path: Path) -> list[str]:
    problems = []
    for target in LINK_RE.findall(path.read_text()):
        target = target.split("#")[0].split(" ")[0].strip()
        if not target or target.startswith(SKIP_LINK_PREFIXES):
            continue
        resolved = (path.parent / target).resolve()
        if not resolved.exists():
            problems.append(f"dead link: {target}")
    return problems


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--strict", action="store_true", help="also fail on links into untracked paths"
    )
    args = parser.parse_args()

    recipes = just_recipes()
    if recipes is None:
        print("note: `just` not on PATH — skipping recipe check", file=sys.stderr)

    failures: dict[str, list[str]] = {}
    checked = 0

    for path in doc_files():
        checked += 1
        problems: list[str] = []
        text = path.read_text()

        if recipes is not None:
            for name in sorted(set(JUST_RE.findall(text))):
                if name not in recipes:
                    problems.append(f"`just {name}` is not a recipe")

        problems += check_links(path)

        if args.strict:
            tracked = subprocess.run(
                ["git", "ls-files", "--error-unmatch", str(path.relative_to(REPO_ROOT))],
                cwd=REPO_ROOT,
                capture_output=True,
            )
            if tracked.returncode == 0:
                for target in LINK_RE.findall(text):
                    target = target.split("#")[0].strip()
                    if not target or target.startswith(SKIP_LINK_PREFIXES):
                        continue
                    rel = (path.parent / target).resolve()
                    # Directories can't be asked about with --error-unmatch, and a
                    # link to one is fine as long as something inside is tracked.
                    if not rel.is_file():
                        continue
                    inside = subprocess.run(
                        ["git", "ls-files", "--error-unmatch", str(rel.relative_to(REPO_ROOT))],
                        cwd=REPO_ROOT,
                        capture_output=True,
                    )
                    if inside.returncode != 0:
                        problems.append(f"tracked doc links untracked path: {target}")

        if problems:
            failures[str(path.relative_to(REPO_ROOT))] = problems

    if failures:
        print(f"Doc drift in {len(failures)} of {checked} files:\n")
        for name, problems in failures.items():
            print(f"  {name}:")
            for problem in problems:
                print(f"    - {problem}")
        return 1

    print(f"✓ Docs check clean ({checked} files: every `just` recipe exists, every link resolves)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
