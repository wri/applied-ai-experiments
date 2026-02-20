# /// script
# requires-python = ">=3.11"
# dependencies = [
#     "altair==5.5.0",
#     "einops==0.8.1",
#     "marimo",
#     "molabel==0.1.5",
#     "openai==2.6.1",
#     "pandas==2.3.3",
#     "pyarrow==22.0.0",
#     "scikit-learn==1.7.2",
#     "sentence-transformers==5.1.2",
#     "umap-learn==0.5.9.post2",
# ]
# ///

import marimo

__generated_with = "0.18.4"
app = marimo.App(width="columns")


@app.cell(column=0, hide_code=True)
def _(mo):
    mo.md(r"""
    # Outline

    1. **Data aggregation**
       * Collect list of datasets from available sources and load them into a unified structure.
       * Standardize schema and clean metadata fields (names, tags, descriptions, timestamps).

    2. **Text synthesis**
       * Combine alll metadata fields for each dataset into a single representative text string.
       * Clean and normalize the text (remove HTML, unify separators, standardize dates, etc.).
       * create a new text feature that will be embedded

    3. **Feature representation**
       * Convert each text string into a numerical embedding using a language or feature-encoding model.
       * The resulting vectors represent semantic relationships among datasets.

    4. **Dimensionality reduction**
       * Project the high-dimensional embeddings into a lower dimensional (i.e. 2d) space using a dimensionality reduction technique (e.g., UMAP, t-SNE, PCA, etc.).
       * Preserve meaningful similarity structure for visualization.

    5. **Similarity and interactivity**
       * Compute similarity between user-provided queries and dataset embeddings using an appropriate distance metric.
       * Use these similarity scores to drive interactive coloring, filtering, or highlighting.

    6. **Visualization**

       * Create an interactive scatter or projection plot showing datasets positioned by reduced-space coordinates.
       * Include tooltips or overlays with dataset metadata and similarity information for exploration.
    """)
    return


@app.cell(hide_code=True)
def _(mo):
    mo.md(r"""
    ## Load list of datasets from various CSVs

    List of datasets were generated using these notebooks:

    | Notebook                          | Generated Dataset                  |
    |-----------------------------------|------------------------------------|
    | `resource_watch_datasets.py`      | `resourcewatch_datasets.csv`       |
    | `energy_access_explorer_pdf-scrape.py` | `eae_datasets_pdf-extract.csv` |
    | `arcgis_wri_catalog.py`           | `wri_arcgis_catalog_01.csv`        |
    | `data_explorer_01.py`             | `wri_data_explorer_01.csv`         |
    | `global_forest_watch.py`             | `global_forest_watch_datasets.csv`         |

    See the respective notebooks for details.
    """)
    return


@app.cell
def _(df_all):
    df_all["source_collection"].value_counts()
    return


@app.cell(hide_code=True)
def _(mo):
    mo.md(r"""
    This is the combined list of datasets
    """)
    return


@app.cell
def _(df_all):
    df_all
    return


@app.cell
def _():
    import marimo as mo
    import os
    import pandas as pd
    import re, html
    from datetime import datetime
    from pathlib import Path

    from pprint import pprint

    return Path, datetime, html, mo, os, pd, re


@app.cell
def _(Path, mo):
    # Calculate data directory - works whether run from notebooks/ or root
    NOTEBOOK_DIR = Path.cwd()
    DATA_DIR = (
        NOTEBOOK_DIR.parent / "data" if NOTEBOOK_DIR.name == "notebooks" else NOTEBOOK_DIR / "data"
    )

    # Check if required data files exist
    REQUIRED_FILES = [
        "resourcewatch_datasets.csv",
        "wri_arcgis_catalog_01.csv",
        "global_forest_watch_datasets.csv",
        "eae_datasets_pdf-extract.csv",
        "wri_data_explorer_01.csv",
    ]

    missing_files = [f for f in REQUIRED_FILES if not (DATA_DIR / f).exists()]

    if missing_files:
        mo.stop(
            True,
            mo.md(f"""
            ## ⚠️ Missing Data Files
            
            This notebook requires source data files that have not been generated yet.
            
            **Missing files:** {", ".join(missing_files)}
            
            **To generate these files:**
            
            Run the fetch_all script:
            ```bash
            python src/fetch_all.py
            ```
            
            Or run each fetch script individually in edit mode. See README.md for details.
            """),
        )

    datapath = DATA_DIR
    csv_files = [f.name for f in datapath.glob("*.csv")]
    print(f"Found {len(csv_files)} CSV files in {datapath}")
    print(csv_files)
    return DATA_DIR, REQUIRED_FILES, datapath, missing_files


@app.cell
def _(mo):
    mo.md(r"""
    The following column names will be consistent across all dataframes

    dataset_id
    dataset_name
    source_collection
    dataset_description
    dataset_tags
    date_last_updated
    date_created
    """)
    return


@app.cell
def _(datapath, pd):
    # Resource watch

    df_rw = pd.read_csv(datapath / "resourcewatch_datasets.csv")
    print(f"Loaded {len(df_rw)} datasets from collection: 'Resource watch'")

    print(f"Original Columns (n={len(df_rw.columns)}): {df_rw.columns.tolist()}")

    df_rw.rename(
        columns={
            "id": "dataset_id",
            "name": "dataset_name",
            "slug": "slug",
            "updatedAt": "last_updated",
            "tags": "dataset_tags",
        },
        inplace=True,
    )

    # add these columns
    df_rw["source_collection"] = "resource_watch"
    df_rw["source"] = df_rw.apply(
        lambda x: f"resource_watch > {x['provider']}"
        if pd.notnull(x.get("provider"))
        else "resource_watch",
        axis=1,
    )
    df_rw["dataset_description"] = ""  # none in source

    print(f"Columns (n={len(df_rw.columns)}): {df_rw.columns.tolist()}")
    return (df_rw,)


@app.cell
def _(datapath, pd):
    # ArcGIS catalog
    df_arc = pd.read_csv(datapath / "wri_arcgis_catalog_01.csv")
    print(f"Loaded {len(df_arc)} datasets from collection: 'ArcGIS catalog'")

    print(f"Original Columns (n={len(df_arc.columns)}): {df_arc.columns.tolist()}")

    df_arc.rename(
        columns={
            "id": "dataset_id",
            "name": "dataset_name",
            "description": "dataset_description",
            "tags": "dataset_tags",
            "updatedAt": "date_last_updated",
            "createdAt": "date_created",
        },
        inplace=True,
    )

    # add these columns
    df_arc["source_collection"] = "arcgis_wri_catalog"
    df_arc["source"] = df_arc.apply(
        lambda x: f"arcgis_wri_catalog > {x['provider']}"
        if pd.notnull(x.get("provider"))
        else "arcgis_wri_catalog",
        axis=1,
    )

    print(f"Columns (n={len(df_arc.columns)}): {df_arc.columns.tolist()}")
    return (df_arc,)


@app.cell
def _(datapath, pd):
    # GFW
    df_gfw = pd.read_csv(datapath / "global_forest_watch_datasets.csv")
    print(f"Loaded {len(df_gfw)} datasets from collection: 'GFW'")

    print(f"Original Columns (n={len(df_gfw.columns)}): {df_gfw.columns.tolist()}")

    df_gfw.rename(
        columns={
            "id": "dataset_id",
            "name": "dataset_name",
            "description": "dataset_description",
            "tags": "dataset_tags",
        },
        inplace=True,
    )

    # add these columns
    df_gfw["source_collection"] = "global_forest_watch"
    df_gfw["source"] = df_gfw.apply(
        lambda x: f"global_forest_watch > {x['provider']}"
        if pd.notnull(x.get("provider"))
        else "global_forest_watch",
        axis=1,
    )

    print(f"Columns (n={len(df_gfw.columns)}): {df_gfw.columns.tolist()}")
    return (df_gfw,)


@app.cell
def _(datapath, pd):
    # EAE
    df_eae = pd.read_csv(datapath / "eae_datasets_pdf-extract.csv")
    print(f"Loaded {len(df_eae)} datasets from collection: 'EAE'")

    print(f"Original Columns (n={len(df_eae.columns)}): {df_eae.columns.tolist()}")

    df_eae.rename(
        columns={
            "id": "dataset_id",
            "name": "dataset_name",
            "description": "dataset_description",
            "tags": "dataset_tags",
        },
        inplace=True,
    )

    # add these columns
    df_eae["source_collection"] = "energy_access_explorer"
    df_eae["source"] = df_eae.apply(
        lambda x: f"energy_access_explorer > {x['provider']}"
        if pd.notnull(x.get("provider"))
        else "energy_access_explorer",
        axis=1,
    )

    print(f"Columns (n={len(df_eae.columns)}): {df_eae.columns.tolist()}")
    return (df_eae,)


@app.cell
def _(datapath, pd):
    # wri data explorer

    df_ex = pd.read_csv(datapath / "wri_data_explorer_01.csv")
    print(f"Loaded {len(df_ex)} datasets from collection: 'WRI Data Explorer'")

    print(f"Original Columns (n={len(df_ex.columns)}): {df_ex.columns.tolist()}")

    df_ex.rename(
        columns={
            "id": "dataset_id",
            "name": "dataset_name",
            "title": "dataset_description",
            "tags": "dataset_tags",
            "updatedAt": "date_last_updated",
            "createdAt": "date_created",
        },
        inplace=True,
    )

    # add these columns
    df_ex["source_collection"] = "wri_data_explorer"
    df_ex["source"] = df_ex.apply(
        lambda x: f"wri_data_explorer > {x['organization']}"
        if pd.notnull(x.get("organization"))
        else "wri_data_explorer",
        axis=1,
    )

    print(f"Columns (n={len(df_ex.columns)}): {df_ex.columns.tolist()}")
    return (df_ex,)


@app.cell
def _(df_arc, df_eae, df_ex, df_gfw, df_rw, pd):
    ## Step 2: Combine into one unified DataFrame
    df_all = pd.concat([df_rw, df_gfw, df_arc, df_eae, df_ex], ignore_index=True)
    print(f"Total: {len(df_all)} datasets loaded.")

    print(df_all.shape)
    df_all
    return (df_all,)


@app.cell
def _(datetime, html, pd, re):
    # choose a delimiter that won't collide often in natural text
    DELIM = " | "  # (use "\x1F" if you need a control-char delimiter)

    # columns you definitely want to include if present
    PREFERRED_ORDER = [
        "dataset_id",
        "dataset_name",
        "source_collection",
        "dataset_description",
        "dataset_tags",
        "date_last_updated",
        "date_created",
    ]

    WS_RE = re.compile(r"\s+")
    TAG_RE = re.compile(r"<[^>]+>")  # just in case some HTML slipped in

    def to_iso_date(x):
        """Try to coerce common date forms to YYYY-MM-DD; otherwise return the original string."""
        if pd.isna(x) or x == "":
            return ""
        s = str(x).strip()
        # epoch ms or s
        if s.isdigit():
            try:
                secs = int(s) / (1000 if len(s) >= 12 else 1)
                return datetime.utcfromtimestamp(secs).strftime("%Y-%m-%d")
            except Exception:
                pass
        # pandas-style parse
        try:
            return pd.to_datetime(s, errors="coerce", utc=True).date().isoformat()
        except Exception:
            return s

    def clean_text(s):
        if s is None or (isinstance(s, float) and pd.isna(s)):
            return ""
        s = str(s)
        # strip html, unescape, collapse ws
        s = html.unescape(TAG_RE.sub("", s))
        s = WS_RE.sub(" ", s).strip()
        return s

    def serialize_row(row: pd.Series, preferred=PREFERRED_ORDER, delim=DELIM):
        # build ordered list: preferred first (if present), then all others (stable name sort) minus duplicates
        cols = [c for c in preferred if c in row.index]
        cols += [c for c in sorted(row.index) if c not in cols]

        parts = []
        for col in cols:
            val = row[col]
            if col in ("date_last_updated", "date_created"):
                val = to_iso_date(val)
            val = clean_text(val)

            if val == "" or val.lower() == "nan" or val == "None":
                continue  # skip empties

            # Keep tags compact
            if col == "dataset_tags":
                # unify separators, remove duplicate commas/spaces
                val = (
                    ", ".join([t.strip() for t in re.split(r"[|,;]", val) if t.strip()])
                    if val
                    else ""
                )

            if val:
                parts.append(f"{col}: {val}")

        return delim.join(parts)

    return (serialize_row,)


@app.cell
def _(df_all, serialize_row):
    df_all["dataset_info_combined"] = df_all.apply(serialize_row, axis=1)
    return


@app.cell
def _(df_all):
    # truncate the description column as it can get very long
    MAX_DESC = 600  # in chars, example 1200 characters.

    df_all["dataset_short_desc"] = (
        df_all["dataset_description"]
        .astype(str)
        .apply(lambda s: (s[:MAX_DESC] + "…") if len(s) > MAX_DESC else s)
    )
    return


@app.cell(hide_code=True)
def _(mo):
    export_button = mo.ui.run_button(label="Export dataframe to CSV")
    export_button
    return (export_button,)


@app.cell
def _(datapath, df, export_button, mo, reordered_cols):
    # block this cell from running until button is clicked
    mo.stop(not export_button.value)

    outfilename = "wri_datasets_all_joined_01.csv"
    df[reordered_cols].to_csv(datapath / outfilename)
    print(f"Saved to file: {outfilename}")
    return


@app.cell
def _(df_all):
    # Useful columns subsets

    all_columns = df_all.columns.to_list()

    reordered_cols = [
        "dataset_name",
        "dataset_tags",
        "source_collection",
        "dataset_id",
        "dataset_short_desc",
        "date_created",
        "date_last_updated",
        "source",
        "slug",
        "provider",
        "url",
        "license",
        "category",
        "group",
        "organization",
        "dataset_description",
        "layerCount",
        "layerNames",
        "numResources",
        "last_updated",
        "createdAt",
        "dataLastUpdated",
        "updatedAt",
        "type",
        "unit",
        "usedIn_EAP",
        "dataset_description",
        "usedIn_Demand",
        "usedIn_Supply",
        "usedIn_NeedAssist",
        "dataset_info_combined",
    ]

    standardized_cols = [
        "dataset_id",
        "dataset_name",
        "dataset_tags",
        "createdAt",
        "last_updated",
        "source_collection",
        "dataset_description",
        # "dataset_info_combined"
    ]

    display_cols = [
        "dataset_name",
        "source_collection",
        "dataset_short_desc",
        "dataset_tags",
        "source",
        "last_updated",
        # "dataset_description",
    ]
    return display_cols, reordered_cols


@app.cell
def _(df_all, mo, model_nomic):
    explanatory_text = mo.md(f"""
    In this visualization, each marker reprents one WRI dataset. **There are n = {len(df_all)} datasets shown**. <br><br>The metadata about each dataset is embedded in vector space using a tranformer. **The number of dimensions in the embedding is m = {model_nomic.get_sentence_embedding_dimension()}**. This creates a n x m ({len(df_all)} x {model_nomic.get_sentence_embedding_dimension()}) matrix, which is then projected into 2-dimensions using UMAP. <br><br>UMAP (Uniform Manifold Approximation and Projection) is a dimensionality reduction technique, commonly used for visualizing high-dimensional data in a lower-dimensional space (typically 2D or 3D). The projected dimensions themselves are not interpretable, but UMAP is good at preserving global and local structures (distances between nodes).<br><br>In the projection, **datasets that are close to each other are "similar"** in the embedding space.
    """)
    return (explanatory_text,)


@app.cell
def _(mo):
    diagram = mo.mermaid(
        """
    flowchart TD
        A["Dataset metadata<br/>(name, description, tags, etc)"] --> B["Text embedding<br/>(Transformer)<br/>High-dimensional vectors<br/>n × m"]
        B --> C["UMAP projection<br/>2D coordinates<br/>n × 2"]
        C --> D["Scatterplot<br/>Each point = 1 dataset"]

    """
    )
    return


@app.cell
def _(mo):
    explanatory_diagram = mo.mermaid(
        """
    flowchart TD
        S1["EAE Scraper"] --> A["Dataset metadata<br/>(name, description, tags, etc)"]
        S2["RW Scraper"] --> A
        S3["..."] --> A
        A --> B["Construct text feature"]
        B --> C["Embedding feature creates high-dimensional matrix <br> (n × m)"]
        C --> D["Projection onto two dimensional space <br> (n × 2)"]
        D --> E["Scatterplot<br/>each point = 1 dataset"]

    """
    )
    return (explanatory_diagram,)


@app.cell
def _(explanatory_diagram):
    explanatory_diagram
    return


@app.cell
def _():
    return


@app.cell(column=1)
def _():
    import altair as alt
    from sklearn.metrics import pairwise_distances
    from molabel import SimpleLabel
    from sentence_transformers import SentenceTransformer
    from umap import UMAP

    return SentenceTransformer, UMAP, alt, pairwise_distances


@app.cell(hide_code=True)
def _(alt, pltr):
    _chart = (
        alt.Chart(pltr, title="Datasets Projection Plot - test")
        .mark_point()
        .encode(
            x=alt.X(
                "x",
                scale=alt.Scale(domain=[pltr["x"].min() - 1, pltr["x"].max() + 1]),
                title="UMAP X",
            ),
            y=alt.Y(
                "y",
                scale=alt.Scale(domain=[pltr["y"].min() - 1, pltr["y"].max() + 1]),
                title="UMAP Y",
            ),
            color=alt.Color(
                "match_score",
                scale=alt.Scale(scheme="lightgreyred"),
                title="Cosine Distance to Query",
            ),
            tooltip=[alt.Tooltip("text", title="Dataset Info")],
        )
        .interactive()  # Enable pan/zoom
    )

    _chart
    return


@app.cell(hide_code=True)
def _(widget):
    widget.value["text"].reset_index()
    return


@app.cell(hide_code=True)
def _(mo):
    mo.md(r"""
    ### Note: these next few cells might quite expensive to run
    """)
    return


@app.cell
def _(SentenceTransformer):
    # block this cell from running until button is clicked
    # mo.stop(not run_button.value)

    model_nomic = SentenceTransformer("nomic-ai/nomic-embed-text-v1", trust_remote_code=True)
    return (model_nomic,)


@app.cell
def _(mo):
    embed_button = mo.ui.run_button(label="Run Embedding")
    embed_button
    return (embed_button,)


@app.cell
def _(df_all, embed_button, mo, model_nomic):
    # Construct textx from df_all["dataset_info_combined"]
    # typical runtime without GPU: 2.5 min

    # block this cell from running until button is clicked
    mo.stop(not embed_button.value)

    @mo.persistent_cache
    def embed_dataframe_text():
        # texts = df_all.to_dict()["dataset_info_combined"]
        texts = df_all["dataset_info_combined"].tolist()
        X = model_nomic.encode(texts)
        return texts, X

    texts, X = embed_dataframe_text()
    return X, texts


@app.cell
def _(model_nomic):
    # information about the transformer being used (embedding)
    model_nomic
    return


@app.cell
def _(X, df_all):
    # We have transformed all the text in df_all into this  high-dimensional embedding space
    print("Sanity Check")
    print(df_all.shape)
    print(X.shape)
    return


@app.cell
def _(mo):
    tranform_button = mo.ui.run_button(label="Apply dimensionality reduction")
    tranform_button
    return (tranform_button,)


@app.cell
def _(UMAP, X, mo, tranform_button):
    # dimensionality reduction step
    # UMAP - tends to do well to maintain clusters from global structure. But transformed distance between clusters is no longer interpretable.

    # block this cell from running until button is clicked
    mo.stop(not tranform_button.value)

    umap_model = UMAP(
        n_components=2, n_neighbors=10, min_dist=0.1, metric="cosine", random_state=42
    )
    """
    UMAP model
        n_components: 2 (for plotting in 2d for now)
        n_neighbors: size of the local neighborhood used to estimate the manifold structure.
        min_dist: how close points can be in the low-dim space.
        metric: we'll use 'cosine' distance metfic
        random_state: we'll fix a value for reproducibility

    n_components
    16 - first try, decent looking results. 
    30 - 

    """

    @mo.persistent_cache
    def apply_umap_transform():
        tfm = umap_model.fit(X)
        X_tfm = tfm.transform(X)
        return X_tfm

    X_tfm = apply_umap_transform()
    return X_tfm, umap_model


@app.cell
def _(umap_model):
    params = umap_model.get_params()
    print("UMAP Parameters:")
    for k, v in params.items():
        print(f"{k}: {v}")
    print(f"\nn_neighbors was set to: {umap_model.get_params()['n_neighbors']}")
    return


@app.cell
def _(X, X_tfm, model_nomic, pairwise_distances, pd, text_ui, texts):
    # Construct a dataframe from the low-dim data
    pltr = pd.DataFrame(X_tfm, columns=["x", "y"]).assign(text=texts, match_score=0)

    # Compute pairwise distances to set color
    if text_ui.value:
        vec = model_nomic.encode([text_ui.value])
        sim = 1 - pairwise_distances(vec, X, metric="cosine")[0]
        z = (sim - sim.mean()) / sim.std()
        pltr = pltr.assign(match_score=z)
    return (pltr,)


@app.cell
def _(text_ui):
    text_ui.value
    return


@app.cell
def _(pltr, text_ui):
    query = text_ui.value

    # Boolean mask for rows where 'drought' appears in the 'text' column (case-insensitive)
    query_mask = pltr["text"].str.contains(query, case=False, na=False)

    # Average 'match_score' for rows containing 'drought'
    avg_match_score_for_query = pltr.loc[query_mask, "match_score"].mean()

    # Overall average 'match_score'
    avg_match_score_overall = pltr["match_score"].mean()

    (avg_match_score_for_query, avg_match_score_overall)
    return


@app.cell
def _(pltr):
    pltr
    return


@app.cell
def _():
    return


@app.cell(column=2, hide_code=True)
def _(explanatory_diagram, explanatory_text, mo):
    mo.vstack(
        [
            mo.md("## Visualization of WRI Datasets: Experiment"),
            mo.hstack(
                [explanatory_text, explanatory_diagram],
                justify="start",
                wrap=True,
                widths=[2, 1],
                # widths="equal"
            ),
        ]
    )
    return


@app.cell(hide_code=True)
def _(alt, df_all, mo, pltr, text_ui, umap_model):
    chart = (
        alt.Chart(
            pltr,
            title=alt.Title(
                f"Datasets at WRI)",
                subtitle=[
                    f"{len(df_all)} datasets with API-provided metadata only",
                    f"UMAP projection (k_n={umap_model.get_params()['n_neighbors']})",
                ],
            ),
        )
        .mark_point()
        .encode(
            x=alt.X(
                "x",
                scale=alt.Scale(domain=[pltr["x"].min() - 1, pltr["x"].max() + 1]),
                title="UMAP X",
            ).axis(None),
            y=alt.Y(
                "y",
                scale=alt.Scale(domain=[pltr["y"].min() - 1, pltr["y"].max() + 1]),
                title="UMAP Y",
            ).axis(None),
            color=alt.Color(
                "match_score", scale=alt.Scale(scheme="lightgreyred"), title="similarity to query"
            ).legend(None),
            # tooltip=[alt.Tooltip("text", title="Dataset Info")]
        )
        .configure_axis(grid=False)
        .configure_view(stroke=None)
        # .interactive()  # to enable pan/zoom
    )

    if text_ui.value:
        print(f'Searching for user query: "{text_ui.value}"')

    widget = mo.ui.altair_chart(chart)
    widget
    return (widget,)


@app.cell(hide_code=True)
def _(mo):
    mo.md(r"""
    We can search this visualization to find concepts or topics of interest.
    """)
    return


@app.cell(hide_code=True)
def _(mo):
    text_ui = mo.ui.text(label="Color by text query")
    text_ui
    return (text_ui,)


@app.cell
def _(mo):
    mo.md(r"""
    We can interact with the visualization to make a selection.
    """)
    return


@app.cell(hide_code=True)
def _(mo, widget):
    mo.md(f"""
    ## Selection - {len(widget.value)} data sources selected
    """)
    return


@app.cell(hide_code=True)
def _(df_all, display_cols, widget):
    indices = widget.value.index

    df_selected = df_all.iloc[indices]

    df_selected[display_cols]
    return (indices,)


@app.cell(hide_code=True)
def _(df_all, display_cols, indices, pd, reordered_cols):
    # Print details on the first selected dataset
    def print_row_details(iidx):
        row = df_all.loc[iidx, reordered_cols].copy()
        # Remove 'dataset_info_combined' if present
        if "dataset_info_combined" in row.index:
            row = row.drop("dataset_info_combined")

        # Separate columns in display_cols and all others
        display_keys = [k for k in display_cols if k in row.index]
        other_keys = [k for k in row.index if k not in display_keys]

        # Prepare printable dict without null/empty values
        row_dict = row.to_dict()
        non_empty = {
            k: v
            for k, v in row_dict.items()
            if pd.notna(v) and str(v).strip() not in ("", "nan", "None")
        }
        empty_keys = [k for k, v in row_dict.items() if k not in non_empty]

        # Alignment for colons
        all_keys_for_print = display_keys + [k for k in other_keys if k in non_empty]
        maxlen = max((len(str(k)) for k in all_keys_for_print), default=8) + 2

        print(f"Row number: {iidx}")
        print("\n--- Main ---")
        for k in display_keys:
            if k in non_empty:
                print(f"{k:<{maxlen}}: {non_empty[k]}")
        print("\n--- Metadata ---")
        for k in other_keys:
            if k in non_empty:
                print(f"{k:<{maxlen}}: {non_empty[k]}")
        if empty_keys:
            print("\n--- Keys with no value ---")
            print(", ".join(empty_keys))

    # Example usage:
    if len(indices.values) > 0:
        print_row_details(indices[0])
    return


if __name__ == "__main__":
    app.run()
