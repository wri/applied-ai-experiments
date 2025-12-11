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

__generated_with = "0.17.7"
app = marimo.App(width="medium")

with app.setup:
    import marimo as mo
    import requests
    import csv, time, sys

    # for looking at results
    import pandas as pd

    BASE = "https://api.resourcewatch.org/v1/dataset"
    OUTFILE = "resourcewatch_datasets.csv"


@app.cell(hide_code=True)
def _():
    mo.md(r"""
    # Resource Watch datasets → `resourcewatch_datasets.csv`

    **What this does**

    * Queries the Resource Watch API for all public datasets and normalizes them to a flat catalog.

    **Endpoint & filters**

    * `GET https://api.resourcewatch.org/v1/dataset`
    * Query params:
      `application=rw&env=production&published=true&page[size]=100&page[number]=N`
      (iterate `page[number]` until `meta.total-pages` is reached)

    **Fields captured (per dataset)**

    * `id`, `name`, `slug`, `provider`, `tags`
    * `layerCount`, `layerNames` (from `includes=layer`)
    * Timestamps: `createdAt`, `dataLastUpdated`, `updatedAt`

    **Implementation notes**

    * We request `includes=vocabulary,layer` to collect tags and layer names in one pass.
    * Some datasets may have no layers/tags; fields remain empty.
    * API is live; counts change over time. Handle 429s with small backoff.
    """)
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
        "application": "rw",
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
        for vocab in (attr.get("vocabulary") or []):
            tags.update(vocab.get("attributes", {}).get("tags", []) or [])
        tags_list = sorted(tags)

        # layer names (if present in include)
        layer_names = []
        for lyr in (attr.get("layer") or []):
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
            for r in rows: w.writerow(r)

            # remaining pages
            for page_num in range(2, total_pages + 1):
                js = get_page(page_num, session=s)
                rows = extract_rows(js)
                for r in rows: w.writerow(r)
                # be polite; avoid hammering the API
                time.sleep(0.15)

        print(f"Done. Wrote CSV: {OUTFILE}")
    return (main,)


@app.cell
def _(main):
    main()
    return


@app.cell
def _(FIELDS):
    df = pd.read_csv("resourcewatch_datasets.csv", dtype=str)
    df = df[[*FIELDS]]
    df
    return


@app.cell
def _():


    # url = "https://api.resourcewatch.org/v1/dataset"
    # params = {
    #     "application": "rw",
    #     "env": "production",
    #     "published": "true"
    # }

    # response = requests.get(url, params=params)
    # response_json = response.json()
    # response_json
    return


@app.cell
def _():
    #response_json.keys()
    return


@app.cell
def _():

    #response_json['data']
    return


@app.cell
def _():

    # BASE = "https://api.resourcewatch.org/v1/dataset"
    # params = {
    #     "application": "rw",
    #     "env": "production",
    #     "published": "true",
    #     "page[size]": 10,
    #     "page[number]": 1,
    #     "includes": "metadata,vocabulary,layer",
    # }

    # r = requests.get(BASE, params=params, timeout=60)
    # r.raise_for_status()
    # js = r.json()

    # def first_nonempty(seq, default=None):
    #     return next((x for x in seq if x), default)

    # rows = []
    # for item in js.get("data", []):
    #     attr = item.get("attributes", {}) or {}

    #     # ---- tags (from vocabulary) ----
    #     tags = set()
    #     for vocab in (attr.get("vocabulary") or []):
    #         tags.update(vocab.get("attributes", {}).get("tags", []) or [])
    #     tags = sorted(tags)

    #     # ---- license + sources (from metadata; prefer English if present) ----
    #     meta_list = attr.get("metadata") or []
    #     # pick the first metadata where language = 'en', else the first available
    #     chosen_meta = first_nonempty(
    #         [m for m in meta_list if (m.get("attributes", {}) or {}).get("language") == "en"],
    #         default=(meta_list[0] if meta_list else None),
    #     )
    #     license_ = None
    #     sources_str = None
    #     if chosen_meta:
    #         m = chosen_meta.get("attributes", {}) or {}
    #         license_ = m.get("license")
    #         sources = m.get("sources") or []
    #         sources_str = "; ".join(
    #             s.get("name") or s.get("url") or "" for s in sources if (s.get("name") or s.get("url"))
    #         ) or None

    #     # ---- layer names (from includes=layer) ----
    #     # Common shape: attr["layer"] -> list of layer objects with .attributes.name
    #     layer_names = []
    #     for lyr in (attr.get("layer") or []):
    #         if isinstance(lyr, dict):
    #             # prefer attributes.name, else name at top-level if present
    #             nm = (lyr.get("attributes") or {}).get("name") or lyr.get("name")
    #             if nm:
    #                 layer_names.append(nm)

    #     rows.append({
    #         "id": item.get("id"),
    #         "name": attr.get("name"),
    #         "slug": attr.get("slug"),
    #         "provider": attr.get("provider"),
    #         "connectorType": attr.get("connectorType"),
    #         "createdAt": attr.get("createdAt"),
    #         "updatedAt": attr.get("updatedAt"),
    #         "dataLastUpdated": attr.get("dataLastUpdated"),
    #         "tags": tags,
    #         "license": license_,
    #         "sources": sources_str,
    #         "layerCount": len(layer_names),
    #         "layerNames": layer_names,
    #     })

    # print(f"Fetched {len(rows)} datasets on page 1.")
    # # Peek at one record to confirm shapes
    return


@app.cell
def _():
    return


if __name__ == "__main__":
    app.run()
