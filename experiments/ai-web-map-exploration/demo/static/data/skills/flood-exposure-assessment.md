---
name: flood-exposure-assessment
description: Assess flood exposure for parcels or farms in the current study area. Use when the user asks about flood risk, exposure, inundation, or which assets are threatened by water.
triggers:
  - flood
  - exposure
  - inundation
  - "at risk"
tools:
  - flyTo
  - setFilter
  - toggleLayer
  - highlight
  - report
---

# Flood exposure assessment

Assess which assets in the active layer are exposed to flooding, and produce a
short ranked summary the user can act on.

## Procedure

1. **Frame the area.** Fly to the study area at a zoom where the full asset
   layer is visible (`flyTo`). Do not assess assets outside the frame.
2. **Isolate the assets, then the exposed classes.** Filter the asset layer
   (e.g. land use to the asset class in question), then filter the flood layer
   to its high and very-high classes (`setFilter`). Keep lower classes visible
   but muted if the layer supports it.
3. **Add hydrological context.** Ensure the water / flood-extent layer is
   visible (`toggleLayer`); exposure claims without visible water context are
   not verifiable by the user. State when the flood layer is a model rather
   than an observation.
4. **Highlight the worst cluster.** Identify the densest cluster of exposed
   assets and highlight it (`highlight`), then move the camera close enough
   that individual assets are distinguishable.
5. **Report.** Summarize (`report`): count of exposed assets by class, the
   dominant land use among them, and one caveat about model uncertainty.

## Constraints

- Never report exposure counts without stating the filter that produced them.
- If fewer than 5 assets match, say so plainly rather than extrapolating.
- Always end with the single most exposed location, so the user can verify.
