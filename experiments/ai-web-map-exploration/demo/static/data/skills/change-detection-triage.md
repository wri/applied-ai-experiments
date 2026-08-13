---
name: change-detection-triage
description: Triage recent change events in a monitored region — rank them, dismiss noise, and walk the user through what deserves attention. Use when the user asks what changed, what is new, or what needs review.
triggers:
  - change
  - alert
  - "what's new"
  - triage
---

# Change detection triage

Turn a pile of change events into a ranked, verifiable walk-through.

## Procedure

1. **Collect.** List all change events intersecting the current region and
   time window. State the window explicitly.
2. **Rank.** Order by severity × recency. Anything below 0.25 severity is
   noise: mention the count, do not walk through them.
3. **Walk the top three.** For each: fly to the event location (`flyTo`),
   highlight the affected geometry (`highlight`), and give a one-sentence
   interpretation plus a one-phrase confidence note.
4. **Recommend.** End with one recommended action for the highest-ranked
   event (e.g. "task a field check", "wait for the next capture").

## Constraints

- Never present more than three events in detail.
- Each claim must name the event source layer.
- If two events are within 5 km of each other, treat them as possibly related
  and say so.
