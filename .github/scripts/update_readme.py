# /// script
# dependencies = [
#   "pyyaml"
# ]
# ///
"""
Update README.md with a table of experiments.

Supports both info.yaml (preferred) and experiment.yaml (legacy for migration).
"""
import pathlib

import yaml  # requires PyYAML

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
EXPERIMENTS_DIR = REPO_ROOT / "experiments"
README_PATH = REPO_ROOT / "README.md"

START_MARKER = "<!-- EXPERIMENTS-START -->"
END_MARKER = "<!-- EXPERIMENTS-END -->"


def load_experiments():
    """Load experiment metadata from all experiments."""
    experiments = []

    if not EXPERIMENTS_DIR.exists():
        return experiments

    for child in sorted(EXPERIMENTS_DIR.iterdir()):
        if not child.is_dir():
            continue

        # Skip hidden directories
        if child.name.startswith("."):
            continue

        # Try info.yaml first (preferred), then experiment.yaml (legacy for migration)
        yaml_path = child / "info.yaml"
        if not yaml_path.exists():
            yaml_path = child / "experiment.yaml"

        if not yaml_path.exists():
            continue

        with yaml_path.open("r", encoding="utf-8") as f:
            data = yaml.safe_load(f) or {}

        slug = child.name
        title = data.get("title") or data.get("name") or slug
        status = data.get("status", "unknown")
        exp_type = data.get("type", "-")
        description = data.get("description", "")

        # Truncate description if too long
        if description and len(description) > 80:
            description = description[:77].strip() + "..."

        experiments.append(
            {
                "slug": slug,
                "title": title,
                "status": status,
                "type": exp_type,
                "description": description,
                "rel_path": f"experiments/{slug}/",
            }
        )

    return experiments


def build_table(experiments):
    """Build a markdown table from experiments."""
    if not experiments:
        return "_No experiments found in `experiments/`._"

    lines = [
        "| Experiment | Type | Status | Description |",
        "| ---------- | ---- | ------ | ----------- |",
    ]
    for exp in experiments:
        link = f"[{exp['title']}]({exp['rel_path']})"
        desc = exp["description"].replace("\n", " ").strip() if exp["description"] else "-"
        lines.append(f"| {link} | `{exp['type']}` | `{exp['status']}` | {desc} |")

    return "\n".join(lines)


def update_readme(content, new_section):
    """Update the experiments section in README content."""
    if START_MARKER not in content or END_MARKER not in content:
        raise SystemExit(
            "Could not find EXPERIMENTS markers in README.md. "
            f"Make sure both {START_MARKER} and {END_MARKER} exist."
        )

    before, rest = content.split(START_MARKER, 1)
    _, after = rest.split(END_MARKER, 1)

    # Build replacement without any leading whitespace on markers or content
    replacement = (
        f"{START_MARKER}\n"
        f"<!-- This section is auto-generated; do not edit by hand. -->\n"
        f"{new_section}\n"
        f"{END_MARKER}"
    )

    return before + replacement + after


def main():
    experiments = load_experiments()
    table = build_table(experiments)

    with README_PATH.open("r", encoding="utf-8") as f:
        content = f.read()

    new_content = update_readme(content, table)

    if new_content != content:
        with README_PATH.open("w", encoding="utf-8") as f:
            f.write(new_content)
        print(f"README.md updated with {len(experiments)} experiments.")
    else:
        print("README.md unchanged.")


if __name__ == "__main__":
    main()
