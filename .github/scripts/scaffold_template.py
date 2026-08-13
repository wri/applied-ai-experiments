#!/usr/bin/env python3
"""
Compose an experiment scaffold from `.github/templates/_shared/` + a type template.

`_shared/` holds the one canonical `brief.md` and `README.md`; each type directory
holds only what differs (its `frontmatter.yaml`, plus any type-specific dirs). Scaffolding
copies `_shared/` first and then overlays the type directory, so a type directory
can override a shared file simply by shipping its own copy — `prototype-byok`
does exactly that with `README.md`.

Directories whose name starts with `_` are composition inputs, not templates, and
are hidden from every listing. This is the single place that rule lives; callers
(justfile, create-experiment-from-issue.py, smoke-scaffold.sh) go through here so
a new `_foo/` directory can never be scaffolded as if it were an experiment type.

Deliberately stdlib-only (no pyyaml), so `python3` works without `uv`.

Usage:
  python3 .github/scripts/scaffold-template.py --list
  python3 .github/scripts/scaffold-template.py --template prototype --dest experiments/my-thing
"""

import argparse
import shutil
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
TEMPLATES_DIR = REPO_ROOT / ".github" / "templates"
SHARED_DIR_NAME = "_shared"


#: One-line description per template, and the only place they live. The justfile's
#: picker and `just list-templates` both read them from here; keeping a second copy
#: in the justfile meant a new template showed up nameless in one place and
#: described in another.
DESCRIPTIONS = {
    "spike": "Time-boxed investigation (1-2 days)",
    "prototype": "Interactive demo with SvelteKit (minimal scaffold)",
    "prototype-byok": "BYOK LLM demo — golden path (model selector, runLLM, telemetry, SEO)",
    "evaluation": "Formal comparison with metrics",
    "benchmark": "Dataset-based model evaluation",
    "research": "User research with interviews",
    "notebook": "Jupyter notebook exploration",
    "marimo": "Marimo notebook exploration",
    "experiment-minimal": "Basic experiment structure",
}


def is_template(path: Path) -> bool:
    """A template is a directory that isn't a composition input."""
    return path.is_dir() and not path.name.startswith("_")


def describe(template: str) -> str:
    return DESCRIPTIONS.get(template, "")


def list_templates(templates_dir: Path = TEMPLATES_DIR) -> list[str]:
    if not templates_dir.is_dir():
        return []
    return sorted(d.name for d in templates_dir.iterdir() if is_template(d))


def scaffold(template: str, dest: Path, templates_dir: Path = TEMPLATES_DIR) -> None:
    """Copy _shared/ then overlay the type template. The type template wins."""
    template_dir = templates_dir / template

    if template.startswith("_") or not template_dir.is_dir():
        available = ", ".join(list_templates(templates_dir)) or "(none)"
        raise SystemExit(f"Unknown template '{template}'. Available: {available}")

    if dest.exists() and any(dest.iterdir()):
        raise SystemExit(f"Destination '{dest}' already exists and is not empty.")

    dest.mkdir(parents=True, exist_ok=True)

    shared = templates_dir / SHARED_DIR_NAME
    if shared.is_dir():
        shutil.copytree(shared, dest, dirs_exist_ok=True)
    # Overlaid second so a type template can override any shared file.
    shutil.copytree(template_dir, dest, dirs_exist_ok=True)

    # brief.md is composed, not copied: `_shared/brief.md` is the one canonical
    # body, and each type template supplies only the frontmatter that differs
    # (its `type`, seed tag, and demo block). Keeping whole briefs per template
    # is what let the nine copies drift apart in the first place.
    fragment = dest / "frontmatter.yaml"
    brief = dest / "brief.md"
    if fragment.exists() and brief.exists():
        body = brief.read_text().lstrip("\n")
        frontmatter = fragment.read_text().strip("\n")
        brief.write_text(f"---\n{frontmatter}\n---\n\n{body}")
        fragment.unlink()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--list", action="store_true", help="print one template name per line")
    parser.add_argument(
        "--describe", action="store_true", help="with --list: append each template's description"
    )
    parser.add_argument("--template", help="template name to scaffold from")
    parser.add_argument("--dest", help="destination directory")
    args = parser.parse_args()

    if args.list:
        names = list_templates()
        if not names:
            print(f"No templates found under '{TEMPLATES_DIR}'.", file=sys.stderr)
            return 1
        if args.describe:
            width = max(len(n) for n in names)
            for name in names:
                print(f"{name:<{width}}  {describe(name)}".rstrip())
        else:
            print("\n".join(names))
        return 0

    if not args.template or not args.dest:
        parser.error("--template and --dest are required (or use --list)")

    scaffold(args.template, Path(args.dest))
    return 0


if __name__ == "__main__":
    sys.exit(main())
