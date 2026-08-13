#!/usr/bin/env python3
# /// script
# dependencies = [
#   "pyyaml"
# ]
# ///
"""
Sync the SEO / social meta block in each demo's static app.html from the
experiment's metadata (brief.md frontmatter + lede).

Demos are `ssr: false` static SPAs, so social crawlers never run their client-side
JS — the meta tags MUST live in the prerendered app.html shell. The brief (title,
description) is the single source of truth; this script projects it into a
marker-delimited block so the two never drift.

The OG image URL points at the hub-generated card (dist/og/{slug}.png), which is
referenced by both the hub detail page and the demo itself.

Usage:
  python .github/scripts/sync-demo-meta.py            # rewrite all demo app.html
  python .github/scripts/sync-demo-meta.py --check     # exit 1 if any are stale
  python .github/scripts/sync-demo-meta.py slug ...    # limit to specific slugs

  uv run .github/scripts/sync-demo-meta.py [...]
"""

import argparse
import html
import re
import sys
from pathlib import Path

import experiment_doc

REPO_ROOT = Path(__file__).resolve().parents[2]
EXPERIMENTS_DIR = REPO_ROOT / "experiments"

ORIGIN = "https://wri.github.io"
BASE = "/applied-ai-experiments"
SITE = f"{ORIGIN}{BASE}"
SITE_NAME = "WRI Applied AI Experiments"
TITLE_SUFFIX = "Applied AI Experiments"

START = "<!-- SEO:START (generated from brief.md by sync-demo-meta.py — do not edit by hand) -->"
END = "<!-- SEO:END -->"

# Lines we own and regenerate. Legacy/hand-written versions (outside the markers)
# are stripped before the fresh block is inserted, so there are never duplicates.
OWNED_LINE = re.compile(
    r"^\s*(?:"
    r"<title>.*</title>"
    r'|<meta\s+name="description".*'
    r'|<meta\s+name="twitter:.*'
    r'|<meta\s+property="og:.*'
    r'|<link\s+rel="canonical".*'
    r")\s*$"
)


def collapse(text: str) -> str:
    """YAML folded scalars carry newlines; meta wants a single clean line."""
    return re.sub(r"\s+", " ", str(text)).strip()


def build_block(slug: str, title: str, description: str, indent: str = "\t\t") -> str:
    full_title = f"{title} | {TITLE_SUFFIX}"
    url = f"{SITE}/{slug}/"
    img = f"{SITE}/og/{slug}.png"
    alt = f"{title} — {SITE_NAME}"

    def esc(s: str) -> str:
        return html.escape(s, quote=True)

    t, d, u, i, a = esc(full_title), esc(description), url, img, esc(alt)
    lines = [
        START,
        f"<title>{t}</title>",
        f'<meta name="description" content="{d}" />',
        f'<link rel="canonical" href="{u}" />',
        '<meta property="og:type" content="website" />',
        f'<meta property="og:title" content="{t}" />',
        f'<meta property="og:description" content="{d}" />',
        f'<meta property="og:url" content="{u}" />',
        f'<meta property="og:site_name" content="{esc(SITE_NAME)}" />',
        '<meta property="og:locale" content="en_US" />',
        f'<meta property="og:image" content="{i}" />',
        '<meta property="og:image:width" content="1200" />',
        '<meta property="og:image:height" content="630" />',
        f'<meta property="og:image:alt" content="{a}" />',
        '<meta name="twitter:card" content="summary_large_image" />',
        f'<meta name="twitter:title" content="{t}" />',
        f'<meta name="twitter:description" content="{d}" />',
        f'<meta name="twitter:image" content="{i}" />',
        f'<meta name="twitter:image:alt" content="{a}" />',
        END,
    ]
    return "\n".join(f"{indent}{ln}" for ln in lines)


def render(app_html: str, slug: str, title: str, description: str) -> str:
    """Return app.html with a freshly generated SEO block before %sveltekit.head%.

    Line-based so indentation/newlines stay stable (idempotent): drop the old
    marker block + any legacy owned lines, then insert the fresh block.
    """
    # Detect the block by stable tokens so a marker carrying a trailing note
    # (e.g. the template's SEO:END hint) is still recognised.
    kept = []
    skipping = False
    for ln in app_html.splitlines():
        if "SEO:START" in ln:
            skipping = True
            continue
        if "SEO:END" in ln:
            skipping = False
            continue
        if skipping or OWNED_LINE.match(ln):
            continue
        kept.append(ln)

    block_lines = build_block(slug, title, description).split("\n")
    out = []
    inserted = False
    for ln in kept:
        if "%sveltekit.head%" in ln and not inserted:
            out.extend(block_lines)
            inserted = True
        out.append(ln)
    if not inserted:
        raise SystemExit(f"  ✗ {slug}: no %sveltekit.head% marker found in app.html")

    return "\n".join(out) + "\n"


def iter_demos(only: list[str]):
    for exp_dir in sorted(EXPERIMENTS_DIR.iterdir()):
        if not exp_dir.is_dir() or exp_dir.name.startswith("."):
            continue
        if only and exp_dir.name not in only:
            continue
        meta, body, error = experiment_doc.load_meta(exp_dir)
        if error or not meta:
            continue
        data = dict(meta)
        # description lives in the brief body now; fall back to the YAML copy.
        if body:
            desc = experiment_doc.extract_description(body)
            if desc:
                data["description"] = desc
        demo = data.get("demo") or {}
        if not demo.get("enabled"):
            continue
        app_html = exp_dir / "demo" / "src" / "app.html"
        if not app_html.exists():
            continue
        slug = exp_dir.name  # matches the deploy path (build-demos.sh uses basename)
        title = collapse(data.get("title") or slug)
        description = collapse(data.get("description") or title)
        yield slug, app_html, title, description


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("slugs", nargs="*", help="Limit to specific experiment slugs")
    parser.add_argument("--check", action="store_true", help="Exit 1 if any app.html is stale")
    args = parser.parse_args()

    stale, written = [], []
    for slug, app_html, title, description in iter_demos(args.slugs):
        current = app_html.read_text()
        updated = render(current, slug, title, description)
        if current == updated:
            continue
        if args.check:
            stale.append(slug)
        else:
            app_html.write_text(updated)
            written.append(slug)

    if args.check:
        if stale:
            print("✗ Demo SEO meta is stale (run: python .github/scripts/sync-demo-meta.py):")
            for s in stale:
                print(f"  - {s}")
            return 1
        print("✓ Demo SEO meta is in sync with brief.md")
        return 0

    if written:
        print(f"Updated SEO meta in {len(written)} demo(s): {', '.join(written)}")
    else:
        print("All demo SEO meta already in sync")
    return 0


if __name__ == "__main__":
    sys.exit(main())
