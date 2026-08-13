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
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
TEMPLATES_DIR = REPO_ROOT / ".github" / "templates"
EXPERIMENTS_DIR = REPO_ROOT / "experiments"

# Enums come from experiment_schema.py — the single source of truth.
from experiment_schema import VALID_TARGETS, VALID_THEMES, VALID_TYPES  # noqa: E402

# Scaffolding (the _shared/ + type-template overlay, and what counts as a
# template at all) lives in one place so the justfile and smoke test agree.
from scaffold_template import list_templates, scaffold  # noqa: E402

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

    if is_empty(fields.get("falsifiable_signal")):
        errors.append("Falsifiable success signal is required")
    elif not re.search(r"\d", fields["falsifiable_signal"]):
        # The coach's idea→started gate wants a concrete threshold; nudge early.
        print(
            "Warning: falsifiable signal contains no number — the coach's "
            "falsifiability gate may flag it at idea → started",
            file=sys.stderr,
        )

    targets = (fields.get("targets") or "").strip()
    if targets and targets not in VALID_TARGETS:
        errors.append(f"Invalid targets '{targets}'. Must be one of: {', '.join(VALID_TARGETS)}")

    # An explicit template must exist — fail here with a useful message rather
    # than at copytree time.
    template = (fields.get("template") or "").strip()
    if template and template not in list_templates():
        errors.append(f"Unknown template '{template}'. Available: {', '.join(list_templates())}")

    # Warn on unknown themes (non-fatal, but log)
    for theme in fields.get("themes", []):
        if theme not in VALID_THEMES:
            print(f"Warning: non-standard theme '{theme}'", file=sys.stderr)

    return errors


# ---------------------------------------------------------------------------
# Template filling
# ---------------------------------------------------------------------------


def fill_metadata(exp_dir: Path, fields: dict) -> None:
    """Fill the scaffold's metadata by delegating to the canonical filler.

    `fill-metadata.py` is what `just new-experiment` and the template smoke test
    both run, so going through it is the only way the issue-driven path and the
    local path can't drift — and it already handles the brief's H1 and lede, the
    demo package name, and the app.html SEO block.
    """
    cmd = [
        sys.executable,
        str(Path(__file__).parent / "fill-metadata.py"),
        str(exp_dir),
        "--title",
        fields["title"],
        "--description",
        fields["description"],
        "--type",
        fields["type"],
    ]
    for theme in fields.get("themes") or []:
        cmd += ["--theme", theme]
    for tag in fields.get("tags") or []:
        cmd += ["--tag", tag]
    if (fields.get("targets") or "").strip():
        cmd += ["--targets", fields["targets"].strip()]

    subprocess.run(cmd, cwd=REPO_ROOT, check=True)


def fill_brief_md(path: Path, fields: dict) -> None:
    """Inject the falsifiable success signal into the Signals subsection of brief.md,
    so the experiment passes the coach's falsifiability gate from day one."""
    signal = (fields.get("falsifiable_signal") or "").strip()
    if not signal or not path.exists():
        return
    text = path.read_text()
    # Same heading variants the coach's falsifiability gate recognizes.
    m = re.search(
        r"^###\s+(?:Signals?|What\s+signals?|What\s+would\s+change|Hypothesis|Success\s+criteria|Success\s+signals?)[^\n]*$",
        text,
        re.IGNORECASE | re.MULTILINE,
    )
    if not m:
        print(
            "Warning: no Signals subsection found in brief.md; signal not injected", file=sys.stderr
        )
        return
    insert_pos = m.end()
    text = text[:insert_pos] + f"\n\n**Success signal:** {signal}" + text[insert_pos:]
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
        "template": "" if is_empty(sections.get("Template", "")) else sections["Template"].strip(),
        "description": sections.get("Description", "").strip(),
        "falsifiable_signal": sections.get("Falsifiable success signal", "").strip(),
        "themes": parse_checkboxes(sections.get("Themes", "")),
        "tags": [],
        "context": sections.get("Additional Context", "").strip(),
    }

    # Optional dropdown ("_No response_" when unselected)
    targets_value = sections.get("Targets", "").strip()
    fields["targets"] = "" if is_empty(targets_value) else targets_value

    # Parse comma-separated tags
    raw_tags = sections.get("Tags", "").strip()
    if raw_tags and raw_tags != "_No response_":
        fields["tags"] = [t.strip() for t in raw_tags.split(",") if t.strip()]

    print(f"Issue #{issue_number} by @{issue_author}")
    print(f"  Title:       {fields['title']}")
    print(f"  Slug:        {fields['slug']}")
    print(f"  Type:        {fields['type']}")
    print(f"  Description: {fields['description'][:80]}...")
    print(f"  Themes:      {fields['themes']}")
    print(f"  Tags:        {fields['tags']}")

    # Validate
    errors = validate(fields)
    if errors:
        print("\nValidation errors:", file=sys.stderr)
        for err in errors:
            print(f"  - {err}", file=sys.stderr)
        sys.exit(1)

    # Copy template. The issue form can name a template explicitly (that is the
    # only way to reach `prototype-byok` and `experiment-minimal`, which have no
    # matching type); otherwise fall back to the template named after the type.
    template_name = fields.get("template") or fields["type"]
    exp_dir = EXPERIMENTS_DIR / fields["slug"]

    print(f"\nScaffolding _shared/ + {template_name} → experiments/{fields['slug']}/")
    try:
        scaffold(template_name, exp_dir)
    except SystemExit as exc:
        print(f"Error: {exc}", file=sys.stderr)
        sys.exit(1)

    # Fill placeholders
    fill_metadata(exp_dir, fields)
    fill_brief_md(exp_dir / "brief.md", fields)

    # Prototype-specific replacements the shared filler doesn't cover
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
