#!/usr/bin/env python3
"""
Check that the committed CI pipeline is self-contained.

Usage: python3 .github/scripts/check-committed.py

CI runs from a fresh checkout, which contains only *committed* files. A tracked
script that imports an untracked sibling, or a tracked workflow that runs an
untracked script, works perfectly on the author's machine and fails on every PR.
This checks for that class of mistake before it lands.

What it enforces:
  1. `.github/scripts/` and `.github/templates/` are fully tracked. They are
     build infrastructure — there is no reason for a local-only file to live there.
  2. Every module a tracked script imports from its own directory is tracked.
  3. Every `.github/scripts/...` path named in a tracked workflow is tracked.

Deliberately NOT checked: `docs/`, `AGENTS.md`, `insights/`, `tests/` and friends
are untracked on purpose. Their fallout is handled where it matters —
`check-docs.py` for dead links, `assertInsightsPresent` for the hub build.

Deliberately stdlib-only, so it runs without `uv`.
"""

import re
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]

#: Trees that CI needs in full. A file here that isn't committed is a landmine.
MUST_BE_TRACKED = [".github/scripts", ".github/templates", ".github/workflows"]

IMPORT_RE = re.compile(r"^\s*(?:import|from)\s+([a-zA-Z_][a-zA-Z0-9_]*)", re.MULTILINE)
SCRIPT_REF_RE = re.compile(r"\.github/scripts/([a-zA-Z0-9_.-]+\.(?:py|sh))")


def tracked_files() -> set[str]:
    out = subprocess.run(
        ["git", "ls-files"], cwd=REPO_ROOT, capture_output=True, text=True, check=True
    ).stdout
    return set(out.split("\n"))


def rel(path: Path) -> str:
    return str(path.relative_to(REPO_ROOT))


def main() -> int:
    try:
        tracked = tracked_files()
    except (FileNotFoundError, subprocess.CalledProcessError):
        print("note: not a git checkout — skipping", file=sys.stderr)
        return 0

    problems: list[str] = []

    # 1. Whole-tree coverage.
    for tree in MUST_BE_TRACKED:
        tree_path = REPO_ROOT / tree
        if not tree_path.is_dir():
            continue
        for path in sorted(tree_path.rglob("*")):
            if not path.is_file():
                continue
            name = rel(path)
            if "__pycache__" in name or path.name == ".DS_Store":
                continue
            if name not in tracked:
                problems.append(f"{name} is not committed, but CI needs {tree}/ in full")

    # 2. Sibling imports of tracked scripts.
    scripts_dir = REPO_ROOT / ".github" / "scripts"
    local_modules = {p.stem: rel(p) for p in scripts_dir.glob("*.py")}
    for path in sorted(scripts_dir.glob("*.py")):
        if rel(path) not in tracked:
            continue  # covered by check 1
        for module in set(IMPORT_RE.findall(path.read_text())):
            target = local_modules.get(module)
            if target and target not in tracked:
                problems.append(f"{rel(path)} (tracked) imports {module}, but {target} is not")

    # 3. Scripts referenced by tracked workflows.
    for path in sorted((REPO_ROOT / ".github" / "workflows").glob("*.yml")):
        if rel(path) not in tracked:
            continue
        for script in set(SCRIPT_REF_RE.findall(path.read_text())):
            target = f".github/scripts/{script}"
            if not (REPO_ROOT / target).exists():
                problems.append(f"{rel(path)} runs {target}, which doesn't exist")
            elif target not in tracked:
                problems.append(f"{rel(path)} runs {target}, which is not committed")

    if problems:
        # Deduplicate while keeping order; check 1 and 2 overlap by design.
        seen, ordered = set(), []
        for p in problems:
            if p not in seen:
                seen.add(p)
                ordered.append(p)
        print(f"The committed pipeline is not self-contained ({len(ordered)} problems):\n")
        for problem in ordered:
            print(f"  - {problem}")
        print(
            "\nCI checks out only committed files, so these would fail on a PR while "
            "working fine locally.\nCommit them (`git add` the paths above) or remove the reference."
        )
        return 1

    print("✓ Committed pipeline is self-contained (CI can run everything it references)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
