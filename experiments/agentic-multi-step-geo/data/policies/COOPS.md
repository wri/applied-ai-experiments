# Cadaster → cooperative / buyer candidate matching

This document is the **single source of truth** for how a cadaster on a list is
matched to the cooperative(s) and buyer(s) it should be *put in contact with*
about deforestation on its land. Like [`MATCHING.md`](MATCHING.md), it is written
so a human *or* an AI agent can change the policy by editing numbers in one place:
the build reads the thresholds from `lists.json` (the `coops` block, per-project
default) and passes them into `sql/list/coop_match.sql.tmpl` — so **changing a
rule = editing the config, not the SQL.**

## The decision, in one sentence

> Each cadaster gets a **ranked set of candidates** — never a single forced
> assignment. A wrong single match sends a trader to the wrong organisation about
> a named farmer's land; two candidates with evidence beat one confident guess.

## Two families of evidence, both surfaced, never collapsed

- **"Who has the relationship?"** — the cooperative that counts this farmer as a
  member. The influence lever. Matched **by município**.
- **"Where would they deliver?"** — the nearest silo (grain), slaughterhouse
  (cattle), or mill (sugar cane). The logistics lever. Matched **by distance**,
  município-agnostic.

Both are real levers; the report shows both and lets the human weigh them.

## The tiers (consumed from the `soft_commodity_infrastructure/` product)

| Tier | Answers | Entity | Basis | Match rule |
|---|---|---|---|---|
| `membership_muni` | relationship | cooperative | observed | município code = cadaster's |
| `intake_point` | delivery (grain) | coop silo | observed | distance ≤ radius |
| `slaughter_point` | delivery (cattle) | **buyer** | observed | distance ≤ radius |
| `mill_point` | delivery (sugar cane) | **mill** | observed | distance ≤ radius |
| `gravity_catchment` | delivery | coop | **modelled** | cadaster in catchment |

`branch_footprint` and `hq_point` (RFB) arrive with Plan 1b. `slaughter_point` and
`mill_point` are **buyers**, not co-ops — flagged `entity_kind='buyer'` /
`'mill'` so the report never implies a membership relationship.

`mill_point` is ranked below the other two delivery tiers because ANP publishes no
street address for mills: each sits at its town's centroid, so its distance is
town-to-cadaster, not gate-to-cadaster. Every mill candidate carries the flag
`town_centroid`, and mills are **excluded from the proximity override** — a
centroid landing inside 10 km is an artefact of the geocode, not evidence.

## Ranking — observed relationship before modelled proximity

1. `membership_muni` → 2. `intake_point` / `slaughter_point` → 3. `mill_point` →
4. `gravity_catchment`

with two overrides:

- **Commodity routes the delivery tier.** The cadaster's dominant crop (Trazo
  `mbmode24`) selects which delivery tier survives. The rules live in the
  routing table in [`EUDR_CROPS.md`](EUDR_CROPS.md) — one editable place shared
  with the EUDR scope queries, not duplicated in SQL:

  | `mbmode24` | Keeps | Drops |
  |---|---|---|
  | Pasture (15), Mosaic of Uses (21) | `slaughter_point` | silo, catchment, mill |
  | Sugar cane (20) | `mill_point` | silo, catchment, slaughter |
  | Soybean (39), Other Temporary (41) | `intake_point`, catchment | slaughter, mill |
  | Agriculture (18) | `intake_point`, catchment, `mill_point` | slaughter |
  | Coffee (46), Palm Oil (35) | nothing | every delivery tier |
  | unknown / NULL | everything | — |

  Class 18 is MapBiomas' generic agriculture parent and can itself *be* cane, so it
  deliberately keeps both grain and mill rather than guessing. Class 21 is a
  mixed-use mosaic assumed to be pasture, and that assumption is carried as a
  caveat on every number derived from it.

  Coffee and palm keep **no** delivery candidate: they are real EUDR commodities,
  but the facilities product has no tier for either, so the cadaster gets its
  membership relationship and a reported `no_match`. Substituting a grain silo
  would name an organisation with no relationship to that farm.
- **Cross-border proximity override.** A delivery facility closer than
  `proximity_override_km` is promoted to the top and flagged `nearest_by_far`,
  while the relationship match is still shown. Delivery matching is **never gated
  on município** — a silo just across a municipal line competes on equal footing.
  Mills do not participate (see above).

### Ties in the ranking

The full order is: `nearest_by_far` promotions first, then the tier order
above, then `distance_km` ascending with catchment candidates (no distance)
last, then `evidence_value` descending. **Where two candidates are equal on all
of those, the lower `entity_id` ranks first.**

Distance ties are ordinary, not exotic. On a sample list dozens of cadasters
have two facilities at an identical distance, and for some of them the tie is
for the single nearest delivery point. Without the `entity_id` rule those
rankings fall to scan order, and the `max_candidates` cap then drops whichever
candidate the query plan happened to plough last.

The same reasoning applies as in [`MATCHING.md`](MATCHING.md): the tie-break
does not have to be meaningful, but it does have to be written down, or two
correct implementations disagree. Unlike the containment fractions there, these
distances carry no tolerance — a `distance_km` computed a slightly different
way can still order two near-equal facilities either way.

## Widening — target a count, not a radius

If fewer than `min_candidates` delivery candidates fall within `intake_km`, widen
the radius toward `intake_km_ceiling` until the count is met. When widening
happened, mark `widened`; when even the ceiling yields none, mark `no_match` — a
match failure is **reported, never hidden** (see `l09`). Measured rationale: for
a município on a sample list the nearest cooperative silo lay well beyond half
the initial radius, so a fixed radius returned a single operator, which violates
"give people options"; widening to a count is what actually serves the user.

## Parameters (defaults; override per list in `lists.json → coops`)

| Parameter | Default | Meaning |
|---|---|---|
| `max_candidates` | 5 | cap on listed candidates per cadaster |
| `min_candidates` | 2 | widen until this many delivery candidates exist |
| `intake_km` | 100 | initial delivery radius (58 km is *not* far for rural Brazil — widening is expected, not failure) |
| `intake_km_ceiling` | 300 | hard stop; beyond this, report `no_match` |
| `proximity_override_km` | 10 | a delivery point closer than this is surfaced first (`nearest_by_far`) |
| `gravity_decay` | 2.0 | distance exponent for the modelled catchment |
| `min_capacity_t` | 1000 | ignore trivial storage units — **gates `intake_point` only**, since slaughter capacity is a band and mill capacity is m³/day, neither of them tonnes |

Distances are computed in **EPSG:5880** (SIRGAS 2000 Brazil Polyconic), *not* in
degrees — unlike the areal ratios in `MATCHING.md`, which are CRS-cancelling.

They run from the **cadastral parcel's centroid** to the facility point. A large
property spans several kilometres, so measuring from its centroid and measuring
from its nearest boundary give materially different answers, and every ranking
threshold here — `intake_km`, `intake_km_ceiling`, `proximity_override_km` — is
read against the centroid figure.

## What each candidate carries forward

For every candidate the match records, so the report and any reviewer can see
*why* it was surfaced:

- `tier`, `basis` (observed | modelled), `entity_kind` (cooperative | buyer)
- `distance_km` (delivery tiers), `evidence_value` (membership count / capacity)
- `rank` and any `flags` (`widened`, `no_match`, `nearest_by_far`)

Cadasters and the candidates considered-and-rejected are counted in
`l09_coop_reconciliation.sql` so nothing is silently dropped — the same
auditable-exclusion discipline as `l07`.

The cap is applied before that count: ranking runs over every candidate, the
top `max_candidates` per cadaster are kept, and reconciliation counts what was
kept. So `n_candidates` never exceeds `max_candidates`, and a cadaster with
forty candidates in range reports five. Ranking decides which five, which is
what the tier order and the `nearest_by_far` promotion are for.
