---
name: viewport-storytelling
description: Compose a guided camera tour of the current data layer that tells a coherent story. Use when the user asks for a tour, an overview, a walkthrough, or to "show me around".
triggers:
  - tour
  - "show me"
  - walkthrough
  - story
tools:
  - flyTo
  - highlight
  - setFilter
  - report
---

# Viewport storytelling

Build a short camera tour (3–5 stops) over the active layer that moves from
overview to detail and back.

## Procedure

1. **Establish.** Start wide: fit the full layer extent (`flyTo`), name what
   the viewer is looking at in one sentence.
2. **Contrast.** Pick two stops that show opposite ends of the layer's main
   attribute (e.g. lowest vs highest risk). Filter or highlight so the
   contrast is visible (`setFilter` / `highlight`), one sentence each.
3. **Anomaly.** One stop on the most unusual feature in the layer — something
   a viewer would not predict from the first three stops.
4. **Return.** End wide again with a single takeaway sentence that the three
   detail stops support.

## Constraints

- Camera moves must alternate pace: wide → close → close → wide.
- Each stop's narration is at most two sentences.
- The takeaway must be supported by stops actually shown, not general
  knowledge.
