#!/usr/bin/env python3
# /// script
# dependencies = [
#   "pyyaml"
# ]
# ///
"""
Read and write experiment briefs: YAML frontmatter + markdown body.

`brief.md` is the single source of truth for an experiment's metadata, and this
module is the only place that knows how to open it. Apply raw-text regexes to
`doc.frontmatter_text`, never to the whole file. There is deliberately **no YAML
emitter here**: the comments in the frontmatter are the authoring guide, and the
only way to keep them exactly is to never re-serialise.

Splitting is line-anchored and non-greedy for one specific reason: brief bodies
use `---` as a horizontal rule between Before / Learnings / After (36 of them
across the current 18 briefs). `text.split("---")` would shred every one.

Usage as a CLI (for build-demos.sh, which has no pyyaml of its own):
  python experiment_doc.py --get demo.enabled experiments/foo
"""

from __future__ import annotations

import argparse
import re
import sys
from collections.abc import Callable, Iterator
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml

REPO_ROOT = Path(__file__).resolve().parents[2]
EXPERIMENTS_DIR = REPO_ROOT / "experiments"

OPEN = "---"
CLOSERS = ("---", "...")


@dataclass
class ExperimentDoc:
    path: Path
    frontmatter_text: str | None
    body: str
    meta: dict[str, Any] = field(default_factory=dict)
    parse_error: str | None = None

    @property
    def has_frontmatter(self) -> bool:
        return self.frontmatter_text is not None


def split(text: str) -> tuple[str | None, str]:
    """(frontmatter_text, body). frontmatter_text is None when there is no block.

    Only a `---` on the very first line opens a block; the first subsequent line
    that is exactly `---` or `...` closes it. Anything else is all body.
    """
    normalized = text.replace("\r\n", "\n")
    if not normalized.startswith(OPEN + "\n"):
        return None, text

    lines = normalized.split("\n")
    for i in range(1, len(lines)):
        if lines[i].strip() in CLOSERS:
            frontmatter = "\n".join(lines[1:i])
            body = "\n".join(lines[i + 1 :])
            return frontmatter, body.lstrip("\n")
    # Unterminated block — treat the whole file as body rather than guessing.
    return None, text


def join(frontmatter_text: str | None, body: str) -> str:
    """Exactly one `---`, the YAML, one `---`, a blank line, then the body."""
    body = body.lstrip("\n").rstrip("\n") + "\n"
    if frontmatter_text is None:
        return body
    fm = frontmatter_text.strip("\n")
    return f"{OPEN}\n{fm}\n{OPEN}\n\n{body}"


def load(path: Path) -> ExperimentDoc:
    text = path.read_text()
    fm, body = split(text)
    doc = ExperimentDoc(path=path, frontmatter_text=fm, body=body)
    if fm is not None:
        try:
            doc.meta = yaml.safe_load(fm) or {}
        except yaml.YAMLError as exc:
            doc.parse_error = str(exc)
    return doc


def save(doc: ExperimentDoc) -> None:
    """Write the doc back, refusing anything that would corrupt it.

    Generalises the safety net add-learning.py has always had: the frontmatter must
    still parse, and the result must round-trip to the same two halves.
    """
    if doc.frontmatter_text is not None:
        try:
            yaml.safe_load(doc.frontmatter_text)
        except yaml.YAMLError as exc:
            raise ValueError(
                f"{doc.path}: refusing to write unparseable frontmatter: {exc}"
            ) from exc

    out = join(doc.frontmatter_text, doc.body)
    fm2, body2 = split(out)
    if (fm2 or "").strip() != (
        doc.frontmatter_text or ""
    ).strip() or body2.strip() != doc.body.strip():
        raise ValueError(f"{doc.path}: refusing to write — content would not round-trip")
    doc.path.write_text(out)


def edit_frontmatter(path: Path, fn: Callable[[str], str]) -> bool:
    """Apply `fn` to the frontmatter text only. The body physically cannot change.

    This is the entry point every writer should use: it makes "my regex escaped
    into the prose" impossible rather than merely unlikely.
    """
    doc = load(path)
    if doc.frontmatter_text is None:
        return False
    updated = fn(doc.frontmatter_text)
    if updated == doc.frontmatter_text:
        return False
    doc.frontmatter_text = updated
    save(doc)
    return True


def iter_experiments(root: Path = EXPERIMENTS_DIR) -> Iterator[ExperimentDoc]:
    for exp_dir in sorted(root.iterdir()):
        if not exp_dir.is_dir() or exp_dir.name.startswith("."):
            continue
        brief = exp_dir / "brief.md"
        if brief.exists():
            yield load(brief)


# --- Metadata resolution ----------------------------------------------------


def load_meta(exp_dir: Path) -> tuple[dict[str, Any], str, str | None]:
    """(meta, body, error) for an experiment, read from `brief.md`.

    `brief.md` is the only place experiment metadata lives: YAML frontmatter for
    the contract, the markdown body for the prose fields. There is deliberately no
    second file to fall back to — two sources is how the frontmatter and a
    stale `info.yaml` copy used to disagree.

    An empty `meta` means "no metadata here"; `error` is reserved for a brief that
    exists but whose frontmatter won't parse, so callers can tell a missing
    experiment from a broken one.
    """
    brief = exp_dir / "brief.md"
    if not brief.exists():
        return {}, "", None
    doc = load(brief)
    if not doc.has_frontmatter:
        return {}, doc.body, doc.parse_error
    return doc.meta, doc.body, doc.parse_error


def dig(meta: dict[str, Any], dotted: str) -> Any:
    val: Any = meta
    for key in dotted.split("."):
        if not isinstance(val, dict):
            return None
        val = val.get(key)
    return val


# --- Prose extraction -------------------------------------------------------
# The brief body is the authoring surface for description, learnings, and the
# outcome sentence. These read them back out; nothing else should parse a brief.

MIN_LEARNING_CHARS = 25

TEMPLATE_BULLET = re.compile(r"^<.*>$")

# Opt-out sentinel for the `## Learnings` section. Some experiments are repo
# infrastructure or worked examples — real work, but nothing another team could
# act on — and the hub's Learnings page is for transferable takeaways. Writing
# `_None published, deliberately._` under the heading says "considered, and no"
# so the coach's stale-learnings advisory stops asking. Distinct from an empty
# section, which still means "not captured yet".
NO_LEARNINGS_SENTINEL = re.compile(r"^_None published, deliberately\._", re.MULTILINE)

OUTCOME_RE = re.compile(
    r"^\*\*Outcome:\*\*[ \t]*(.+?)(?=\n[ \t]*\n|\n##|\Z)",
    re.MULTILINE | re.DOTALL,
)


def extract_learnings(brief: str) -> tuple[list[str], list[str]]:
    """(learnings, lint_warnings) from a brief's `## Learnings` section."""
    m = re.search(r"^## Learnings[ \t]*\n(.*?)(?=^## |\Z)", brief, re.MULTILINE | re.DOTALL)
    if not m:
        return [], []

    learnings: list[str] = []
    warnings: list[str] = []

    for raw in m.group(1).split("\n"):
        # Sub-bullets would flatten into standalone learnings that read as fragments.
        if re.match(r"^[ \t]+[-*]\s", raw):
            warnings.append(f"nested bullet dropped: {raw.strip()[:60]}")
            continue
        if not re.match(r"^[-*]\s", raw):
            continue

        text = re.sub(r"^[-*]\s+", "", raw).strip()
        if not text or TEMPLATE_BULLET.match(text):
            continue
        if len(text) < MIN_LEARNING_CHARS:
            warnings.append(f"learning under {MIN_LEARNING_CHARS} chars: {text[:60]}")
        learnings.append(text)

    return learnings, warnings


def learnings_opted_out(brief: str) -> bool:
    """True when the brief's `## Learnings` section explicitly publishes none."""
    m = re.search(r"^## Learnings[ \t]*\n(.*?)(?=^## |\Z)", brief, re.MULTILINE | re.DOTALL)
    return bool(m and NO_LEARNINGS_SENTINEL.search(m.group(1)))


def extract_summary(brief: str) -> str | None:
    """The `**Outcome:** ...` line that opens `## After`, joined to one line.

    Authors may wrap it across several lines for readability; it is one sentence
    logically, and results.summary is a scalar, so the wrap is collapsed here.
    """
    m = re.search(r"^## After[ \t]*\n(.*?)(?=^## |\Z)", brief, re.MULTILINE | re.DOTALL)
    if not m:
        return None
    om = OUTCOME_RE.search(m.group(1))
    if not om:
        return None
    text = " ".join(om.group(1).split())
    # An unfilled template line is not an outcome. Leaving it would put prompt
    # prose in results.summary, which the content guide calls worse than null
    # because it masquerades as content.
    if not text or TEMPLATE_BULLET.match(text):
        return None
    return text


# --- After-section completeness ---------------------------------------------
# A close-out is often partial on purpose: the build is finished and the learnings
# are real, but a signal can't be answered until colleagues finish testing, an eval
# runs, or a partner reviews. That is a legitimate state, not a defect — so the
# readers below distinguish "this subsection is waiting on something" from "this
# experiment was never written up", and the gates treat the two differently.
#
# Marking is optional. An empty subsection is taken as pending; writing
# `_Pending: what you're waiting on_` under the heading just says what for, which
# is the only version a reader can act on.

PENDING_RE = re.compile(r"^\s*_+\s*pending\s*:?\s*(?P<reason>.*?)\s*_+\s*$", re.IGNORECASE)


def after_body(brief: str) -> str | None:
    """The text of the `## After` section, or None when there isn't one."""
    m = re.search(r"^## After[ \t]*\n(.*?)(?=^## |\Z)", brief, re.MULTILINE | re.DOTALL)
    return m.group(1) if m else None


def after_subsections(brief: str) -> list[tuple[str, str]]:
    """(heading, content) for each `###` subsection of `## After`, in order."""
    body = after_body(brief)
    if body is None:
        return []
    parts = re.split(r"^###[ \t]+(.+?)[ \t]*$", body, flags=re.MULTILINE)
    # parts[0] is any prose before the first `###` (the **Outcome:** line lives there).
    return [(parts[i].strip(), parts[i + 1]) for i in range(1, len(parts) - 1, 2)]


def pending_reason(content: str) -> str | None:
    """The reason from a `_Pending: …_` line, or None if the content has none."""
    for line in content.split("\n"):
        m = PENDING_RE.match(line)
        if m:
            return m.group("reason").strip() or None
    return None


def unfilled_after_subsections(brief: str) -> list[tuple[str, str | None]]:
    """(heading, pending_reason) for every After subsection with no author content.

    A subsection counts as unfilled when it holds nothing but whitespace, or nothing
    but a `_Pending: …_` marker. `pending_reason` is that marker's text when present.
    """
    out: list[tuple[str, str | None]] = []
    for heading, content in after_subsections(brief):
        reason = pending_reason(content)
        remainder = "\n".join(
            line for line in content.split("\n") if not PENDING_RE.match(line)
        ).strip()
        if not remainder:
            out.append((heading, reason))
    return out


def after_is_underway(brief: str) -> bool:
    """True when someone has actually started writing the After section.

    The distinction the gates need: an After section with real prose in at least one
    subsection is a close-out in progress, and its empty subsections are pending. An
    After section that is entirely empty or untouched template is not a close-out at
    all, and should still be reported as missing.
    """
    subs = after_subsections(brief)
    if not subs:
        return False
    unfilled = {heading for heading, _ in unfilled_after_subsections(brief)}
    return any(heading not in unfilled for heading, _ in subs)


def extract_description(brief: str) -> str | None:
    """The blockquote under the H1 — catalog copy: what this experiment is.

    Distinct from the motivation prose, which lives in "What problem or question
    does this address?". This one is what the hub card, the OG image, the meta
    description, and the RSS entry all show.
    """
    lines = brief.split("\n")
    start = None
    for i, ln in enumerate(lines[1:], 1):
        if ln.startswith("## "):
            break
        if ln.strip().startswith(">"):
            start = i
            break
        if ln.strip():
            break
    if start is None:
        return None
    end = start
    while end < len(lines) and lines[end].strip().startswith(">"):
        end += 1
    quoted = " ".join(ln.strip().lstrip("> ").rstrip() for ln in lines[start:end])
    text = " ".join(quoted.split())
    if not text or TEMPLATE_BULLET.match(text):
        return None
    return text


def replace_description(content: str, description: str | None) -> str:
    """Rewrite the top-level `description:` folded scalar, keeping its comment."""
    if not description:
        return content
    m = re.search(
        r"^description:(?P<gap>[ \t]*)(?P<value>>|[^\n#]*?)(?P<gap2>[ \t]*)(?P<comment>#[^\n]*)?\n"
        r"(?P<cont>(?:[ \t]+[^\n]*\n)*)",
        content,
        re.MULTILINE,
    )
    if not m:
        return content
    body, line = [], "  "
    for word in description.split():
        if len(line) + len(word) + 1 > 96 and line.strip():
            body.append(line.rstrip())
            line = "  "
        line += word + " "
    if line.strip():
        body.append(line.rstrip())
    comment = f"{m.group('gap2') or ''}{m.group('comment')}" if m.group("comment") else ""
    block = f"description: >{comment}\n" + "\n".join(body) + "\n"
    return content[: m.start()] + block + content[m.end() :]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--get", metavar="DOTTED_KEY", help="print a metadata value")
    parser.add_argument("path", help="experiment directory")
    args = parser.parse_args()

    meta, _, error = load_meta(Path(args.path))
    if error:
        print(f"error: {args.path}: {error}", file=sys.stderr)
        return 1
    if args.get:
        val = dig(meta, args.get)
        if val is not None:
            print(val)
    return 0


if __name__ == "__main__":
    sys.exit(main())
