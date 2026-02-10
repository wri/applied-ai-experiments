#!/usr/bin/env python3
# /// script
# dependencies = [
#   "pyyaml"
# ]
# ///
"""
Parse a GitHub issue body (from the new-experiment form) and scaffold
an experiment directory from the matching template.

Expected env vars:
    ISSUE_BODY   – full markdown body of the issue
    ISSUE_NUMBER – issue number (for logging)
    ISSUE_AUTHOR – GitHub username of the issue author

Outputs (appended to $GITHUB_OUTPUT):
    slug, title, type, description
"""

import os
import re
import shutil
import sys
from datetime import date, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
TEMPLATES_DIR = REPO_ROOT / ".github" / "templates"
EXPERIMENTS_DIR = REPO_ROOT / "experiments"

# Duplicated from .github/scripts/validate-experiments.py (can't import – filename has hyphen)
VALID_TYPES = [
    "evaluation",
    "benchmark",
    "spike",
    "prototype",
    "research",
    "notebook",
    "marimo",
]
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

SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9-]*[a-z0-9]$")


# ---------------------------------------------------------------------------
# Issue body parsing
# ---------------------------------------------------------------------------


def parse_issue_body(body: str) -> dict[str, str]:
    """Parse GitHub issue form markdown into {field_name: value} dict.

    GitHub forms render as:
        ### Field Name\n\nvalue text\n\n### Next Field ...

    Checkboxes render as:
        - [X] checked
        - [ ] unchecked
    """
    sections: dict[str, str] = {}
    current_key: str | None = None
    current_lines: list[str] = []

    for line in body.splitlines():
        header_match = re.match(r"^###\s+(.+)$", line)
        if header_match:
            if current_key is not None:
                sections[current_key] = "\n".join(current_lines).strip()
            current_key = header_match.group(1).strip()
            current_lines = []
        else:
            current_lines.append(line)

    # Flush last section
    if current_key is not None:
        sections[current_key] = "\n".join(current_lines).strip()

    return sections


def parse_checkboxes(text: str) -> list[str]:
    """Return list of checked checkbox values from markdown checkbox syntax."""
    checked = []
    for line in text.splitlines():
        m = re.match(r"^-\s+\[([xX])\]\s+(.+)$", line)
        if m:
            checked.append(m.group(2).strip())
    return checked


def is_empty(value: str | None) -> bool:
    """Check if an optional field is empty or the GitHub '_No response_' sentinel."""
    if not value:
        return True
    return value.strip() in ("", "_No response_")


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------


def validate(fields: dict) -> list[str]:
    """Return list of validation errors (empty = valid)."""
    errors: list[str] = []

    # Required fields
    if is_empty(fields.get("title")):
        errors.append("Experiment Title is required")
    if is_empty(fields.get("slug")):
        errors.append("Slug is required")
    if is_empty(fields.get("type")):
        errors.append("Experiment Type is required")
    if is_empty(fields.get("description")):
        errors.append("Description is required")

    slug = (fields.get("slug") or "").strip()
    if slug:
        if len(slug) < 3 or len(slug) > 60:
            errors.append(f"Slug must be 3-60 characters, got {len(slug)}")
        if not SLUG_RE.match(slug):
            errors.append(
                f"Slug '{slug}' must be lowercase alphanumeric + hyphens, "
                "starting and ending with a letter or number"
            )
        if (EXPERIMENTS_DIR / slug).exists():
            errors.append(f"Experiment '{slug}' already exists")

    exp_type = (fields.get("type") or "").strip()
    if exp_type and exp_type not in VALID_TYPES:
        errors.append(f"Invalid type '{exp_type}'. Must be one of: {', '.join(VALID_TYPES)}")

    # Warn on unknown themes (non-fatal, but log)
    for theme in fields.get("themes", []):
        if theme not in VALID_THEMES:
            print(f"Warning: non-standard theme '{theme}'", file=sys.stderr)

    return errors


# ---------------------------------------------------------------------------
# Template filling
# ---------------------------------------------------------------------------


def fill_info_yaml(path: Path, fields: dict) -> None:
    """Replace placeholders in info.yaml using string replacement (preserves comments)."""
    text = path.read_text()
    today = date.today().isoformat()

    slug = fields["slug"]
    title = fields["title"]
    description = fields["description"]
    owner = fields["owner"]
    themes = fields.get("themes", [])
    user_tags = fields.get("tags", [])

    # Replace slug — handle both `slug: CHANGEME` and type-prefixed variants
    text = re.sub(
        r"^(slug:\s*).*$",
        rf"\g<1>{slug}",
        text,
        count=1,
        flags=re.MULTILINE,
    )

    # Replace title
    text = re.sub(
        r'^(title:\s*).*$',
        rf'\g<1>"{title}"',
        text,
        count=1,
        flags=re.MULTILINE,
    )

    # Replace type (set the correct type in case the template default differs)
    text = re.sub(
        r"^(type:\s*)\S+",
        rf"\g<1>{fields['type']}",
        text,
        count=1,
        flags=re.MULTILINE,
    )

    # Replace description (the YAML >-block line after `description: >`)
    text = re.sub(
        r"(description: >\n\s+)CHANGEME:.*",
        rf"\g<1>{description}",
        text,
        count=1,
    )

    # Replace owner
    text = re.sub(
        r'^(owner:\s*).*$',
        rf'\g<1>"{owner}"',
        text,
        count=1,
        flags=re.MULTILINE,
    )

    # Replace dates
    text = text.replace("YYYY-MM-DD", today)

    # Replace themes
    if themes:
        themes_yaml = "[" + ", ".join(themes) + "]"
    else:
        themes_yaml = "[]"
    text = re.sub(
        r"^(themes:\s*)\[.*?\]",
        rf"\g<1>{themes_yaml}",
        text,
        count=1,
        flags=re.MULTILINE,
    )

    # Append user tags to existing tags list
    if user_tags:
        # Find existing tags block and append new ones
        tag_lines = "\n".join(f"  - {tag}" for tag in user_tags)
        # If there's already a tags list with entries, append after the last `  - ...` line
        # If it's `tags: []`, replace with the list form
        if re.search(r"^tags:\s*\[\]", text, re.MULTILINE):
            existing_type_tag = fields["type"]
            all_tag_lines = f"  - {existing_type_tag}\n{tag_lines}" if existing_type_tag else tag_lines
            text = re.sub(
                r"^tags:\s*\[\].*$",
                f"tags:\n{all_tag_lines}",
                text,
                count=1,
                flags=re.MULTILINE,
            )
        else:
            # Tags already has entries (e.g. `- prototype`), append after last tag line
            # Find the tags: section and its indented items
            tag_section = re.search(r"^tags:\s*\n((?:\s+-\s+.+\n)*)", text, re.MULTILINE)
            if tag_section:
                insert_pos = tag_section.end()
                text = text[:insert_pos] + tag_lines + "\n" + text[insert_pos:]

    path.write_text(text)


def fill_prototype_extras(exp_dir: Path, fields: dict) -> None:
    """Replace prototype-specific placeholders in demo/ files."""
    slug = fields["slug"]
    title = fields["title"]
    description = fields["description"]

    # svelte.config.js: proto-CHANGEME → slug
    svelte_config = exp_dir / "demo" / "svelte.config.js"
    if svelte_config.exists():
        text = svelte_config.read_text()
        text = text.replace("proto-CHANGEME", slug)
        svelte_config.write_text(text)

    # package.json: proto-CHANGEME → slug
    package_json = exp_dir / "demo" / "package.json"
    if package_json.exists():
        text = package_json.read_text()
        text = text.replace("proto-CHANGEME", slug)
        package_json.write_text(text)

    # app.html: title, description, slug placeholders
    app_html = exp_dir / "demo" / "src" / "app.html"
    if app_html.exists():
        text = app_html.read_text()
        text = text.replace("CHANGEME: Experiment Title", title)
        text = text.replace("CHANGEME: Brief description of the experiment.", description)
        text = text.replace("CHANGEME-SLUG", slug)
        app_html.write_text(text)


def set_github_output(key: str, value: str) -> None:
    """Append key=value to $GITHUB_OUTPUT file."""
    output_file = os.environ.get("GITHUB_OUTPUT")
    if output_file:
        with open(output_file, "a") as f:
            f.write(f"{key}={value}\n")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> None:
    issue_body = os.environ.get("ISSUE_BODY", "")
    issue_number = os.environ.get("ISSUE_NUMBER", "?")
    issue_author = os.environ.get("ISSUE_AUTHOR", "")

    if not issue_body:
        print("Error: ISSUE_BODY is empty", file=sys.stderr)
        sys.exit(1)

    # Parse the form fields from the issue markdown
    sections = parse_issue_body(issue_body)

    fields: dict = {
        "title": sections.get("Experiment Title", "").strip(),
        "slug": sections.get("Slug", "").strip().lower(),
        "type": sections.get("Experiment Type", "").strip().lower(),
        "description": sections.get("Description", "").strip(),
        "owner": sections.get("Owner", "").strip(),
        "themes": parse_checkboxes(sections.get("Themes", "")),
        "tags": [],
        "context": sections.get("Additional Context", "").strip(),
    }

    # Parse comma-separated tags
    raw_tags = sections.get("Tags", "").strip()
    if raw_tags and raw_tags != "_No response_":
        fields["tags"] = [t.strip() for t in raw_tags.split(",") if t.strip()]

    # Default owner to issue author
    if is_empty(fields["owner"]):
        fields["owner"] = issue_author
    # Strip leading @ from owner if present
    if fields["owner"].startswith("@"):
        fields["owner"] = fields["owner"][1:]

    print(f"Issue #{issue_number} by @{issue_author}")
    print(f"  Title:       {fields['title']}")
    print(f"  Slug:        {fields['slug']}")
    print(f"  Type:        {fields['type']}")
    print(f"  Description: {fields['description'][:80]}...")
    print(f"  Owner:       {fields['owner']}")
    print(f"  Themes:      {fields['themes']}")
    print(f"  Tags:        {fields['tags']}")

    # Validate
    errors = validate(fields)
    if errors:
        print("\nValidation errors:", file=sys.stderr)
        for err in errors:
            print(f"  - {err}", file=sys.stderr)
        sys.exit(1)

    # Copy template
    template_dir = TEMPLATES_DIR / fields["type"]
    exp_dir = EXPERIMENTS_DIR / fields["slug"]

    if not template_dir.exists():
        print(f"Error: template directory not found: {template_dir}", file=sys.stderr)
        sys.exit(1)

    print(f"\nCopying template {fields['type']} → experiments/{fields['slug']}/")
    shutil.copytree(template_dir, exp_dir)

    # Fill placeholders
    info_yaml = exp_dir / "info.yaml"
    if info_yaml.exists():
        fill_info_yaml(info_yaml, fields)

    # Prototype-specific replacements
    if fields["type"] == "prototype":
        fill_prototype_extras(exp_dir, fields)

    print(f"Experiment scaffolded at: {exp_dir}")

    # Set outputs for the workflow
    set_github_output("slug", fields["slug"])
    set_github_output("title", fields["title"])
    set_github_output("type", fields["type"])
    set_github_output("description", fields["description"])


if __name__ == "__main__":
    main()
