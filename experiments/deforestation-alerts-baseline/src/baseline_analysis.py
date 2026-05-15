# /// script
# requires-python = ">=3.13"
# dependencies = [
#     "altair==6.0.0",
#     "marimo",
#     "pandas==2.3.3",
#     "requests==2.32.5",
# ]
# ///

import marimo

__generated_with = "0.19.4"
app = marimo.App(width="medium")


@app.cell
def _():
    import marimo as mo
    import requests
    import json
    import os
    import pandas as pd
    from datetime import date
    return date, json, mo, os, pd, requests


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
def _():
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
    return (tesso_nilo_geometry,)


@app.cell
def _(date, pd, requests):
    CONF_LEVELS = ("nominal", "high", "highest")

    def month_window(year: int, month: int) -> tuple[str, str]:
        start = date(year, month, 1)
        if month == 12:
            next_month = date(year + 1, 1, 1)
        else:
            next_month = date(year, month + 1, 1)
        end = next_month - pd.Timedelta(days=1)
        return start.isoformat(), end.isoformat()

    def fetch_integrated_alerts_month(
        year: int,
        month: int,
        *,
        base_url: str,
        api_key: str,
        geometry: dict,
        timeout: int = 120,
    ) -> pd.DataFrame:
        start_date, end_date = month_window(year, month)

        headers = {"Content-Type": "application/json", "x-api-key": api_key}

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

        payload = {"geometry": geometry, "sql": SQL}
        r = requests.post(base_url, headers=headers, json=payload, timeout=timeout)

        if r.status_code != 200:
            raise RuntimeError(f"HTTP {r.status_code}: {r.text[:500]}")

        data = r.json().get("data", [])
        df = pd.DataFrame(data)

        if df.empty:
            return pd.DataFrame(columns=[
                "longitude","latitude","gfw_integrated_alerts__date",
                "gfw_integrated_alerts__intensity","gfw_integrated_alerts__confidence"
            ])

        df["gfw_integrated_alerts__date"] = pd.to_datetime(df["gfw_integrated_alerts__date"])
        return df
    return fetch_integrated_alerts_month, month_window


@app.cell
def _(pd):
    # for spatial baselines

    def add_pixel_id(df: pd.DataFrame, decimals: int = 5) -> pd.DataFrame:
        df = df.copy()
        df["pixel_id"] = (
            df["latitude"].round(decimals).astype(str) + "," +
            df["longitude"].round(decimals).astype(str)
        )
        return df

    # def jaccard(a: set, b: set) -> float:
    #     if not a and not b:
    #         return 1.0
    #     if not a or not b:
    #         return 0.0
    #     return len(a & b) / len(a | b)
    return (add_pixel_id,)


@app.cell
def _(mo):
    mo.md(r"""
    ## Build monthly table for July 2023 baseline
    """)
    return


@app.cell
def _():
    TARGET_YEAR = 2023
    TARGET_MONTH = 7
    return


@app.cell
def _(add_pixel_id, fetch_integrated_alerts_month, month_window, pd):
    def build_monthly_table(
        months: list[tuple[int,int]],
        *,
        base_url: str,
        api_key: str,
        geometry: dict,
        keep_conf: tuple[str, ...] = ("high", "highest"),
        pixel_id_decimals: int = 5,
    ) -> tuple[pd.DataFrame, dict]:
        rows = []
        month_pixels = {}

        for (yy, mm) in months:
            df = fetch_integrated_alerts_month(
                yy, mm, base_url=base_url, api_key=api_key, geometry=geometry
            )

            # Filter AFTER fetch (because SQL IN (...) is flaky here)
            df = df[df["gfw_integrated_alerts__confidence"].isin(keep_conf)].copy()

            df = add_pixel_id(df, decimals=pixel_id_decimals)
            month_pixels[(yy, mm)] = set(df["pixel_id"].tolist())

            counts = df["gfw_integrated_alerts__confidence"].value_counts().to_dict()
            total = int(len(df))

            rows.append({
                "year": yy,
                "month": mm,
                "window_start": month_window(yy, mm)[0],
                "window_end": month_window(yy, mm)[1],
                "pixels_total": total,
                "pixels_high": int(counts.get("high", 0)),
                "pixels_highest": int(counts.get("highest", 0)),
                "pixels_nominal": int(counts.get("nominal", 0)),  # should be 0 after filter
                "share_highest": (counts.get("highest", 0) / total) if total else None,
                "intensity_mean": float(df["gfw_integrated_alerts__intensity"].mean()) if total else None,
            })

        monthly = pd.DataFrame(rows).sort_values(["year","month"]).reset_index(drop=True)
        return monthly, month_pixels
    return (build_monthly_table,)


@app.cell
def _():

    def months_preceding(year: int, month: int, n: int) -> list[tuple[int,int]]:
        out = []
        y, m = year, month
        for _ in range(n):
            m -= 1
            if m == 0:
                y -= 1
                m = 12
            out.append((y, m))
        return list(reversed(out))

    TARGET = (2023, 7)

    recent_12 = months_preceding(*TARGET, n=12)            # Jul 2022 .. Jun 2023
    seasonal_julys = [(2022,7), (2021,7), (2020,7)]
    months = recent_12 + [TARGET] + seasonal_julys

    # de-dupe while preserving order
    seen, months_unique = set(), []
    for ym in months:
        if ym not in seen:
            seen.add(ym)
            months_unique.append(ym)
    return (months_unique,)


@app.cell(hide_code=True)
def _(mo):
    mo.md(r"""
    ## Compute baselines
    """)
    return


@app.cell
def _(jaccard, pd):
    def add_baseline_comparisons(
        monthly_summary: pd.DataFrame,
        month_pixels: dict,
        *,
        target_year: int,
        target_month: int,
    ) -> pd.DataFrame:
        ms = monthly_summary.copy()
        ms["ym"] = ms["year"].astype(str) + "-" + ms["month"].astype(str).str.zfill(2)

        target_key = (target_year, target_month)
        target_set = month_pixels.get(target_key, set())

        # Previous month key
        py, pm = target_year, target_month - 1
        if pm == 0:
            py -= 1
            pm = 12
        prev_key = (py, pm)

        # Prior Julys
        prior_julys = [(target_year - i, target_month) for i in (1,2,3)]

        # Attach spatial overlaps
        prev_set = month_pixels.get(prev_key, set())
        ms["jaccard_vs_prev_month"] = None
        ms["jaccard_vs_target"] = None

        # Put a single-row "target comparisons" table at the end (cleanest)
        # But also compute baseline metrics for target month
        target_row = ms[(ms["year"] == target_year) & (ms["month"] == target_month)].copy()
        if not target_row.empty:
            # Recent baseline = prior 12 months
            recent_mask = (ms["ym"] < f"{target_year}-{str(target_month).zfill(2)}") & \
                          (ms["ym"] >= f"{py}-{str(pm).zfill(2)}")  # this mask isn't perfect across years; better explicit:
            # Let's do explicit last-12 months list:
            recent_keys = []
            y, m = target_year, target_month
            for _ in range(12):
                m -= 1
                if m == 0:
                    y -= 1; m = 12
                recent_keys.append((y, m))
            recent_vals = ms.set_index(["year","month"]).loc[recent_keys]["pixels_total"].dropna()

            recent_median = float(recent_vals.median()) if len(recent_vals) else None
            recent_mean = float(recent_vals.mean()) if len(recent_vals) else None

            # Seasonal baseline = prior three Julys
            seasonal_vals = []
            for k in prior_julys:
                v = ms.set_index(["year","month"]).get("pixels_total", pd.Series()).get(k)
                if v is None:
                    # safer retrieval:
                    tmp = ms[(ms["year"]==k[0]) & (ms["month"]==k[1])]["pixels_total"]
                    if len(tmp): seasonal_vals.append(int(tmp.iloc[0]))
                else:
                    seasonal_vals.append(int(v))
            seasonal_median = float(pd.Series(seasonal_vals).median()) if seasonal_vals else None
            seasonal_mean = float(pd.Series(seasonal_vals).mean()) if seasonal_vals else None

            # Spatial overlaps
            j_prev = jaccard(target_set, prev_set)
            j_seasonal = {f"{k[0]}-{str(k[1]).zfill(2)}": jaccard(target_set, month_pixels.get(k, set()))
                          for k in prior_julys}

            # Add as columns onto the target row
            target_row["recent12_median_pixels"] = recent_median
            target_row["recent12_mean_pixels"] = recent_mean
            target_row["seasonal3_median_pixels"] = seasonal_median
            target_row["seasonal3_mean_pixels"] = seasonal_mean
            target_row["pct_vs_recent12_median"] = (target_row["pixels_total"].iloc[0] / recent_median - 1) if recent_median else None
            target_row["pct_vs_seasonal3_median"] = (target_row["pixels_total"].iloc[0] / seasonal_median - 1) if seasonal_median else None
            target_row["spatial_jaccard_vs_prev_month"] = j_prev
            # explode seasonal overlaps into columns
            for k, v in j_seasonal.items():
                target_row[f"spatial_jaccard_vs_{k}"] = v

            return target_row.drop(columns=["ym"]).reset_index(drop=True)

        return ms.drop(columns=["ym"])
    return


@app.cell
def _(
    BASE_URL,
    WRI_API_KEY,
    build_monthly_table,
    months_unique,
    tesso_nilo_geometry,
):
    monthly, month_pixels = build_monthly_table(
        months_unique,
        base_url=BASE_URL,
        api_key=WRI_API_KEY,
        geometry=tesso_nilo_geometry,
        keep_conf=("high","highest"),
    )
    monthly
    return (monthly,)


@app.cell
def _(monthly):
    mask = (monthly['year'] == 2023 ) & (monthly['month'] == 7)
    monthly[~mask].describe()
    return


@app.cell
def _():
    # def debug_months(months, **kwargs):
    #     for (yy, mm) in months:
    #         print(f"Fetching {yy}-{mm:02d} ...", end=" ")
    #         try:
    #             df = fetch_integrated_alerts_month(yy, mm, **kwargs)
    #             print(f"OK ({len(df)} rows)")
    #         except Exception as e:
    #             print("FAILED")
    #             raise RuntimeError(f"Failed on {yy}-{mm:02d}: {e}")

    # debug_months(
    #     months_unique,
    #     base_url=BASE_URL,
    #     api_key=WRI_API_KEY,
    #     geometry=tesso_nilo_geometry,
    # )
    return


@app.cell(hide_code=True)
def _(mo):
    mo.md(r"""
    ```
    Baseline period: July 2022 – June 2023 (+ July 2020 + July 2021)

    During the baseline period, monthly disturbance alert activity within the park shows high variability and a clear escalation relative to early observations. Monthly total alert detections range from as low as 107 pixels (July 2020) to a maximum of 11,508 pixels (June 2023), with a mean of approximately 5,000 pixels per month and a median of ~4,800 pixels.

    From mid-2021 onward, monthly totals consistently exceed 2,500 pixels, indicating sustained disturbance pressure rather than isolated events. Peak activity occurs in late dry season and early wet season months (approximately April–September), culminating in particularly elevated levels during April–June 2023.

    Alert intensity is dominated by high-severity signals. On average, roughly 31% of detected pixels each month fall into the highest alert category, with this share exceeding 50% in several months and reaching a maximum of approximately 62%. This indicates that a substantial fraction of alerts represent strong vegetation loss signals rather than marginal anomalies.

    The baseline therefore reflects a protected area under chronic and intensifying disturbance, with wide month-to-month variability and a non-trivial proportion of high-severity alerts. Baseline values should be interpreted as representing an already degraded and actively encroached landscape, not a low-disturbance or intact reference condition.
    ```
    """)
    return


@app.cell(hide_code=True)
def _(mo):
    mo.md(r"""
    ## Baseline discussion for July 2023

    July 2023 compared to baselines:
    * Recent baseline (prior 12 months): the median pixels_total is 4,966.
    * July 2023 is 9,478, which is about 1.91× the median. --> That’s “unusual” relative to the last year in this AOI.


    There's a multi-month peak leading up to July 2023
    * Apr 2023 is quite high (9,857). In fact this is the inflection point here.
    * Jun 2023 is even higher (11,508).
    * July is more of a “continuation of an elevated period” than a new spike

    Seasonality check (the “same month” baseline you wanted):
    * Jul 2022: 5,098
    * Jul 2021: 2,968
    * Jul 2020: 107 (suspiciously low. Error?)
    So July 2023 is much higher than prior Julys.

    Jan to Feb 2023
    * Share of highest-confidence alerts jumps sharply in Feb 2023
    * but not a matching jump in volume
    * Recall: highest confidence occurs only when multiple alert systems detect disturbance in the same pixel
    * The jump in 2023 starts with a quality driven alert → disturbance becoming more certain / corroborated
    """)
    return


@app.cell
def _():
    return


@app.cell
def _(mo):
    mo.md(r"""
    ## Some plots of baselines
    """)
    return


@app.cell
def _(monthly, pd):

    m = monthly.copy()

    # Continuous time axis (month start)
    m["date"] = pd.to_datetime(
        m["year"].astype(str) + "-" + m["month"].astype(str).str.zfill(2) + "-01"
    )
    m = m.sort_values("date")

    # Rolling N-month median (baseline trend)
    m["rolling3_median"] = m["pixels_total"].rolling(3, min_periods=3).median()
    m["rolling3_median_share"] = m["share_highest"].rolling(3, min_periods=3).median()

    # Flag target month (July 2023)
    m["is_target"] = (m["year"] == 2023) & (m["month"] == 7)
    return (m,)


@app.cell
def _(alt, m, pd):
    N = 12
    target_date = pd.Timestamp("2023-07-01")

    m_recent = (
        m[m["date"] <= target_date]
        .sort_values("date")
        .tail(N)
        .copy()
    )

    m_recent["is_target"] = m_recent["date"] == target_date

    highlight = alt.Chart(pd.DataFrame({
        "start": [pd.Timestamp("2023-06-15")],
        "end":   [pd.Timestamp("2023-07-15")],  # 1-month width
    })).mark_rect(
        opacity=0.12,
        color="#f4a261"  # warm but subtle
    ).encode(
        x="start:T",
        x2="end:T"
    )
    return highlight, m_recent


@app.cell
def _(alt, highlight, m_recent):
    _base = alt.Chart(m_recent).encode(
        x=alt.X("date:T", title="Month"),
    )

    _pixels = _base.mark_point().encode(
        y=alt.Y("pixels_total:Q", title="Alert pixels (count)"),
        tooltip=[
            alt.Tooltip("date:T", title="Month"),
            alt.Tooltip("pixels_total:Q", title="Pixels", format=","),
            alt.Tooltip("rolling3_median:Q", title="3-mo median", format=","),
        ],
    )

    _median_line = _base.mark_line(strokeDash=[6,4]).encode(
        y="rolling3_median:Q"
    )

    target_rule = alt.Chart(m_recent[m_recent["is_target"]]).mark_rule(
        strokeDash=[2,2],
        color="black"
    ).encode(x="date:T")

    chart1 = (highlight + _pixels + _median_line + target_rule).properties(
        title="Integrated Alerts: Monthly alert pixels (last 12 months)\n(w/rolling mean)",
        height=220,
        width=600,
    )
    chart1
    return chart1, target_rule


@app.cell
def _(alt, highlight, m_recent, target_rule):
    _base= alt.Chart(m_recent).mark_point().encode(
        x=alt.X("date:T", title="Month"),
    )

    _pixels = _base.mark_point().encode(
        y=alt.Y("share_highest:Q", title="Share highest-confidence"),
        tooltip=[
            alt.Tooltip("date:T", title="Month"),
            alt.Tooltip("share_highest:Q", title="Share highest", format=".2%"),
            alt.Tooltip("pixels_total:Q", title="Pixels", format=","),
            alt.Tooltip("rolling3_median_share:Q", title="3-mo median", format=","),

        ],
    )

    _median_line = _base.mark_line(strokeDash=[6,4]).encode(
        y="rolling3_median_share:Q"
    )

    chart2 = (_pixels + _median_line + highlight).properties(
        title="Integrated Alerts: Highest-confidence share (last 12 months)",
        height=220,
        width=600,
    ) + target_rule

    chart2
    return (chart2,)


@app.cell
def _(chart1, chart2):
    (chart1 & chart2)
    return


@app.cell
def _(monthly):
    # comparing the Julys from previous years
    monthly[monthly['month'] == 7][['window_start', 'window_end', 'pixels_total', 'pixels_highest', 'share_highest']]
    return


@app.cell
def _(mo):
    mo.md(r"""
    # Ref
    """)
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
