# EUDR Annex I scope by Mapbiomas class

Single source of truth for which land-cover classes an EUDR analysis covers,
which Annex I commodity each represents, and which delivery tier each routes to.
Like [`MATCHING.md`](MATCHING.md) and [`COOPS.md`](COOPS.md), it is written so a
human *or* an AI agent can change the policy by editing one place: this file and
`sql/list/eudr_crops.sql.tmpl` together.

Regulation (EU) 2023/1115 Annex I covers **cattle, cocoa, coffee, oil palm,
rubber, soya and wood**.

## Scope and routing are two different questions

Sugarcane is outside Annex I but still delivers to a mill. Agriculture (18) is
MapBiomas' generic parent class that can *be* cane, so it keeps both a silo and
a mill. Collapsing scope and routing into one column would delete working
routing, so they are two tables.

### Scope (is this crop covered by the regulation?)

| `mbmode24` | Class | Annex I commodity | In scope | Caveat |
|---|---|---|---|---|
| 15 | Pasture | cattle | yes | |
| 39 | Soybean | soya | yes | |
| 35 | Palm Oil | oil palm | yes | `mixed_detection_quality` |
| 46 | Coffee | coffee | yes | `mixed_detection_quality` |
| 21 | Mosaic of Uses | cattle | yes | `assumed_pasture` |
| 9 | Forest Plantation | wood | **no** | `unreliable_detection` |
| 18 | Agriculture | | no | |
| 20 | Sugarcane | | no | |
| 40 | Rice | | no | |
| 41 | Other Temporary Crops | | no | |
| 47 | Citrus | | no | |
| 48 | Other Perennial | | no | |
| 62 | Cotton | | no | |

### Routing (where would this crop be delivered?)

One row per allowed (class, tier). A class may have several. A class absent from
this table entirely keeps every tier — the "unknown crop" case.

| `mbmode24` | Class | Delivery tiers |
|---|---|---|
| 15 | Pasture | `slaughter_point` |
| 21 | Mosaic of Uses | `slaughter_point` |
| 20 | Sugarcane | `mill_point` |
| 39 | Soybean | `intake_point` |
| 41 | Other Temporary Crops | `intake_point` |
| 18 | Agriculture | `intake_point`, `mill_point` |
| 35 | Palm Oil | none — no infrastructure in the product |
| 46 | Coffee | none — no infrastructure in the product |

`gravity_catchment` follows `intake_point`: it models a silo draw-area, so it
survives wherever `intake_point` does. `membership_muni` is never routed away —
the relationship lever is independent of what the farm grows.

### The dominant class of a mixed parcel

Routing reads one class per cadaster. Where a parcel carries fields of several
classes, its **dominant class is the one covering the most hectares**, with ties
broken by the lower `mbmode24` code.

Hectares, not field count. Field boundaries come in whatever sizes the survey
produced, so a parcel holding four small pasture plots and one large soya plot
grows mostly soya while a count of fields calls it pasture. The rule decides
which delivery tier the parcel routes to, and so decides whether a farmer hears
from a silo or from a slaughterhouse.

## Two different reasons to exclude a crop

Classes 18, 20, 40, 41, 47, 48 and 62 are out of scope because **the regulation
does not cover them**. Class 9 is out of scope because **the sensor cannot see
it** — planted timber is a genuine Annex I commodity, but Trazo does not detect
it reliably, so we decline to report on it rather than report badly.

Conflating those two produces a defensible-looking wrong answer. Any output that
excludes forest plantation must say it was excluded on detection grounds, not
that timber falls outside the regulation.

Cocoa and rubber are omitted: no dedicated Mapbiomas class, and not materially
present in Brazil (TG, 2026-07-24).

## Caveats

- `assumed_pasture` — class 21 is a mixed-use mosaic, assumed pasture. In scope
  as cattle, but the assumption travels with every number derived from it.
- `mixed_detection_quality` — Trazo field delineation for palm and coffee is
  less reliable than for row crops and pasture. In scope, with a stated limit.
- `unreliable_detection` — detection is not good enough to report at all.

## Commodities with no infrastructure

Coffee and oil palm are in EUDR scope but have **no rows in the routing table**.
The `soft-commodity-infrastructure` product carries no facility tier for them:
its own documentation records that rice, cotton, coffee and palm have no
authoritative open geolocated source in Brazil.

A cadaster on those crops keeps its membership candidate and gets no delivery
candidate, and `l09_coop_reconciliation.sql` reports it as `no_match`. Do not
substitute a grain silo for a coffee or palm facility: surfacing the gap is the
correct output, and a wrong facility sends a trader to an organisation with no
relationship to that land.
