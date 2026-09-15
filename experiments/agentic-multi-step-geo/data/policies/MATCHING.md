# Field ↔ Cadaster matching rules

This document is the **single source of truth** for how agricultural field
boundaries (Trazo3) are matched to the cadastral parcels (CAR) on a list. It is
written so a human *or* an AI agent can change the policy later by editing the
numbers in one place. The build script reads the thresholds from `lists.json`
(the `matching` block, per list, with a project-level default) and passes them
into `sql/list/match.sql.tmpl` — so **changing a rule = editing the config, not
the SQL.**

## The decision, in one sentence

> A field is **included** in a list's analysis if **two-thirds (or more) of the
> field's area lies inside the list's cadastral parcels** — measured either
> against a **single** parcel, or against **all listed parcels taken together**.

Origin: Tristan Grupp (WRI), 2026-07-17. Verbatim guidance is preserved at the
bottom of this file so the intent behind the numbers is never lost.

## The two inclusion tests (a field passes if EITHER is true)

Let `field∩X` = area of the geometric intersection, and `area(field)` = the
field's own area. All areas are compared as **ratios**, so the coordinate system
cancels out (we work in EPSG:4326; a ratio of two areas in the same CRS is
distortion-robust over a single field).

1. **Primary (single-parcel) test.**
   `max over listed parcels i of  area(field ∩ parcel_i) / area(field)  ≥ contain_threshold`
   → the field is mostly inside one parcel. That parcel becomes its **primary**
   cadaster.

2. **Aggregate (whole-list) test.**
   `area(field ∩ UNION(all listed parcels, buffered)) / area(field) ≥ contain_threshold`
   → the field is mostly inside the list *as a whole*, even if split across two
   or more parcels (e.g. ½ in one + ½ in a neighbour). The **primary** cadaster
   for such a field is the parcel it overlaps most, chosen by the rule below.

## Choosing the primary cadaster, including exact ties

Every matched field carries exactly one primary cadaster: the listed parcel
with the largest `area(field ∩ parcel) / area(field)`. **When two or more
parcels come within `primary_tie_tolerance` of that largest fraction, they are
tied, and the primary is the one whose `cod_imovel` sorts lowest** under
ordinary string comparison. The reported `max_single_frac` is still the true
maximum, so the `contain_threshold` test is unaffected by the tie rule.

Ties are common rather than hypothetical. CAR parcels overlap, and a field
lying inside the overlap of two listed parcels intersects each of them in the
same polygon, so the two fractions agree bit for bit. On a sample list a few
dozen matched fields tie exactly.

Which parcel wins matters more than it looks. The primary cadaster decides
where a field's deforestation is attributed, so it decides which parcels reach
the flagged set and therefore the answer to every per-cadaster question
downstream. Any tie-break would serve; the requirement is that one is written
down, so that two correct implementations agree.

### Where `primary_tie_tolerance` comes from

It is measured, not chosen. The same intersection measured three defensible
ways — planar area in EPSG:4326 degrees, area after reprojection to EPSG:5880,
and `ST_Area_Spheroid` on the lat/lon geometry — gives fractions that differ by
a median of 1e-12 to 1e-11, a 99th percentile of 6e-5, and a maximum of 3e-3.
Method choice therefore moves a fraction, and a rule that ranks on the raw
value hands some fields to whichever method the implementer picked. Switching
the oracle from planar to spheroid areas changes the primary cadaster of 2 of
872 fields.

Those 2 fields are exactly the ones whose top two parcels sit within the noise:
their fractions differ by 1.2e-11 and 1.7e-10, at or below the median spread
between methods. The nearest genuinely separated pair differs by 1.6e-8.
`primary_tie_tolerance` is set at **1e-9**, in the gap between them: sixteen
times wider than the noise it absorbs and sixteen times narrower than the
closest real difference. It is deliberately far below the 99th percentile
spread, because a tolerance wide enough to cover every method disagreement
would turn genuine winners into ties.

The tolerance closes the cases where no method can tell the parcels apart. It
does not make the whole rule method-independent, and it is not meant to.

The union in test 2 is built from the listed parcels **buffered outward by
`neighbor_gap_tolerance_m`** and dissolved together *before* intersecting the
field. This is what implements Tristan's "touch or are direct neighbours (slight
gap between geometries)" clause: CAR parcels frequently have thin sliver gaps
between adjacent properties, so a small buffer closes those gaps and lets a field
straddling two neighbouring listed parcels count as contiguous. Buffering also
means the aggregate test never *under*-counts a field that sits in a sliver.

Because the aggregate test intersects against the **dissolved union**, it does
**not** double-count areas where two listed parcels overlap (CAR parcels can
overlap) — unlike a naive "sum of per-parcel fractions", which can exceed 1.0.
The union is the correct, conservative interpretation of "sum of crossovers".

## Parameters (defaults; override per list in `lists.json → matching`)

| Parameter | Default | Meaning | To change… |
|---|---|---|---|
| `contain_threshold` | `0.667` | the 2/3 inclusion bar (fraction of field area) | raise → stricter (fewer fields); lower → looser |
| `neighbor_gap_tolerance_m` | `25` | outward buffer (metres) applied to parcels before the union, to close CAR sliver gaps between neighbours | raise if neighbouring parcels have larger gaps; set `0` to disable neighbour bridging |
| `primary_tie_tolerance` | `1e-9` | how close two containment fractions must be to count as tied for the primary cadaster | raise only with a fresh measurement of method spread; set `0` to tie on bit-equality alone |

`neighbor_gap_tolerance_m` is converted to degrees for the EPSG:4326 buffer as
`deg = metres / 111320` (metres-per-degree at the equator; the small
latitudinal error is immaterial for closing ~25 m slivers). This approximation
is intentional and documented; if sub-metre buffering ever matters, reproject to
a Brazilian equal-area CRS (e.g. EPSG:5880) in `match.sql.tmpl` instead.

## What each matched field carries forward

For every included field the match step records, so the report and any reviewer
can see *why* it was included:

- `cod_imovel` — its **primary** cadaster (for the per-cadaster rollup).
- `max_single_frac` — best single-parcel containment fraction.
- `union_frac` — whole-list containment fraction.
- `by_primary`, `by_aggregate` — which test(s) it passed (a field can pass both).

Fields failing **both** tests are dropped and counted (see
`l07_match_reconciliation.sql`) so the exclusion is auditable, never silent.

## Known edge cases & how they resolve

- **Field spanning two listed neighbours (½ + ½).** Fails test 1, passes test 2
  (union). Included; primary = the parcel with the larger half, or the lower
  `cod_imovel` if the halves are exactly equal.
- **Field mostly outside the list (e.g. 40% in one listed parcel, rest in
  unlisted land).** Fails both tests. Excluded.
- **Overlapping CAR parcels.** The union dissolves the overlap, so the aggregate
  fraction stays ≤ 1.0. A field sitting inside the overlap intersects both
  parcels equally and takes the lower `cod_imovel` as its primary.
- **A listed `cod_imovel` not found in CAR.** Reported as a missing parcel in
  `l07`; contributes no geometry to the union.
- **A listed `cod_imovel` found in CAR more than once.** CAR carries fewer
  distinct ids than rows, so an id can carry several geometries. Each row counts
  as its own parcel in test 1, so the single-parcel fraction is the best of them
  rather than their combined coverage, while test 2 dissolves them into the
  union like any other overlap. A list that hits this should expect the
  single-parcel test to be the conservative one.

---

## Tristan's original guidance (verbatim, 2026-07-17)

> Looking at how the fields boundaries match with the cadastral data, I think we
> should match them if they are 2/3 contained within the cadastral boundaries
> individually OR if cadastral boundaries touch or are direct neighbors (slight
> gap between geometries), they should be matched to that cadaster.
>
> Like, if 2/3 within, then include. If less than 2/3 within one boundary but 1/2
> within 1 in the list and 1/2 within another in the list, then include. If the
> sum of crossovers for a field between cadasters in the list is greater than or
> equal to 2/3, then include that field in the next analysis.
>
> Something like this. We'd need a way to document all of these decisions for the
> AI agent in case we need to change them later on.
