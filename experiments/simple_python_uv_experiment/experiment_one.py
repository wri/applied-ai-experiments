# /// script
# requires-python = ">=3.13"
# dependencies = [
#     "altair==6.0.0",
#     "pandas==2.3.3",
#     "requests==2.32.5",
# ]
# ///

import marimo

__generated_with = "0.17.7"
app = marimo.App(width="columns")


@app.cell
def _():
    import marimo as mo
    import requests
    import csv, time, sys
    import os
    import altair as alt

    # for looking at results
    import pandas as pd

    return alt, csv, mo, os, pd, requests, sys, time


@app.cell
def _():

    BASE = "https://api.resourcewatch.org/v1/dataset"
    OUTFILE = "resourcewatch_datasets.csv"

    FETCH_PARAMS = {
        "application": "rw",
        # can add more options here based on the API
    }
    return BASE, FETCH_PARAMS, OUTFILE


@app.cell
def _(OUTFILE, mo, os):


    fetch_btn = mo.ui.run_button(label="FETCH DATA")


    if os.path.exists(OUTFILE):
        print('Fetched data already exists; hit the button to update or fetch again.')

    fetch_btn
    return (fetch_btn,)


@app.cell
def _(fetch_btn, fetch_data_and_write_file, mo):
    mo.stop(not fetch_btn.value, "Data fetched only upon request.")

    fetch_data_and_write_file()

    return


@app.cell
def _(FIELDS, pd):
    # Load the data and display a dataframe
    df = pd.read_csv("resourcewatch_datasets.csv", dtype=str)
    df = df[[*FIELDS]]
    df
    return (df,)


@app.cell
def _(alt, df):
    # When were datasets last updated?
    _chart = (
        alt.Chart(df)
        .mark_bar()
        .encode(
            x=alt.X(field='dataLastUpdated', type='temporal', timeUnit='yearmonth'),
            y=alt.Y(aggregate='count', type='quantitative'),
            tooltip=[
                alt.Tooltip(field='dataLastUpdated', timeUnit='yearmonth', title='dataLastUpdated'),
                alt.Tooltip(aggregate='count')
            ]
        )
        .properties(
            height=290,
            width='container',
            config={
                'axis': {
                    'grid': False
                }
            }
        )
    )
    _chart
    return


@app.cell
def _(alt, df):
    # Provider
    _chart = (
        alt.Chart(df)
        .mark_bar()
        .encode(
            x=alt.X(aggregate='count', type='quantitative'),
            y=alt.Y(field='provider', type='nominal'),
            tooltip=[
                alt.Tooltip(field='provider'),
                alt.Tooltip(aggregate='count')
            ]
        )
        .properties(
            height=290,
            width='container',
            config={
                'axis': {
                    'grid': False
                }
            }
        )
    )
    _chart
    return


@app.cell
def _():
    import altair as alt
    return (alt,)


@app.cell
def _():
    return


@app.cell(hide_code=True)
def _(mo):
    mo.md(r"""
    ## Utility Functions

    These are helper functions for working with the API

    ------------------
    """)
    return


@app.cell
def _():
    # These are the fields loaded into the dataframe
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


@app.cell
def _(FIELDS, OUTFILE, csv, get_page, requests, sys, time):
    def fetch_data_and_write_file():
        """
        Fetch data from the Resource Watch API, iterating over all available pages, and write the results to a CSV file.
        * The output file path is specified by OUTFILE. 
        * Function is executed if the FETCH DATA button is pressed. 
        """
        print ("Running...")
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
    return (fetch_data_and_write_file,)


@app.cell
def _(BASE, FETCH_PARAMS, requests, time):
    def get_page(page_number, page_size=100, session=None):
        s = session or requests.Session()
        params = {
            "application": FETCH_PARAMS["application"],
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
    return (get_page,)


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
def _():
    return


@app.cell
def _():
    return


if __name__ == "__main__":
    app.run()
