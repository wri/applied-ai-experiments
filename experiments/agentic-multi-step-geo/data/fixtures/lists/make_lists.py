"""Generate the three input-list encodings, defects included.

The list shipped with this benchmark used to be pristine: 117 rows, 117 distinct
ids, no geometry. Every rule in policies/INPUTS.md therefore described a case
that never occurred, and withholding the document cost a session nothing. This
generator injects one instance of each defect the policy names, so the rules
have something to fire on.

**Every defect is portfolio-preserving.** Handled correctly, the dirty list
resolves to the same 117 parcels the clean list resolved to, so q06 through q30
keep their answers. A session that mishandles a defect resolves to a different
parcel set and cascades, which is the signal. The one addition that is not a
parcel — the unresolvable point — is counted rather than resolved, so it moves
the reconciliation and nothing else.

Each defect is derived from a named real parcel (see DONORS), so a reviewer can
trace any row in any encoding back to the parcel it came from. Nothing is
sourced: the geometries come from the cached CAR extract that oracle/render.py
already wrote, which is why this script needs no network and no RNG. Same
inputs, byte-identical outputs.

Usage:
    python fixtures/lists/make_lists.py [--work fixtures/golden/_work]
"""

from __future__ import annotations

import argparse
import csv
from pathlib import Path

import duckdb

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
LISTS_DIR = Path(__file__).resolve().parent

# The parcels each defect is derived from. All four are large (2500 ha and up),
# and none is contained in another listed parcel or holds another parcel's
# centroid — so resolving a defect geometry back to its donor is unambiguous
# under MATCHING.md containment. Swapping a donor is allowed; the resolved-set
# test in tests/test_oracle.py fails if the replacement is ambiguous.
DONORS = {
    # Repeated verbatim. The only non-Jussara parcel on the list, so a duplicate
    # of it is visible at a glance in the rendered CSV.
    "duplicate": "GO-5207600-E22FF9A4A75344D3994CB002B90B6686",
    # Its centroid, shipped alone. 4986.8 ha, Jussara.
    "centroid": "GO-5212204-15108D4D7C134B8D9E71E50A2ED2E605",
    # Its polygon, shipped with the id stripped. 3757.7 ha, Jussara.
    "geometry": "GO-5212204-6A28AC5AF7BF4BEC8931E8E154D99AEE",
    # Its polygon with the axes swapped. 3724.8 ha, Jussara.
    "axis_flip": "GO-5212204-F17BEA20B17148C1ADB4BD53A04EC448",
}

# A centroid that lands in no parcel: the Atlantic off Sergipe. It sits inside
# Brazil's bounding box, so the axis-repair rule never looks at it and cannot
# rescue it — it fails on containment, which is the case INPUTS.md names, rather
# than on being on the wrong continent.
UNRESOLVABLE_POINT = "POINT (-35 -10)"

CSV_COLUMNS = ["cod_imovel", "municipio", "cod_estado", "geometry"]


def load_parcels(work: Path) -> list[dict]:
    """Read the cached CAR extract, ordered so the output never moves.

    oracle/render.py writes this parquet on its first run and reuses it after;
    it is gitignored because it is regenerable. Without it there is nothing to
    derive defects from, so say so rather than emitting a truncated list.
    """
    cad = work / "cad.parquet"
    if not cad.exists():
        raise SystemExit(
            f"{cad} not found. Run `python oracle/render.py` once to pull the "
            "CAR extract, then re-run this generator."
        )
    con = duckdb.connect()
    con.execute("INSTALL spatial; LOAD spatial;")
    # CAR is longitude-first, and the axis-flip defect below is built by
    # swapping that order. Declaring it here is what makes the swap mean
    # something rather than depending on a session default.
    con.execute("SET geometry_always_xy = true")
    rows = con.execute(
        """
        SELECT cod_imovel, municipio, cod_estado,
               ST_AsText(geometry)                          AS wkt,
               ST_AsText(ST_Centroid(geometry))             AS centroid_wkt,
               ST_AsText(ST_FlipCoordinates(geometry))      AS flipped_wkt
        FROM read_parquet(?)
        ORDER BY cod_imovel
        """,
        [cad.as_posix()],
    ).fetchall()
    con.close()
    parcels = [
        {"cod_imovel": r[0], "municipio": r[1], "cod_estado": r[2],
         "wkt": r[3], "centroid_wkt": r[4], "flipped_wkt": r[5]}
        for r in rows
    ]
    missing = sorted(set(DONORS.values()) - {p["cod_imovel"] for p in parcels})
    if missing:
        raise SystemExit(f"donor parcels absent from the CAR extract: {missing}")
    return parcels


def build_rows(parcels: list[dict]) -> list[dict]:
    """Assemble the list: 117 parcels, three of them damaged, two rows added.

    Each row carries `cod_imovel` and `geometry` as the *encodings* see them —
    an empty string where the encoding has nothing — plus `resolves_to`, the
    parcel correct handling must land on, which is what the sibling assertions
    in the tests check against. `resolves_to` is documentation and a test
    fixture; it is never written to any of the three files, because handing a
    session the answer key would defeat the exercise.
    """
    by_id = {p["cod_imovel"]: p for p in parcels}
    rows = []
    for p in parcels:
        pid = p["cod_imovel"]
        if pid == DONORS["centroid"]:
            # Defect: a point where a polygon is expected, and no id to fall
            # back on. Resolves by point-in-parcel (INPUTS.md).
            rows.append({
                "cod_imovel": "", "municipio": "", "cod_estado": "",
                "geometry": p["centroid_wkt"], "parcel_geometry":
                p["centroid_wkt"], "defect": "centroid", "resolves_to": pid,
            })
        elif pid == DONORS["geometry"]:
            # Defect: a polygon with no id. Resolves by containment.
            rows.append({
                "cod_imovel": "", "municipio": "", "cod_estado": "",
                "geometry": p["wkt"], "parcel_geometry": p["wkt"],
                "defect": "geometry", "resolves_to": pid,
            })
        elif pid == DONORS["axis_flip"]:
            # Defect: latitude and longitude swapped, which puts a Goiás farm in
            # the South Atlantic. Resolves after the swap is undone.
            rows.append({
                "cod_imovel": "", "municipio": "", "cod_estado": "",
                "geometry": p["flipped_wkt"], "parcel_geometry":
                p["flipped_wkt"], "defect": "axis_flip", "resolves_to": pid,
            })
        else:
            rows.append({
                "cod_imovel": pid, "municipio": p["municipio"],
                "cod_estado": p["cod_estado"], "geometry": "",
                "parcel_geometry": p["wkt"], "defect": "", "resolves_to": pid,
            })

    # Defect: the same id twice, identical in every column. Deduplicated on
    # (id, geometry) and counted.
    dup = by_id[DONORS["duplicate"]]
    rows.append({
        "cod_imovel": dup["cod_imovel"], "municipio": dup["municipio"],
        "cod_estado": dup["cod_estado"], "geometry": "",
        "parcel_geometry": dup["wkt"], "defect": "duplicate",
        "resolves_to": dup["cod_imovel"],
    })

    # Defect: a centroid landing in no parcel. Counted, never guessed at, never
    # dropped — the whole point of the unresolvable bucket.
    rows.append({
        "cod_imovel": "", "municipio": "", "cod_estado": "",
        "geometry": UNRESOLVABLE_POINT, "parcel_geometry": UNRESOLVABLE_POINT,
        "defect": "unresolvable", "resolves_to": "",
    })
    return rows


def write_csv(rows: list[dict], path: Path) -> None:
    """The `csv` encoding: ids, plus WKT on the rows that arrived without one."""
    with open(path, "w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=CSV_COLUMNS, lineterminator="\n")
        writer.writeheader()
        for row in rows:
            writer.writerow({c: row[c] for c in CSV_COLUMNS})


def write_parquets(rows: list[dict], geometry_path: Path, split_path: Path) -> None:
    """The `geometry` and `split` encodings.

    `geometry` is every row as a geometry: the clean rows carry their parcel
    polygon rather than the empty cell the CSV gives them, which is what makes
    it a geometry file rather than a CSV with a column bolted on. The defect
    rows carry the damaged geometry, so the two encodings resolve identically.

    `split` is the id-to-polygon side of the CSV pairing, holding only the rows
    that have an id to join on. The id-less defects reach a split-mode session
    through the CSV's WKT column, the same way they reach a csv-mode one.
    """
    con = duckdb.connect()
    con.execute("INSTALL spatial; LOAD spatial;")
    con.execute("SET geometry_always_xy = true")
    con.execute(
        "CREATE TABLE staged (cod_imovel VARCHAR, municipio VARCHAR, "
        "cod_estado VARCHAR, wkt VARCHAR)"
    )
    con.executemany(
        "INSERT INTO staged VALUES (?, ?, ?, ?)",
        [(r["cod_imovel"], r["municipio"], r["cod_estado"], r["parcel_geometry"])
         for r in rows],
    )
    con.execute(
        """
        COPY (SELECT cod_imovel, municipio, cod_estado,
                     ST_SetCRS(ST_GeomFromText(wkt), 'EPSG:4326') AS geometry
              FROM staged)
        TO ? (FORMAT PARQUET)
        """,
        [geometry_path.as_posix()],
    )
    con.execute(
        """
        COPY (SELECT cod_imovel,
                     ST_SetCRS(ST_GeomFromText(wkt), 'EPSG:4326') AS geometry
              FROM staged WHERE cod_imovel <> '')
        TO ? (FORMAT PARQUET)
        """,
        [split_path.as_posix()],
    )
    con.close()


def generate(work: Path, out_dir: Path) -> list[dict]:
    rows = build_rows(load_parcels(work))
    write_csv(rows, out_dir / "goias-sample.csv")
    write_parquets(rows, out_dir / "goias-sample.parquet",
                   out_dir / "goias-sample-geom.parquet")
    return rows


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--work", type=Path,
                    default=REPO_ROOT / "fixtures/golden/_work",
                    help="where oracle/render.py cached the CAR extract")
    ap.add_argument("--out", type=Path, default=LISTS_DIR)
    args = ap.parse_args()
    rows = generate(args.work, args.out)
    defects = sorted({r["defect"] for r in rows if r["defect"]})
    print(f"wrote 3 encodings of {len(rows)} rows to {args.out}")
    print(f"defects: {', '.join(defects)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
