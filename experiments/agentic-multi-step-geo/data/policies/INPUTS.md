# Input list handling

The analysis starts from a list of cadastral properties. The list may arrive in
three encodings, and may contain defects. Handle every case below explicitly.
Never drop a row silently: an omitted property is an un-audited sourcing area,
which is the exact failure an EUDR workflow exists to prevent.

## Encodings

1. **`csv`** — a CSV with a `cod_imovel` column, and a `geometry` column in WKT
   carrying whatever geometry a row arrived with. Most rows are an ID and an
   empty geometry cell: resolve those against the CAR parcel file to recover
   their shape. A row with a geometry and no ID resolves the other way round.
2. **`geometry`** — a GeoParquet or GeoJSON file of parcel geometries, which may
   or may not carry an ID column.
3. **`split`** — a CSV of IDs plus a separate geometry file, joined on the ID
   column.

The encoding is named for you at run time. Detect the columns you actually have
rather than assuming a fixed schema.

## Defects and required handling

| Defect | Required handling |
|---|---|
| The same `cod_imovel` appears more than once with identical geometry | Deduplicate on (id, geometry). Count the duplicates and report the count. |
| A row carries a point (centroid) where a polygon is expected | Resolve by locating the CAR parcel that contains the point. Mark the row `centroid_resolved`. |
| A polygon with no ID | Resolve by geometric match against CAR (the parcel it falls inside, per MATCHING.md containment). Mark the row `geometry_resolved`. |
| A centroid with no ID | Attempt point-in-parcel resolution against CAR. If it lands in exactly one parcel, resolve and mark `centroid_resolved`. If it resolves to none or to several, it is **unresolvable** — report it with a count, never guess, never drop. |
| A geometry whose coordinates fall outside Brazil, but land inside it once latitude and longitude are exchanged | The axes are swapped. Repair by exchanging them back, then resolve the repaired geometry as any other. Mark the row `axis_repaired`. A geometry that is outside Brazil under both orderings is not an axis flip: it is **unresolvable**. |

## Reconciliation

Every reconciliation output must account for all input rows. These must sum to
the input row count:

`resolved_clean + centroid_resolved + geometry_resolved + axis_repaired + duplicates_removed + unresolvable = input_rows`

Every input row lands in exactly one bucket, `input_rows` counts rows as they
arrived rather than after any deduplication, and a row repaired one way is not
counted again under another. `axis_repaired` is its own bucket rather than part
of `geometry_resolved` because an axis flip is a coordinate-order fault, not a
missing identifier, and the two are worth telling apart in a review.

A property that cannot be tied to a cadastral parcel does not disappear from the
report — it appears in the unresolvable count, so a reviewer can see exactly what
was left out and why.

## Why the strictness

The whole portfolio is the audit surface. A centroid that "looks close" to a
parcel but sits just outside it is not a match; a duplicate silently collapsed
without a count hides a data-quality signal; an ID-less polygon dropped because
it is inconvenient removes real sourcing land from the deforestation check. The
adversarial input set exists precisely to catch a workflow that takes any of
those shortcuts.
