#!/usr/bin/env python3
"""
Fill Metadata Script - Populate a new experiment's metadata from CLI arguments

Usage:
    fill-metadata.py <experiment-path> [options]

Options:
    --title TEXT         Experiment title
    --description TEXT   Short description
    --type TYPE          Experiment type (auto-detected from the metadata if not specified)
    --theme THEME        Primary theme (can specify multiple: --theme evals --theme agents)
    --targets TARGET     capability | infra | feature

Examples:
    fill-metadata.py experiments/my-prototype --title "Chat Interface"
    fill-metadata.py experiments/my-spike --title "Test Redis" --targets infra
"""

import argparse
import re
import shutil
import subprocess
import sys
import textwrap
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import experiment_doc  # noqa: E402
from experiment_schema import VALID_TARGETS  # noqa: E402


def update_yaml_field(content: str, field: str, value: str, is_multiline: bool = False) -> str:
    """Replace a YAML field value, handling CHANGEME placeholders."""
    if is_multiline:
        # Match multiline scalar (e.g., description: >\n  CHANGEME...)
        pattern = rf"^({field}:\s*>\s*\n)(\s+).*?(?=\n[a-z_]|\Z)"
        replacement = rf"\1\2{value}"
        return re.sub(pattern, replacement, content, flags=re.MULTILINE | re.DOTALL)
    else:
        # Match simple field: value (capture field name and colon, replace value)
        pattern = rf"^({field}:)\s*.*$"
        replacement = rf"\1 {value}"
        return re.sub(pattern, replacement, content, flags=re.MULTILINE)


def fill_metadata(experiment_path: Path, args: argparse.Namespace) -> bool:
    """Fill the brief's frontmatter with the provided values."""
    brief_path = experiment_path / "brief.md"
    if not brief_path.exists():
        print(f"Error: no brief.md in {experiment_path}")
        return False

    content = experiment_doc.load(brief_path).frontmatter_text or ""
    today = date.today().isoformat()

    # Detect experiment type from the frontmatter the template shipped
    type_match = re.search(r"^type:\s*(\w+)", content, re.MULTILINE)
    exp_type = args.type or (type_match.group(1) if type_match else None)

    # Get slug from directory name
    slug = experiment_path.name

    # Update standard fields
    if "CHANGEME" in content:
        # Replace slug
        content = content.replace("slug: CHANGEME", f"slug: {slug}")

        # Replace dates
        content = content.replace("YYYY-MM-DD", today)

        # Title
        if args.title:
            # Handle spike prefix
            if exp_type == "spike" and not args.title.startswith("Spike:"):
                title_value = f'"Spike: {args.title}"'
            else:
                title_value = f'"{args.title}"'
            content = update_yaml_field(content, "title", title_value)

        # Description is NOT written here — it lives in the brief's lede
        # blockquote and is read from there. See fill_brief() below.

    # Templates ship `targets:` empty for the author to choose, but an empty
    # `targets` is a validator warning — and `just validate-strict` (which the PR
    # checklist asks for) turns warnings into errors. Filling it at scaffold time
    # is what makes a fresh experiment strict-clean with no hand edits.
    if args.targets:
        content = re.sub(
            r"^targets:[ \t]*(?=$|\s+#)",
            f"targets: {args.targets}",
            content,
            count=1,
            flags=re.MULTILINE,
        )

    # Update themes if provided. Templates ship the inline empty form
    # (`themes: []  # comment`); a filled brief carries the block form. Handle
    # both, and keep any trailing comment — it's the enum crib sheet.
    if args.theme:
        theme_yaml = "\n".join(f"  - {t}" for t in args.theme)
        content, n = re.subn(
            r"^themes:[ \t]*\[[^\]]*\][ \t]*(?P<comment>#[^\n]*)?$",
            lambda m: (
                f"themes:{' ' + m.group('comment') if m.group('comment') else ''}\n{theme_yaml}"
            ),
            content,
            count=1,
            flags=re.MULTILINE,
        )
        if not n:
            content = re.sub(
                r"^themes:[ \t]*\n(?:[ \t]+-[ \t]+\S+\n?)+",
                f"themes:\n{theme_yaml}\n",
                content,
                count=1,
                flags=re.MULTILINE,
            )

    # Append extra tags to whatever the template seeded (`tags: []` in the
    # minimal template, a block list with the type tag everywhere else).
    if args.tag:
        tag_lines = "\n".join(f"  - {t}" for t in args.tag)
        content, n = re.subn(
            r"^tags:[ \t]*\[[^\]]*\][ \t]*(?P<comment>#[^\n]*)?$",
            lambda m: f"tags:{' ' + m.group('comment') if m.group('comment') else ''}\n{tag_lines}",
            content,
            count=1,
            flags=re.MULTILINE,
        )
        if not n:
            block = re.search(r"^tags:[ \t]*\n(?:[ \t]+-[ \t]+\S+\n)+", content, re.MULTILINE)
            if block:
                content = content[: block.end()] + tag_lines + "\n" + content[block.end() :]

    # Write updated content
    experiment_doc.edit_frontmatter(brief_path, lambda _: content)
    print(f"Updated {brief_path}")

    # The brief body owns the title (H1) and the description (lede blockquote);
    # every reader extracts them from there.
    fill_brief(experiment_path, args.title, args.description)

    # Handle prototype-specific files
    if exp_type == "prototype":
        update_prototype_files(experiment_path, slug)
        sync_demo_meta(experiment_path, slug)

    return True


def fill_brief(experiment_path: Path, title: str | None, description: str | None) -> None:
    """Replace the brief's H1 and lede-blockquote placeholders."""
    brief = experiment_path / "brief.md"
    if not brief.exists():
        return
    text = brief.read_text()
    if title:
        text = re.sub(r"^# \{Experiment Title\}", f"# {title}", text, count=1, flags=re.MULTILINE)
    if description:
        # The template ships the lede as an angle-bracket placeholder that may
        # wrap over several `>` lines; replace the whole run with one blockquote.
        lines = textwrap.wrap(description, 100, break_on_hyphens=False)
        wrapped = "\n".join(f"> {ln}" for ln in lines)
        text = re.sub(r"^> <[\s\S]*?>\s*$", wrapped, text, count=1, flags=re.MULTILINE)
    brief.write_text(text)


def sync_demo_meta(experiment_path: Path, slug: str) -> None:
    """Populate the demo's app.html SEO block from the now-filled brief.

    Delegates to the canonical sync script so there's one implementation. Run via
    `uv run` so its pyyaml dep resolves regardless of the current environment.
    """
    app_html = experiment_path / "demo" / "src" / "app.html"
    if not app_html.exists():
        return
    repo_root = experiment_path.parent.parent
    sync_script = repo_root / ".github" / "scripts" / "sync-demo-meta.py"
    if not sync_script.exists():
        return

    cmd = (
        ["uv", "run", str(sync_script)]
        if shutil.which("uv")
        else [sys.executable, str(sync_script)]
    ) + [slug]
    try:
        subprocess.run(cmd, cwd=repo_root, check=True)
        print(f"Synced SEO meta in {app_html}")
    except Exception as e:
        print(
            f"Note: couldn't auto-sync SEO meta ({e}). "
            f"Run: uv run .github/scripts/sync-demo-meta.py {slug}"
        )


def update_prototype_files(experiment_path: Path, slug: str) -> None:
    """Update prototype-specific files (package.json; svelte.config.js derives the slug itself)."""
    package_json = experiment_path / "demo" / "package.json"
    if package_json.exists():
        content = package_json.read_text()
        if "proto-CHANGEME" in content:
            content = content.replace("proto-CHANGEME", slug)
            package_json.write_text(content)
            print(f"Updated {package_json}")


def main():
    parser = argparse.ArgumentParser(
        description="Fill a brief's frontmatter metadata from CLI arguments",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("experiment_path", type=Path, help="Path to experiment directory")
    parser.add_argument("--title", help="Experiment title")
    parser.add_argument("--description", help="Short description")
    parser.add_argument(
        "--type",
        choices=["prototype", "evaluation", "benchmark", "spike", "research", "notebook", "marimo"],
        help="Experiment type (usually auto-detected)",
    )
    parser.add_argument("--theme", action="append", help="Theme(s) for the experiment")
    parser.add_argument(
        "--tag", action="append", help="Extra tag(s), appended to the template's seed tag"
    )
    parser.add_argument(
        "--targets",
        choices=sorted(VALID_TARGETS),
        help="What layer the work aims at (fills the template's empty `targets:`)",
    )

    args = parser.parse_args()

    experiment_path = args.experiment_path.resolve()
    if not experiment_path.exists():
        print(f"Error: Experiment path does not exist: {experiment_path}")
        sys.exit(1)

    success = fill_metadata(experiment_path, args)
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
