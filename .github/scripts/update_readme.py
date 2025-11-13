# /// script
# dependencies = [
#   "pyyaml"
# ]
# ///
import pathlib

import yaml  # requires PyYAML

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
EXPERIMENTS_DIR = REPO_ROOT / "experiments"
README_PATH = REPO_ROOT / "README.md"

START_MARKER = "<!-- EXPERIMENTS-START -->"
END_MARKER = "<!-- EXPERIMENTS-END -->"


def load_experiments():
    experiments = []

    if not EXPERIMENTS_DIR.exists():
        return experiments

    for child in sorted(EXPERIMENTS_DIR.iterdir()):
        if not child.is_dir():
            continue

        info_path = child / "info.yaml"
        if not info_path.exists():
            continue

        with info_path.open("r", encoding="utf-8") as f:
            data = yaml.safe_load(f) or {}

        slug = child.name
        title = data.get("title") or data.get("name") or slug
        status = data.get("status", "unknown")

        experiments.append(
            {
                "slug": slug,
                "title": title,
                "status": status,
                "rel_path": f"experiments/{slug}/",
            }
        )

    return experiments


def build_table(experiments):
    if not experiments:
        return "_No experiments found in `experiments/`._"

    lines = [
        "| Title | Status |",
        "| ----- | ------ |",
    ]
    for exp in experiments:
        link = f"[{exp['title']}]({exp['rel_path']})"
        lines.append(f"| {link} | `{exp['status']}` |")

    return "\n".join(lines)


def update_readme(content, new_section):
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
        print("README.md updated with experiments table.")
    else:
        print("README.md unchanged.")


if __name__ == "__main__":
    main()
