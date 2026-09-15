"""Generate golden fixtures by running the vendored rural-land SQL.

The oracle is why the expert answers in this benchmark are auditable: every
golden value is the output of a query committed under oracle/sql/, pinned to a
rural-land commit recorded in fixtures/pins.json. Nobody types an answer.

The pipeline (eudr_crops -> cad_extract -> fields_extract -> match ->
coop_match) runs once against the pinned remote catalogs, leaving intermediate
parquets in a work dir. Each question query then reads those and its result is
sliced to the question's output columns, written to fixtures/golden/qNN.csv,
and checksummed into SHA256SUMS. workflow.csv (the stage-7 comparison target) is
emitted too but excluded from the manifest.

Usage:
    python oracle/render.py [--out fixtures/golden] [--pins fixtures/pins.json]
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import string
import time
from pathlib import Path

import duckdb

REPO_ROOT = Path(__file__).resolve().parent.parent
SQL_DIR = Path(__file__).resolve().parent / "sql"

# Stages run in order; later stages read the parquets earlier ones write.
# list_resolve comes before cad_extract and must: it is what turns the raw input
# list into the id set cad_extract filters on, and a row that arrived as a bare
# geometry cannot be resolved from an extract that already filtered by id.
PIPELINE = ["eudr_crops", "list_resolve", "cad_extract", "fields_extract",
            "match", "coop_match"]

# The stages that pull from source.coop, and the parquet each produces. Once
# pulled, the extract is cached: the cold 3.7 GB CAR scan and the Trazo3 field
# scan happen once, and every golden regeneration after reuses them (mirrors
# build_lists.sh, whose cached extracts are what made local reruns fast). Pass
# --force to re-pull. The local stages (cad_extract, match, coop_match, all
# query views) are fast and always re-run.
#
# list_resolve owns the CAR scan now, and caches the state slice it read as
# CAR_STATE_PARQUET so cad_extract can select from disk. That keeps the cold
# path at one remote scan even though two stages need CAR rows.
#
# A stage is cached only when every parquet it writes is present. list_resolve
# writes two, and half a cache is not a cache: skipping it on a stale directory
# that kept the CAR slice but lost the resolution would run the whole pipeline
# against a missing file.
CACHEABLE = {
    "list_resolve": ["CAR_STATE_PARQUET", "RESOLVED_PARQUET"],
    "fields_extract": ["FIELDS_RAW_PARQUET"],
}

# Which query answers which question, and how to slice its result:
#   (sql template stem, ordered output columns, row limit or None).
# Every stem must end by creating a view named _q holding its result.
QUESTION_MAP = {
    "q01": ("meta_catalogs", ["n_collections", "recommended_id"], None),
    "q02": ("meta_facilities", ["tier", "n"], None),
    "q03": ("meta_car", ["n_rows", "n_distinct_ids"], None),
    "q04": ("meta_trazo", ["n_rows", "epsg"], None),
    "q05": ("cad_resolution", ["list_ids", "found_in_car", "missing"], None),
    "q06": ("cad_muni", ["municipio", "n_parcels"], None),
    "q07": ("cad_quality", ["n_duplicate_ids", "n_parcels_under_1ha"], None),
    "q08": ("fields_envelope", ["n_fields_in_envelope"], None),
    "q09": ("match_count", ["matched_fields"], None),
    "q10": ("prov/l07_match_reconciliation",
            ["by_single_parcel_rule", "by_aggregate_rule_only"], None),
    "q11": ("prov/l07_match_reconciliation",
            ["min_single_frac", "avg_single_frac", "avg_union_frac"], None),
    "q12": ("match_excluded", ["n_excluded"], None),
    "q13": ("cad_field_counts", ["cod_imovel", "n_fields"], 10),
    "q14": ("prov/l07_match_reconciliation", ["matched_field_ha"], None),
    "q15": ("prov/l01_list_overview",
            ["n_parcels", "n_fields", "matched_field_ha", "post2020_loss_ha",
             "fields_with_post2020_loss"], None),
    "q16": ("eudr_classes_present",
            ["mbmode24", "mb_class", "annex1_commodity", "in_scope", "caveat"],
            None),
    "q17": ("eudr_loss_by_commodity",
            ["annex1_commodity", "n_fields", "post2020_loss_ha"], None),
    "q18": ("eudr_loss_excluded", ["mb_class", "n_fields", "post2020_loss_ha"],
            None),
    "q19": ("eudr_area_by_commodity",
            ["annex1_commodity", "total_ha", "loss_share"], None),
    "q20": ("eudr_worst_cadasters",
            ["cod_imovel", "municipio", "post2020_loss_ha",
             "n_fields_post2020_loss"], 10),
    "q21": ("prov/l03_loss_by_era", ["era", "cleared_ha", "pct_of_loss"], None),
    "q22": ("prov/l04_lossyear_histogram", ["loss_year", "n_fields", "cleared_ha"],
            None),
    "q23": ("eudr_worst_plots",
            ["field_id", "cod_imovel", "annex1_commodity", "field_area_ha",
             "post2020_loss_ha"], 10),
    "q24": ("coop_routing",
            ["cod_imovel", "dominant_mb", "annex1_commodity", "routed_tier"],
            None),
    "q25": ("coop_coverage", ["annex1_commodity", "tier", "coverage"], None),
    "q26": ("coop_nearest", ["cod_imovel", "entity_id", "tier", "distance_km"],
            None),
    "q27": ("coop_membership", ["cod_imovel", "entity_id", "evidence"], None),
    "q28": ("coop_reconciliation",
            ["cod_imovel", "n_candidates", "n_relationship", "n_delivery",
             "widened", "no_match", "proximity_override"], None),
    "q29": ("coop_summary", ["n_widened", "n_no_match", "n_nearest_by_far"], None),
    "q30": ("portfolio",
            ["cod_imovel", "annex1_commodity", "post2020_loss_ha", "entity_id",
             "entity_kind", "tier", "basis", "distance_km"], None),
    "q31": ("list_reconciliation",
            ["input_rows", "resolved_clean", "centroid_resolved",
             "geometry_resolved", "axis_repaired", "duplicates_removed",
             "unresolvable"], None),
}


def substitutions(pins: dict, work: Path) -> dict:
    cat = pins["catalogs"]
    gap_m = pins["matching"]["neighbor_gap_tolerance_m"]
    return {
        "LIST_CSV": (REPO_ROOT / "fixtures/lists/goias-sample.csv").as_posix(),
        "ID_COLUMN": "cod_imovel",
        "CAR_URL": cat["cadastral"]["car_parquet"],
        "TRAZO_URL": cat["trazo"]["goias_parquet"],
        "COOP_GEOMS": cat["facilities"]["facilities_parquet"],
        "CAR_STATE_PARQUET": (work / "car_state.parquet").as_posix(),
        "RESOLVED_PARQUET": (work / "resolved.parquet").as_posix(),
        "CAD_PARQUET": (work / "cad.parquet").as_posix(),
        "FIELDS_RAW_PARQUET": (work / "fields.parquet").as_posix(),
        "MATCHED_PARQUET": (work / "matched.parquet").as_posix(),
        "CAD_MATCHED_PARQUET": (work / "cad_matched.parquet").as_posix(),
        "CADASTERS_PARQUET": (work / "cad_matched.parquet").as_posix(),
        "CANDIDATES_PARQUET": (work / "candidates.parquet").as_posix(),
        "EUDR_CROPS_PARQUET": (work / "eudr_crops.parquet").as_posix(),
        "CROP_ROUTING_PARQUET": (work / "crop_routing.parquet").as_posix(),
        "CUTOFF_YEAR": "2020",
        "CONTAIN_THRESHOLD": str(pins["matching"]["contain_threshold"]),
        # Formatted rather than str()'d: str(1e-09) is "1e-09", which DuckDB
        # reads as a float fine but which reads as a typo in a rendered query.
        "PRIMARY_TIE_TOLERANCE": f"{pins['matching']['primary_tie_tolerance']:.12f}",
        "GAP_DEG": f"{gap_m / 111320:.8f}",
        "INTAKE_KM": str(pins["coops"]["intake_km"]),
        "INTAKE_KM_CEILING": str(pins["coops"]["intake_km_ceiling"]),
        "MIN_CANDIDATES": str(pins["coops"]["min_candidates"]),
        "MAX_CANDIDATES": str(pins["coops"]["max_candidates"]),
        "PROXIMITY_OVERRIDE_KM": str(pins["coops"]["proximity_override_km"]),
        "MIN_CAPACITY_T": str(pins["coops"]["min_capacity_t"]),
        # discovery constants verified against live metadata, pinned in pins.json
        "TRAZO_N_COLLECTIONS": str(cat["trazo"]["n_collections"]),
        "TRAZO_RECOMMENDED": cat["trazo"]["recommended_collection"],
        "TRAZO_EPSG": str(cat["trazo"]["geometry_epsg"]),
    }


def render_sql(stem: str, subs: dict) -> str:
    template = (SQL_DIR / f"{stem}.sql.tmpl").read_text(encoding="utf-8")
    return string.Template(template).substitute(subs)


# The CAR extract full-scans a 3.7 GB remote file with no bbox covering column
# to skip row groups with, so it reads for a while and is exposed to anything
# that interrupts a long transfer.
#
# On some network routes source.coop delivers far less than the range it
# promised and closes: the response carries the right content-length, the body
# stops after a few hundred KB, and DuckDB parses the remainder as a Parquet
# page header and reports "TProtocolException: Invalid data". That reads as a
# corrupt file and is a dropped connection. See
# https://github.com/source-cooperative/data.source.coop/issues/194 -- it is
# route-dependent, and switching VPN exit turned a hard failure into a
# one-minute run, so nothing here can fix it. These settings only keep the
# scan patient enough to survive a slow-but-working route.
HTTP_SETTINGS = {
    "http_timeout": 300,
    "http_retries": 10,
    "http_retry_wait_ms": 1000,
    "http_retry_backoff": 2,
    "http_keep_alive": True,
    "enable_http_metadata_cache": True,
}

# DuckDB retries an HTTP error, not a body that arrived short under a success
# status, so a stage that dies mid-scan is retried here from the top.
STAGE_ATTEMPTS = 3


def tune_for_remote_reads(con: duckdb.DuckDBPyConnection) -> None:
    con.execute("INSTALL httpfs; LOAD httpfs;")
    for name, value in HTTP_SETTINGS.items():
        con.execute(f"SET {name} = ?", [value])


def build_state(con: duckdb.DuckDBPyConnection, subs: dict,
                force: bool = False) -> None:
    """Run the pipeline so every question query has its inputs on disk.

    A cacheable remote-pull stage is skipped when all its output parquets
    already exist (unless force). Every other stage reads those parquets from
    disk and rebuilds the in-memory tables the query views expect (e.g. `cad`,
    `decision`), so they always run — cheap and local.
    """
    tune_for_remote_reads(con)
    for stage in PIPELINE:
        out_keys = CACHEABLE.get(stage, [])
        if out_keys and not force and all(
                Path(subs[key]).exists() for key in out_keys):
            print(f"[{stage}] cached — skipping remote pull", flush=True)
            continue
        print(f"[{stage}] running", flush=True)
        run_stage(con, stage, subs)


def run_stage(con: duckdb.DuckDBPyConnection, stage: str, subs: dict) -> None:
    """Execute one pipeline stage, retrying a read that source.coop truncated.

    Only I/O-shaped failures are retried. A SQL error in a template fails the
    same way every time, and retrying it twice more just delays the traceback.
    """
    sql = render_sql(stage, subs)
    for attempt in range(1, STAGE_ATTEMPTS + 1):
        try:
            con.execute(sql)
            return
        except duckdb.Error as exc:
            if attempt == STAGE_ATTEMPTS or not _is_transport_error(exc):
                raise
            wait = 5 * attempt
            print(f"[{stage}] {type(exc).__name__}: {exc} — retry "
                  f"{attempt}/{STAGE_ATTEMPTS - 1} in {wait}s", flush=True)
            time.sleep(wait)


TRANSPORT_MARKERS = (
    "tprotocolexception",   # truncated body parsed as a Parquet page header
    "invalid data",
    "http error",
    "connection",
    "timeout",
    "curl",
)


def _is_transport_error(exc: Exception) -> bool:
    text = str(exc).lower()
    return any(marker in text for marker in TRANSPORT_MARKERS)


def write_csv(rows: list, columns: list, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", newline="", encoding="utf-8") as fh:
        writer = csv.writer(fh, lineterminator="\n")
        writer.writerow(columns)
        writer.writerows(rows)


def render_all(pins: dict, out_dir: Path, force: bool = False) -> dict:
    work = out_dir / "_work"
    work.mkdir(parents=True, exist_ok=True)
    subs = substitutions(pins, work)

    con = duckdb.connect()
    con.execute("INSTALL httpfs; LOAD httpfs; INSTALL spatial; LOAD spatial;")
    build_state(con, subs, force=force)

    written = {}
    for qid, (stem, columns, limit) in sorted(QUESTION_MAP.items()):
        con.execute(render_sql(stem, subs))
        select = ", ".join(columns)
        query = f"SELECT {select} FROM _q"
        if limit:
            query += f" LIMIT {limit}"
        rows = con.execute(query).fetchall()
        path = out_dir / f"{qid}.csv"
        write_csv(rows, columns, path)
        written[qid] = path

    # stage-7 comparison target: same rows as q30, one column renamed to match
    # the artifact contract the session is asked to produce. Not in SHA256SUMS.
    con.execute(render_sql("portfolio", subs))
    wf_cols = ["cod_imovel", "annex1_commodity", "post2020_loss_ha", "entity_id",
               "entity_kind", "tier", "basis", "distance_km"]
    wf_rows = con.execute(f"SELECT {', '.join(wf_cols)} FROM _q").fetchall()
    out_cols = ["cod_imovel", "annex1_commodity", "post2020_loss_ha",
                "top_contact_entity_id", "entity_kind", "tier", "basis",
                "distance_km"]
    write_csv(wf_rows, out_cols, out_dir / "workflow.csv")

    manifest = out_dir / "SHA256SUMS"
    lines = []
    for qid in sorted(written):
        digest = hashlib.sha256(written[qid].read_bytes()).hexdigest()
        lines.append(f"{digest}  {written[qid].name}")
    manifest.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return written


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--out", type=Path, default=REPO_ROOT / "fixtures/golden")
    ap.add_argument("--pins", type=Path, default=REPO_ROOT / "fixtures/pins.json")
    ap.add_argument("--force", action="store_true",
                    help="re-pull the cached remote extracts (CAR + Trazo scans)")
    args = ap.parse_args()
    pins = json.loads(args.pins.read_text(encoding="utf-8"))
    written = render_all(pins, args.out, force=args.force)
    print(f"wrote {len(written)} golden fixtures to {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
