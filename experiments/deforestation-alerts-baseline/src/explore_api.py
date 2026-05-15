# /// script
# requires-python = ">=3.13"
# dependencies = [
#     "marimo",
#     "pandas==2.3.3",
#     "requests==2.32.5",
# ]
# ///

import marimo

__generated_with = "0.19.2"
app = marimo.App(width="medium")


@app.cell
def _():
    import marimo as mo
    import requests
    import json
    import os
    import pandas as pd
    return json, mo, os, pd, requests


@app.cell
def _():
    # DOCS: deforestation alerts endpoint
    # https://developer.openepi.io/how-tos/integrated-deforestation-alerts-x-global-forest-watch-api

    # DOCS: How to get fields
    # https://developer.openepi.io/how-tos/getting-started-using-global-forest-watch-data-api?utm_source=chatgpt.com

    # DOCS: Base general for WRI data API
    # https://data-api.globalforestwatch.org/
    return


@app.cell
def _(os):
    # Define the API endpoint
    BASE_URL = "https://data-api.globalforestwatch.org/dataset/gfw_integrated_alerts/latest/query"

    # Get API key from environment variable
    WRI_API_KEY = os.environ.get("WRI_DATA_API_KEY", "")

    if not WRI_API_KEY:
        print("Warning: WRI_DATA_API_KEY environment variable not found")
    return BASE_URL, WRI_API_KEY


@app.cell
def _(requests):


    meta = requests.get("https://data-api.globalforestwatch.org/dataset/gfw_integrated_alerts").json()
    meta["data"]["versions"][-10:]  # show last 10 versions

    return


@app.cell
def _(BASE_URL, WRI_API_KEY, requests):
    CONF_MAP = {2: "nominal", 3: "high", 4: "highest"}

    def query_tesso_nilo_alerts(start_date, end_date, base_url=BASE_URL, api_key=WRI_API_KEY):
        """
        Query the Global Forest Watch API for alerts in the Tesso Nilo region for a specific date range.

        Args:
            start_date (str): Start date in 'YYYY-MM-DD' format
            end_date (str): End date in 'YYYY-MM-DD' format
            base_url (str): API endpoint URL
            api_key (str): API key for authentication

        Returns:
            dict: JSON response from the API or error message
        """
    
        headers = {"Content-Type": "application/json", "x-api-key": api_key}

        tesso_nilo_geometry = {
            "type": "Polygon",
            "coordinates": [[
                [101.9134059517725, -0.3180806908802252],
                [101.9128400905203, -0.2388468244034033],
                [102.0146876774758, -0.2388468244034033],
                [102.015254104227, -0.3180806908802252],
                [101.9134059517725, -0.3180806908802252],
            ]]
        }

        # for reference only, not used
        EXAMPLE_SQL = f"SELECT longitude, latitude FROM results WHERE gfw_integrated_alerts__date >= '{start_date}' AND gfw_integrated_alerts__date <= '{end_date}'"

        # Query to send to endpont
        SQL = f"""
    SELECT
      longitude,
      latitude,
      gfw_integrated_alerts__date,
      gfw_integrated_alerts__intensity,
      gfw_integrated_alerts__confidence
    FROM results
    WHERE gfw_integrated_alerts__date >= '{start_date}'
      AND gfw_integrated_alerts__date <= '{end_date}'
    """


        payload = {"geometry": tesso_nilo_geometry, "sql": SQL}

        r = requests.post(base_url, headers=headers, json=payload, timeout=60)
    
        # raise a useful exception if not 200
        r.raise_for_status()

        status = r.status_code
        json_data = r.json()
    
        return status, json_data

    return (query_tesso_nilo_alerts,)


@app.cell
def _(mo):
    #Create query button
    query_button = mo.ui.run_button(label="Run Query")

    # Create date range selector UI elements
    start_date_ui = mo.ui.date(value="2023-07-01", label="Start Date")
    end_date_ui = mo.ui.date(value="2023-07-31", label="End Date")


    date_controls = mo.hstack([start_date_ui, end_date_ui])


    date_controls
    return end_date_ui, query_button, start_date_ui


@app.cell
def _(end_date_ui, query_button, query_tesso_nilo_alerts, start_date_ui):
    # Run query, but only if button is pressed
    if query_button.value:
        s, r = query_tesso_nilo_alerts(
            start_date=start_date_ui.value, 
            end_date=end_date_ui.value,
        )

    return r, s


@app.cell
def _(query_button):
    query_button
    return


@app.cell
def _(s):
    # status code returned. 
    s
    return


@app.cell(hide_code=True)
def _(mo):
    mo.md(r"""
    ## Interpreting Integrated Deforestation Alerts (GFW Data API)
    Interpretation of the data returned by the endpoint

    ```
    longitude, latitude
    → centroid of a 10 × 10 m raster pixel that registered an alert

    gfw_integrated_alerts__date
    → the earliest detection date for that pixel from any contributing alert system

    gfw_integrated_alerts__intensity
    → a numeric alert signal-strength indicator (relative scale; not a measure of area or severity)

    gfw_integrated_alerts__confidence
    → confidence classification of the alert ("nominal", "high", "highest"), reflecting confirmation rules and/or detection by multiple systems

    ```

    Each row returned by the `gfw_integrated_alerts` query represents **one 10 × 10 m raster pixel** that registered an **integrated forest disturbance alert** within the specified date range and geometry.

    **Key points to interpret the data correctly:**

    * **One row = one pixel**, not a time series.
      Each pixel appears **at most once** in a query window.

    * **`gfw_integrated_alerts__date`** is the **earliest detection date** for that pixel from any contributing alert system (GLAD-L, GLAD-S2, or RADD).

    * **Pixel-days ≠ time series**.
      Counts by date reflect how many pixels had their *first detected alert* on that day.

    * **Confidence levels**:

      * `nominal`: early/low-confidence detection
      * `high`: confirmed by repeated observations from a single system
      * `highest`: detected by multiple alert systems (integrated-only)

    * **Resolution**: 10 m × 10 m
      Approximate pixel area = **0.01 hectares** (use only for rough operational estimates).

    * **Intensity** is a signal-strength indicator, not a direct measure of area or severity.

    * **Important cautions**:
     * These alerts detect **tree cover disturbance**, not confirmed deforestation.
     * They are intended for **near-real-time monitoring and prioritization**, *not* for official area estimates or trend analysis. For area and trends, use annual tree cover loss datasets.

    ---

    Other Notes
    * Each pixel in the integrated layer preserves the earliest date of detection from any alerting system, even if multiple systems have reported an alert in that pixel.

    ---

    Sources:
    * [1] [Tech note](https://www.globalforestwatch.org/map/?map=eyJkYXRhc2V0cyI6W3siZGF0YXNldCI6ImludGVncmF0ZWQtZGVmb3Jlc3RhdGlvbi1hbGVydHMtOGJpdCIsIm9wYWNpdHkiOjEsInZpc2liaWxpdHkiOnRydWUsImxheWVycyI6WyJpbnRlZ3JhdGVkLWRlZm9yZXN0YXRpb24tYWxlcnRzLThiaXQiXX0seyJkYXRhc2V0IjoicG9saXRpY2FsLWJvdW5kYXJpZXMiLCJsYXllcnMiOlsiZGlzcHV0ZWQtcG9saXRpY2FsLWJvdW5kYXJpZXMiLCJwb2xpdGljYWwtYm91bmRhcmllcyJdLCJvcGFjaXR5IjoxLCJ2aXNpYmlsaXR5Ijp0cnVlfV19&mapMenu=eyJtZW51U2VjdGlvbiI6ImRhdGFzZXRzIiwiZGF0YXNldENhdGVnb3J5IjoiZm9yZXN0Q2hhbmdlIn0%3D&modalMeta=gfw_integrated_alerts)
    """)
    return


@app.cell
def _(pd, r):
    # The alerts data is contained in the 'data' field on the json in the API response: response.json()['data']
    # Here we can get it from r = response.json()

    df = pd.DataFrame(r["data"])
    df["gfw_integrated_alerts__date"] = pd.to_datetime(
       df["gfw_integrated_alerts__date"]
    )
    df
    return (df,)


@app.cell
def _(df):
    (df.shape,                   # ~13k rows
    df["gfw_integrated_alerts__confidence"].value_counts().to_dict(),
    df["gfw_integrated_alerts__date"].min(), df["gfw_integrated_alerts__date"].max())

    return


@app.cell
def _(df):
    unique_pixels = df[["latitude", "longitude"]].drop_duplicates().shape[0]
    pixel_days = len(df)

    # print it
    unique_pixels, pixel_days

    return


@app.cell
def _(df):
    # from tech note
    PIXEL_HA = (10 * 10) / 10_000  # 0.01 ha

    # total hectare estimate
    # the tech note warns not to use alerts for area estimates/trends,
    total_ha_est = len(df) * PIXEL_HA
    print ("Total Hectares (estimate): ", total_ha_est)

    # summary of daily pixels and ha
    daily = (
        df.groupby("gfw_integrated_alerts__date")
          .size()
          .rename("pixels")
          .reset_index()
    )
    daily = daily.assign(ha_est=daily["pixels"] * PIXEL_HA)

    daily
    return


@app.cell
def _(mo):
    mo.md(r"""
    ## Reference - API explore
    """)
    return


@app.cell
def _(requests):

    fields_url = "https://data-api.globalforestwatch.org/dataset/gfw_integrated_alerts/latest/fields"
    fields = requests.get(fields_url).json()
    fields  # inspect in notebook / mo.ui.json(fields)

    return


@app.cell
def _(mo):
    mo.md(r"""
    ## Reference - Shared queries and results

    These are the documents / queries shared by the PTW team.
    """)
    return


@app.cell
def _():
    with open("../data/API_query_alerts_tesso_nilo_july2023.txt", "r") as _f:
        print(_f.read())
    return


@app.cell
def _():
    with open("../data/JSON_response_alerts_tesso_nilo_july2023.txt", "r") as _f:
        for i, line in enumerate(_f):
            if i >= 50:
                break
            print(line, end="")
    return


@app.cell
def _():
    return


@app.cell
def _(json):
    # This the example JSON file that was provided by the PTW team
    json_file = "../data/JSON_response_alerts_tesso_nilo_july2023.txt"

    # Read the content of the file
    with open(json_file, "r") as f:
        data_str = f.read()

    # Try to parse the content as JSON
    try:
        json_data = json.loads(data_str)
        valid_json = True
    except json.JSONDecodeError as e:
        json_data = None
        valid_json = False
        error_msg = str(e)

    valid_json
    return (json_data,)


@app.cell
def _(json_data):
    json_data['data'][:2]
    return


@app.cell
def _():
    return


if __name__ == "__main__":
    app.run()
