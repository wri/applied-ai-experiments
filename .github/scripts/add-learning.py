#!/usr/bin/env python3
"""
Append a learning to an experiment's `## Learnings` section in brief.md — the
10-second way to capture learning while an experiment is in flight (learnings
render on the hub's Learnings page at any status, not just when `done`).

brief.md is the only place learnings live: `generate-index.py` reads this section
straight out of the body, so there is nothing to keep in sync. Writing markdown
rather than a YAML list is also what removes the quote-escaping tax.

The section lives at the top level, outside `## After`, so adding a learning to a
`started` experiment can't make the hub render an "Outcome" panel for work that
hasn't concluded.

Operates on raw text so the rest of the brief keeps its exact formatting.
Wrapped by `just learning <slug> "text"`.
"""

import datetime
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import experiment_doc  # noqa: E402

REPO_ROOT = Path(__file__).resolve().parents[2]
EXPERIMENTS_DIR = REPO_ROOT / "experiments"

LEARNINGS_HEADING = "## Learnings"


def bump_updated_at(content: str) -> str:
    today = datetime.date.today().isoformat()
    return re.sub(r"^(updated_at:)\s*\S+", rf"\1 {today}", content, count=1, flags=re.MULTILINE)


def append_learning(brief: str, learning: str) -> str:
    """Add `- learning` to the ## Learnings section, creating the section if absent."""
    bullet = f"- {learning}"

    m = re.search(r"^## Learnings[ \t]*\n(.*?)(?=^## |\Z)", brief, re.MULTILINE | re.DOTALL)
    if m:
        body = m.group(1)
        # Drop the template's placeholder comment/prompt once a real learning lands.
        cleaned = re.sub(r"^<!--.*?-->[ \t]*\n?", "", body, flags=re.MULTILINE | re.DOTALL)
        cleaned = re.sub(r"^- <.*>[ \t]*\n?", "", cleaned, flags=re.MULTILINE)

        # Insert after the last existing bullet, else at the end of the section.
        bullets = list(re.finditer(r"^- .*(?:\n(?![ \t]*\n|## ).*)*$", cleaned, re.MULTILINE))
        if bullets:
            at = bullets[-1].end()
            cleaned = cleaned[:at] + "\n" + bullet + cleaned[at:]
        else:
            # The section ends with the `---` rule that separates it from `## After`,
            # and that rule is part of this match. Appending past it would put the
            # bullet under the rule, reading as if it belonged to After — which is
            # what happens to every experiment's *first* learning.
            trailing_rule = re.search(r"\n---[ \t]*\n+\Z", cleaned)
            if trailing_rule:
                head = cleaned[: trailing_rule.start()].rstrip("\n")
                cleaned = f"{head}\n\n{bullet}\n{cleaned[trailing_rule.start() :]}"
            else:
                cleaned = cleaned.rstrip("\n") + f"\n\n{bullet}\n\n"
        return brief[: m.start(1)] + cleaned + brief[m.end(1) :]

    # No section yet — create one before "## After", else at the end.
    section = f"---\n\n{LEARNINGS_HEADING}\n\n{bullet}\n\n"
    m = re.search(r"\n(?:---[ \t]*\n+)?## After", brief)
    if m:
        return brief[: m.start() + 1] + section + "---\n\n## After" + brief[m.end() :]
    return brief.rstrip("\n") + "\n\n" + section.rstrip("\n") + "\n"


def main() -> int:
    if len(sys.argv) != 3:
        print(__doc__.strip(), file=sys.stderr)
        return 2

    target, learning = sys.argv[1], sys.argv[2].strip()
    if not learning:
        print("Error: learning text is empty.", file=sys.stderr)
        return 2

    exp_dir = Path(target) if Path(target).is_dir() else EXPERIMENTS_DIR / target
    brief_path = exp_dir / "brief.md"
    if not brief_path.exists():
        print(f"Error: no brief.md at {brief_path}", file=sys.stderr)
        return 1

    doc = experiment_doc.load(brief_path)
    doc.body = append_learning(doc.body, learning)

    # Safety net: the learning must be readable back out as its own bullet.
    learnings, _ = experiment_doc.extract_learnings(doc.body)
    if learning not in learnings:
        print(
            "Error: learning did not land in the ## Learnings section; aborting without writing.",
            file=sys.stderr,
        )
        return 1

    # The hub sorts on updated_at, RSS uses it as pubDate, and the staleness sweep
    # reads it — capturing a learning without bumping it makes live work look stale.
    if doc.frontmatter_text is not None:
        doc.frontmatter_text = bump_updated_at(doc.frontmatter_text)

    # save() refuses to write anything that wouldn't round-trip back to the same
    # two halves, so a runaway regex can't corrupt the brief.
    experiment_doc.save(doc)

    print(f"Added learning to {brief_path.relative_to(REPO_ROOT)}")
    print("Publish it to the hub with: just generate-index")
    return 0


if __name__ == "__main__":
    sys.exit(main())
