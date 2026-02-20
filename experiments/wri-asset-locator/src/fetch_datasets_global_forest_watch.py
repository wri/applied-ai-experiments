# /// script
# requires-python = ">=3.11"
# dependencies = [
#     "marimo",
#     "openai==2.6.1",
#     "pandas==2.3.3",
#     "requests==2.32.5",
# ]
# ///

import marimo

__generated_with = "0.17.2"
app = marimo.App(width="medium")

with app.setup:
    import marimo as mo
    import requests
    import csv, time, sys
    from pathlib import Path

    # for looking at results
    import pandas as pd

    # Calculate data directory - works whether run from src/ or root
    SCRIPT_DIR = Path.cwd()
    DATA_DIR = SCRIPT_DIR.parent / "data" if SCRIPT_DIR.name == "src" else SCRIPT_DIR / "data"
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    BASE = "https://api.resourcewatch.org/v1/dataset"
    OUTFILE = DATA_DIR / "global_forest_watch_datasets.csv"


@app.cell(hide_code=True)
def _():
    mo.md(
        r"""
    # Global Forest Watch datasets → `global_forest_watch_datasets.csv`

    **What this does**

    * Queries the Resource Watch API using the "app=gfw" parameter for public datasets and normalizes them to a flat catalog.

    **Endpoint & filters**

    * `GET https://api.resourcewatch.org/v1/dataset`
    * Query params:
      `application=gfw&env=production&published=true&page[size]=100&page[number]=N`
      (iterate `page[number]` until `meta.total-pages` is reached)

    **Implementation notes**

    * We request `includes=vocabulary,layer` to collect tags and layer names in one pass.
    * Some datasets may have no layers/tags; fields remain empty.
    * API is live; counts change over time. 
    """
    )
    return


@app.cell
def _():
    FIELDS = [
        "id",
        "name",
        "slug",
        "provider",
        "tags",
        "layerCount",
        "layerNames",
        "createdAt",
        "dataLastUpdated",
        "updatedAt",
    ]
    return (FIELDS,)


@app.function
def get_page(page_number, page_size=100, session=None):
    s = session or requests.Session()
    params = {
        "application": "gfw",
        "env": "production",
        "published": "true",
        "includes": "vocabulary,layer",
        "page[size]": page_size,
        "page[number]": page_number,
    }
    for attempt in range(5):
        try:
            r = s.get(BASE, params=params, timeout=60)
            if r.status_code == 429:  # throttled
                time.sleep(1.5 * (attempt + 1))
                continue
            r.raise_for_status()
            return r.json()
        except requests.RequestException as e:
            # transient retry
            if attempt < 4:
                time.sleep(1.5 * (attempt + 1))
                continue
            raise e


@app.function
def extract_rows(js):
    rows = []
    for item in js.get("data", []):
        attr = item.get("attributes", {}) or {}

        # tags from vocabulary (flatten & unique)
        tags = set()
        for vocab in attr.get("vocabulary") or []:
            tags.update(vocab.get("attributes", {}).get("tags", []) or [])
        tags_list = sorted(tags)

        # layer names (if present in include)
        layer_names = []
        for lyr in attr.get("layer") or []:
            if isinstance(lyr, dict):
                nm = (lyr.get("attributes") or {}).get("name") or lyr.get("name")
                if nm:
                    layer_names.append(nm)

        row = {
            "id": item.get("id"),
            "name": attr.get("name"),
            "slug": attr.get("slug"),
            "provider": attr.get("provider"),
            "tags": ", ".join(tags_list) if tags_list else "",
            "layerCount": len(layer_names),
            "layerNames": " | ".join(layer_names) if layer_names else "",
            "createdAt": attr.get("createdAt"),
            "dataLastUpdated": attr.get("dataLastUpdated"),
            "updatedAt": attr.get("updatedAt"),
        }
        rows.append(row)
    return rows


@app.cell
def _(FIELDS):
    def main():
        s = requests.Session()
        first = get_page(1, session=s)
        if not first or "meta" not in first:
            print("Unexpected API response; missing 'meta'.", file=sys.stderr)
            sys.exit(1)

        total_pages = first.get("meta", {}).get("total-pages") or 1
        total_items = first.get("meta", {}).get("total-items")
        print(f"API reports {total_items} items across {total_pages} pages.")

        # open CSV and write header
        with open(OUTFILE, "w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=FIELDS)
            w.writeheader()

            # page 1
            rows = extract_rows(first)
            for r in rows:
                w.writerow(r)

            # remaining pages
            for page_num in range(2, total_pages + 1):
                js = get_page(page_num, session=s)
                rows = extract_rows(js)
                for r in rows:
                    w.writerow(r)
                # be polite; avoid hammering the API
                time.sleep(0.15)

        print(f"Done. Wrote CSV: {OUTFILE}")

    return (main,)


@app.cell
def _():
    run_button = mo.ui.run_button(label="Run")
    run_button
    return (run_button,)


@app.cell
def _(main, run_button):
    mo.stop(not run_button.value)

    main()
    return


@app.cell
def _():
    OUTFILE
    return


@app.cell
def _(FIELDS):
    # mo.stop(not save_button.value)
    df = pd.read_csv(OUTFILE, dtype=str)
    df = df[[*FIELDS]]
    df
    return (df,)


@app.cell
def _(df):
    df.provider.value_counts()
    return


@app.cell
def _():
    ## Gut check What other applications are on resorucewatch's API?

    url = "https://api.resourcewatch.org/v1/dataset"
    params = {
        "page[size]": 1000,
        "page[number]": 1,
        "env": "production",
        # omit `application` filter to get all
    }
    apps = set()
    while True:
        r = requests.get(url, params=params, timeout=60)
        r.raise_for_status()
        js = r.json()
        for item in js.get("data", []):
            attr = item.get("attributes", {})
            for a in attr.get("application", []) or []:
                apps.add(a)
        meta = js.get("meta", {})
        if params["page[number]"] >= (meta.get("total-pages") or 1):
            break
        params["page[number]"] += 1

    print("Distinct applications:", apps)

    return


@app.cell
def _():
    return


if __name__ == "__main__":
    app.run()
