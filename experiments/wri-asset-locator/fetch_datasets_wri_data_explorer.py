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

with app.setup:
    import marimo as mo
    import requests, csv, time
    import pandas as pd

    BASE = "https://datasets.wri.org/api/3/action/package_search"

    DATASET_FIELDS = [
        "id","title","name","tags","createdAt","updatedAt",
        "license","organization","numResources"
    ]

    RESOURCE_FIELDS = [
        "dataset_id","resource_id","name","format","url","last_modified","size"
    ]


@app.cell(hide_code=True)
def _(mo):
    mo.md(
    r"""
    ## WRI CKAN (datasets.wri.org) → `wri_data_explorer_01.csv`

    **What this does**

    * Uses CKAN’s `package_search` to list all packages and flatten key metadata into a DataFrame (and CSV).

    **Endpoint & paging**

    * `GET https://datasets.wri.org/api/3/action/package_search`
    * Params: `rows=100`, `start=OFFSET` (iterate `start += rows` until `start >= result.count`)

    **Fields captured (per package)**

    * `id`, `title`, `name` (CKAN slug), `tags`
    * Timestamps: `createdAt` (`metadata_created`), `updatedAt` (`metadata_modified`)
    * `license` (`license_title`/`license_id`)
    * `organization` (title/name)
    * `numResources` (count of `resources[]`)

    **Implementation notes**

    * We also build a *resources* DataFrame in memory for inspection (one row per resource), but we only write the *datasets* CSV.
    * Optionally filter with `q=…` if we later need subsets; for now it’s a full catalog pull.
      """
  )
  return


@app.cell
def _():
    def fetch_ckan_package_search(q=None, rows=100):
        """Generator yielding CKAN package_search pages."""
        start = 0
        session = requests.Session()
        params = {"rows": rows, "start": start}
        if q:
            params["q"] = q

        r = session.get(BASE, params=params, timeout=60)
        r.raise_for_status()
        js = r.json()
        assert js.get("success") and "result" in js, "Unexpected CKAN response"
        count = js["result"]["count"]

        while True:
            params["start"] = start
            r = session.get(BASE, params=params, timeout=60)
            r.raise_for_status()
            yield r.json()["result"]
            start += rows
            if start >= count:
                break
            time.sleep(0.15)

    def to_dataset_row(pkg):
        tags = sorted({t.get("name","").strip() for t in (pkg.get("tags") or []) if t.get("name")})
        org = (pkg.get("organization") or {}).get("title") or (pkg.get("organization") or {}).get("name")
        return {
            "id": pkg.get("id"),
            "title": pkg.get("title"),
            "name": pkg.get("name"),
            "tags": ", ".join(tags),
            "createdAt": pkg.get("metadata_created"),
            "updatedAt": pkg.get("metadata_modified"),
            "license": pkg.get("license_title") or pkg.get("license_id"),
            "organization": org,
            "numResources": len(pkg.get("resources") or []),
        }

    def to_resource_rows(pkg):
        rows = []
        for res in (pkg.get("resources") or []):
            rows.append({
                "dataset_id": pkg.get("id"),
                "resource_id": res.get("id"),
                "name": res.get("name") or res.get("description") or "",
                "format": res.get("format"),
                "url": res.get("url"),
                "last_modified": res.get("last_modified") or res.get("revision_timestamp"),
                "size": res.get("size"),
            })
        return rows

    return fetch_ckan_package_search, to_dataset_row, to_resource_rows


@app.cell
def _(fetch_ckan_package_search, to_dataset_row, to_resource_rows):
    def main():
        dataset_records = []
        resource_records = []

        for page in fetch_ckan_package_search(rows=100):
            for pkg in page.get("results", []):
                dataset_records.append(to_dataset_row(pkg))
                resource_records.extend(to_resource_rows(pkg))
            time.sleep(0.15)

        # Convert to DataFrames
        datasets_df = pd.DataFrame(dataset_records)
        resources_df = pd.DataFrame(resource_records)

        # Write datasets df to CSV
        datasets_df.to_csv("wri_data_explorer_01.csv", index=False, encoding="utf-8")

        print(f"Datasets: {len(datasets_df)} rows")
        print(f"Resources: {len(resources_df)} rows (not saved)")
        return datasets_df, resources_df

    datasets_df, resources_df = main()
    return datasets_df, resources_df


@app.cell
def _(datasets_df):
    datasets_df
    return


@app.cell
def _(resources_df):
    resources_df
    return


@app.cell
def _():
    return


if __name__ == "__main__":
    app.run()
