# /// script
# requires-python = ">=3.11"
# dependencies = [
#     "marimo",
#     "pandas==2.3.3",
#     "requests==2.32.5",
# ]
# ///

import marimo

__generated_with = "0.17.2"
app = marimo.App(width="medium")


@app.cell(hide_code=True)
def _(mo):
    mo.md(
        r"""
    ## ArcGIS Hub (WRI Data Catalogue) → `wri_arcgis_catalog_01.csv`

    **What this does**

    * Crawls the ArcGIS Hub Search **dataset collection** and normalizes item metadata.

    **Endpoints**

    * Discovery: `GET /api/search/v1/collections` (used to find the `dataset` collection)
    * Data: `GET /api/search/v1/collections/dataset/items?limit=100`
      (follow `links[]` where `rel="next"` until exhausted)

    **Structure**

    * Response is GeoJSON: top-level `features[]`; each feature has `properties{…}`.

    **Fields captured (per item)**

    * `id`, `name` (title), `slug` (if present), `provider` (owner/source), `tags`
    * Timestamps (epoch ms → ISO): `createdAt`, `dataLastUpdated`, `updatedAt`
    * `license`, `type`, `url` (from `properties.links`)
    * Descriptions: raw `description` (HTML stripped) + `conciseDescription` (first 1–2 sentences)
    * Best-effort parsed extras from long text: `source`, `scale_resolution`, `update_frequency`, `area_covered`

    **Implementation notes**

    * Descriptions can be verbose; we strip HTML and add a short summary field.
    * The dataset collection on this Hub currently returns a small, curated set (we observed `numberMatched` ≈ 23). This may change.
    """
    )
    return


@app.cell
def _():
    import marimo as mo
    import requests
    import pandas as pd
    from pprint import pprint
    import json
    import re, html
    import datetime as dt
    from pathlib import Path

    return Path, dt, html, mo, pd, re, requests


@app.cell
def _(Path):
    # Calculate data directory - works whether run from src/ or root
    SCRIPT_DIR = Path.cwd()
    DATA_DIR = SCRIPT_DIR.parent / "data" if SCRIPT_DIR.name == "src" else SCRIPT_DIR / "data"
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    BASE = "https://wri-data-catalogue-worldresources.hub.arcgis.com/api/search/v1/collections/dataset/items"
    return BASE, DATA_DIR


@app.cell
def _(BASE, requests):
    js_first = requests.get(BASE, params={"limit": 1}, timeout=60).json()
    print("Number of datasets we will be fetching: ", js_first["numberMatched"])
    return


@app.cell
def _(BASE, dt, html, pd, re, requests):
    def ms_to_iso(ms):
        if not ms:
            return ""
        try:
            return dt.datetime.utcfromtimestamp(int(ms) / 1000).isoformat() + "Z"
        except Exception:
            return ""

    TAG_RE = re.compile(r"<[^>]+>")
    WS_RE = re.compile(r"\s+")

    def clean_html(s):
        if not s:
            return ""
        # strip tags + unescape entities
        return html.unescape(TAG_RE.sub("", s)).strip()

    def pick_url(links):
        if not isinstance(links, list):
            return ""
        for rel in ("self", "hub", "canonical"):
            for ln in links:
                if isinstance(ln, dict) and ln.get("rel") == rel and ln.get("href"):
                    return ln["href"]
        return ""

    def fetch_all(limit=100):
        url, params = BASE, {"limit": limit}
        while True:
            r = requests.get(url, params=params, timeout=60)
            r.raise_for_status()
            js = r.json()
            for f in js.get("features") or []:
                yield f
            # follow rel=next
            next_href = ""
            for ln in js.get("links") or []:
                if isinstance(ln, dict) and ln.get("rel") == "next" and ln.get("href"):
                    next_href = ln["href"]
                    break
            if not next_href:
                break
            url, params = next_href, None  # next is a full URL

    def normalize_feature(f):
        p = f.get("properties") or {}
        links = p.get("links") or []
        return {
            "id": p.get("id") or f.get("id"),
            "name": p.get("name") or p.get("title"),
            "slug": p.get("slug") or "",
            "provider": p.get("owner") or p.get("source") or "",
            "tags": ", ".join(p.get("tags") or p.get("keywords") or []),
            "layerCount": "",  # not exposed here
            "layerNames": "",  # not exposed here
            "createdAt": ms_to_iso(p.get("created")),
            "dataLastUpdated": ms_to_iso(p.get("modified")),
            "updatedAt": ms_to_iso(p.get("modified")),
            "license": p.get("license") or "",
            "type": p.get("type"),
            "url": pick_url(links),
            "description": clean_html(p.get("description") or p.get("searchDescription") or ""),
        }

    def build_df(limit=100):
        rows = [normalize_feature(f) for f in fetch_all(limit=limit)]
        df = pd.DataFrame(rows)
        # optional: sort by updatedAt desc
        if "updatedAt" in df.columns:
            df = df.sort_values("updatedAt", ascending=False, na_position="last")
        return df

    return build_df, normalize_feature


@app.cell
def _(BASE, normalize_feature, pd, requests):
    # for sanity checks.
    df_preview = pd.DataFrame(
        [
            normalize_feature(f)
            for f in requests.get(BASE, params={"limit": 5}, timeout=60).json().get("features", [])
        ]
    )
    df_preview
    return


@app.cell
def _(build_df):
    # full run:
    df_all = build_df(limit=100)

    df_all
    return (df_all,)


@app.cell
def _(DATA_DIR, df_all):
    ## Write to CSV
    outfilename = DATA_DIR / "wri_arcgis_catalog_01.csv"
    df_all.to_csv(outfilename, index=False, encoding="utf-8")
    print(f"Wrote {len(df_all)} rows to file: {outfilename}")
    return


@app.cell
def _():
    return


@app.cell
def _():
    return


if __name__ == "__main__":
    app.run()
