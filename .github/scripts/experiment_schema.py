"""Canonical experiment-metadata schema constants.

This module is the single source of truth for every enum and field list in the
experiment metadata contract. Import it — do not copy values out of it.

    from experiment_schema import VALID_TYPES, VALID_STATUS

Scripts in this directory are invoked by path (`uv run .github/scripts/foo.py`),
so `sys.path[0]` is already this directory and a plain import works. Scripts
living elsewhere should add this directory to `sys.path` first; see
`load_schema_module()` at the bottom for a copy-pasteable loader.

Non-Python consumers cannot import this file and therefore duplicate these
values. They are kept honest by `just check-schema-sync`, which diffs them
against this module and fails on drift:

  - `packages/shared-types/src/index.ts`  — TypeScript unions for the hub
  - `hub/src/data/taxonomy.json`          — theme/target display metadata
  - `.github/templates/*/frontmatter.yaml` — inline enum comments (advisory only)

When you change anything here, run `just check-schema-sync`.
"""

from __future__ import annotations

# --- Core field lists -------------------------------------------------------

#: Absence is an error. `slug` is deliberately absent: it must equal the
#: directory name, so requiring it authored is pure redundancy — generate-index.py
#: defaults it from the folder and validate-experiments.py still rejects a mismatch.
REQUIRED_FIELDS = ["title", "type", "status", "description"]

#: Absence is a warning. `updated_at` is here because the hub sorts on it, the
#: RSS feed uses it as pubDate, and the staleness sweep reads it — a missing
#: value silently degrades all three.
RECOMMENDED_FIELDS = ["created_at", "updated_at"]

# --- Enums ------------------------------------------------------------------

#: What kind of artifact the experiment is. Distinct from the *template* it was
#: scaffolded from — there are more templates than types.
VALID_TYPES = [
    "evaluation",
    "benchmark",
    "spike",
    "prototype",
    "research",
    "notebook",
    "marimo",
]

#: Lifecycle. The only status vocabulary in the repo; the coach's stages are
#: derived diagnostics and are not statuses.
VALID_STATUS = ["idea", "started", "paused", "done", "archived"]

#: Learning-agenda themes. The first entry of an experiment's `themes:` list is
#: its primary theme. See docs/strategic-priorities.md.
VALID_THEMES = [
    "cost-perf",
    "evals",
    "patterns",
    "geospatial",
    "reliability",
    "agents",
    "scouting",
    "prototyping",
    "development",
]

#: What conceptual layer the work targets — orthogonal to `themes` (which says
#: *what domain*). See docs/experiments-process.md.
#:   capability — what can the tools do?
#:   infra      — can we build and run this?
#:   feature    — should we build this, and how?
VALID_TARGETS = ["capability", "infra", "feature"]

#: Experiments that exist to demonstrate the repo's own conventions — a worked
#: file layout, a scaffolding template, a one-command runner — rather than to
#: ask a question about applied AI. They are real directories with real briefs
#: and stay listed on /experiments/ with their own pages, but they are withheld
#: from every surface that aggregates findings across experiments: the Learnings
#: page, theme pages and their counts, the home page's registers and stat bar,
#: and the RSS feed. Publishing repo-mechanics content there dilutes the signal
#: for a reader who came for what we learned about AI.
#:
#: Also exempt from the content expectations that assume an experiment is asking
#: a question — the signal-check standard and the staleness rule. See
#: docs/content-guide.md.
#:
#: generate-index.py turns membership into the computed `_reference_scaffold`
#: flag on each index entry, so the hub filters on that rather than duplicating
#: this list in TypeScript.
REFERENCE_SCAFFOLDS = {
    "example-experiment",
    "simple-python-uv-experiment",
}

VALID_DEMO_TYPES = [
    "sveltekit",
    "static",
    "notebook-html",
    "astro",
    "marimo-html",
    "marimo-wasm",
]

#: Demo types whose build output is a rendered notebook rather than an app.
#: Consumed by generate-index.py for the `_is_notebook` flag.
NOTEBOOK_DEMO_TYPES = {"notebook-html", "marimo-html", "marimo-wasm"}

# --- Placeholder detection --------------------------------------------------

#: Values that must never survive into a real experiment. Template scaffolding
#: leaves these behind, and unfilled text propagates into deployed demo <meta>
#: tags and generated social cards, so they are errors rather than warnings.
PLACEHOLDER_VALUES = {
    "changeme",
    "your name",
    "todo",
    "tbd",
    "yyyy-mm-dd",
    "brief summary of findings.",
    "one to two sentences",
}

#: Fields checked against PLACEHOLDER_VALUES, plus a prefix check so
#: "CHANGEME: One to two sentences describing…" is caught too.
PLACEHOLDER_CHECKED_FIELDS = ["title", "description", "created_at", "updated_at"]


def is_placeholder(value: object) -> bool:
    """True if `value` is recognizable template boilerplate.

    Matches exact values case-insensitively, and any string that *starts with*
    a placeholder token — which is how the templates ship `description`
    ("CHANGEME: One to two sentences …").
    """
    if not isinstance(value, str):
        return False
    text = value.strip().lower().rstrip(":").strip()
    if not text:
        return False
    if text in PLACEHOLDER_VALUES:
        return True
    return any(text.startswith(token) for token in ("changeme", "yyyy-mm-dd"))


# --- Loader for scripts outside this directory ------------------------------


def load_schema_module():
    """Import this module from a script whose sys.path[0] is elsewhere.

    Useful for tooling that lives outside `.github/scripts/` (for example the
    experiment-coach skill, which is local-only and may not be present at all):

        import sys
        from pathlib import Path
        sys.path.insert(0, str(repo_root / ".github" / "scripts"))
        import experiment_schema
    """
    import sys
    from pathlib import Path

    scripts_dir = Path(__file__).resolve().parent
    if str(scripts_dir) not in sys.path:
        sys.path.insert(0, str(scripts_dir))
    return sys.modules[__name__]
