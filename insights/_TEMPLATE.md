---
# Curated insight template. Copy this file to `insights/<your-slug>.md`, remove the
# leading underscore, fill in the frontmatter, and write the body in markdown.
# Files starting with `_` are ignored by the hub, so this template never publishes.
#
# An insight is cross-experiment synthesis: a thread you can draw across two or more
# experiments that no single experiment's learnings capture on their own.

# Keep under ~48 characters — longer titles shrink on the social card.
title: "What we've learned about <topic>"
# Required. One or two sentences a reader can scan in five seconds — the headline
# takeaway. Keep it under ~115 characters: the Learnings card clamps to three lines
# and clips mid-word past that (the social card is looser, truncating at 168).
summary: ""
# Theme keys (see hub/src/data/taxonomy.json): cost-perf, evals, patterns, geospatial,
# reliability, agents, scouting, prototyping, development
themes: []
# Slugs of the experiments this insight synthesises (must match experiment dir names).
# List only the ones the body actually names — this drives both the sidebar here and
# the back-link on each experiment's page.
related_experiments: []
date: 2026-06-02
featured: false
# Flip to "published" when the synthesis is ready to share. Drafts render in dev only.
status: draft
---

<!-- Rendering: `##` and `###` are styled, `####` and deeper are not — don't nest past
     `###`. Tables render well up to three columns. Blockquotes and fenced code blocks
     are unstyled; avoid them. -->

One or two sentences before the first heading: the claim, stated plainly.

## The pattern

What recurring signal showed up across these experiments? State it plainly, then give
the reader the frame you used to see it.

## <Rename this heading, or delete the section>

Optional. The reusable part of the insight — a framework, an architecture, a set of
named forms. Rename the heading to fit what it actually is ("The design space", "The
layers", "Four forms we built"), and delete the section if the insight doesn't have one.

Three columns is the densest form this page renders well:

| Thing | One axis | Another axis |
|---|---|---|
| ... | ... | ... |

## Evidence

- **Experiment Name** — what it showed, in a line or two. Use the experiment's real
  title in prose; the clickable links come from `related_experiments`.
- **Experiment Name** — what it showed.

## What this means for us

What we do differently because of this, and what's still open. Put the results that cut
against the pattern here too — the limit is part of the finding.
