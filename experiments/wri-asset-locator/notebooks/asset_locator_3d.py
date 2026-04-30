# /// script
# requires-python = ">=3.11"
# dependencies = [
#     "anywidget==0.9.11",
#     "einops==0.8.1",
#     "marimo",
#     "numpy==1.26.4",
#     "pandas==2.3.3",
#     "pyarrow==22.0.0",
#     "scikit-learn==1.7.2",
#     "sentence-transformers==5.1.2",
#     "traitlets==5.14.3",
#     "umap-learn==0.5.9.post2",
# ]
# ///

import marimo

__generated_with = "0.23.4"
app = marimo.App(width="columns")


@app.cell(column=0, hide_code=True)
def _(mo):
    mo.md(r"""
    # WRI Datasets — 3D Canvas Scatter

    1. **Data aggregation** — load and combine WRI dataset CSVs.
    2. **Text synthesis** — serialize metadata into a single text feature per dataset.
    3. **Feature representation** — embed each text with a sentence-transformer model.
    4. **Dimensionality reduction** — project embeddings to 2D *and* 3D with UMAP.
    5. **Visualization** — interactive Canvas scatter with 2D/3D toggle, pan, zoom, rotate, and selection.
    """)
    return


@app.cell(hide_code=True)
def _(mo):
    mo.md(r"""
    ## Load datasets
    Same CSV sources as `wri_all_datasets_combined.py`.
    """)
    return


@app.cell
def _():
    import marimo as mo
    import os
    import pandas as pd
    import re
    import html
    from datetime import datetime
    from pathlib import Path

    return Path, datetime, html, mo, pd, re


@app.cell
def _(Path):
    # Calculate data directory - works whether run from notebooks/ or root
    NOTEBOOK_DIR = Path.cwd()
    DATA_DIR = (
        NOTEBOOK_DIR.parent / "data" if NOTEBOOK_DIR.name == "notebooks" else NOTEBOOK_DIR / "data"
    )
    datapath = DATA_DIR
    print(f"Data directory: {datapath.absolute()}")

    COMBINED_ASSETS_FILE = "wri_assets_info_combined.csv"
    return COMBINED_ASSETS_FILE, NOTEBOOK_DIR, datapath


@app.cell
def _(COMBINED_ASSETS_FILE, datapath, pd):
    # Load the pre-combined assets data
    df_all = pd.read_csv(
        datapath / COMBINED_ASSETS_FILE,
        dtype={
            "asset_last_updated_year": str,
            "asset_created_year": str,
        }
    )
    print(f"Loaded {len(df_all)} assets from combined dataset")
    print(f"Shape: {df_all.shape}")
    print(f"Columns: {len(df_all.columns)}")
    return (df_all,)


@app.cell(hide_code=True)
def _(mo):
    mo.md("""
    ## Text synthesis
    """)
    return


@app.cell
def _(datetime, html, pd, re):
    # Text cleaning and serialization utilities

    # Choose a delimiter that won't collide often in natural text
    DELIM = " | "

    # Columns you definitely want to include if present
    SERIALIZE_COLUMNS = [
        "dataset_name",
        "dataset_description",
        "dataset_short_desc",
        "dataset_tags",
        "slug",

        "layerNames", 
        "license", 

        'asset_last_updated_year',
        'asset_created_year',
        #"date_last_updated", "updatedAt", "dataLastUpdated", "last_updated",
        #"date_created", "createdAt"
    
        ## NOT INCLUDED
        # "dataset_id",
        # "source_collection",
        # "source", 
        # "organization"
        # "provider", 
        # "url"
    
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

    def serialize_row(row: pd.Series, serialize_cols=SERIALIZE_COLUMNS, delim=DELIM):
        # build ordered list: preferred first (if present), then all others (stable name sort) minus duplicates
        cols = [c for c in serialize_cols if c in row.index]

        parts = []
        for col in cols:
            val = row[col]
            if col in ("date_last_updated", "date_created"):
                val = to_iso_date(val)
            val = clean_text(val)

            if col in ("asset_last_updated_year", "asset_created_year"):
                try:
                    val = str(int(float(val)))
                except (ValueError, TypeError):
                    val = ""
    
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
    # Create combined text field for each asset
    df_all["dataset_info_combined"] = df_all.apply(serialize_row, axis=1)
    print("Created 'dataset_info_combined' field")
    return


@app.cell(hide_code=True)
def _(mo):
    mo.md("""
    ## Embedding & UMAP
    """)
    return


@app.cell
def _():
    from sentence_transformers import SentenceTransformer
    from umap import UMAP

    return SentenceTransformer, UMAP


@app.cell
def _(SentenceTransformer):
    # block this cell from running until button is clicked
    # mo.stop(not run_button.value)

    # nomic-ai/nomic-embed-text-v1 — 768d, 8192 token context, requires "search_query:"/"search_document:" prefixes; good for long text
    # embed_model = SentenceTransformer("nomic-ai/nomic-embed-text-v1", trust_remote_code=True)

    # BAAI/bge-large-en-v1.5 — 1024d, best MTEB retrieval (54.29), best Earth Science score; query prefix optional
    embed_model = SentenceTransformer("BAAI/bge-large-en-v1.5")

    # thenlper/gte-large — 1024d, 0.67GB, no prefix needed, ~2pts behind bge-large on retrieval; most lightweight option
    # embed_model = SentenceTransformer("thenlper/gte-large")
    return (embed_model,)


@app.cell
def _(mo):
    embed_button = mo.ui.run_button(label="Run Embedding")
    embed_button
    return (embed_button,)


@app.cell
def _(df_all, embed_button, embed_model, mo):
    # Construct textx from df_all["dataset_info_combined"]
    # typical runtime without GPU: 2.5 min

    # block this cell from running until button is clicked
    mo.stop(not embed_button.value)

    @mo.persistent_cache
    def embed_dataframe_text():
        # texts = df_all.to_dict()["dataset_info_combined"]
        texts = df_all["dataset_info_combined"].tolist()
        X = embed_model.encode(texts)
        return texts, X

    texts, X = embed_dataframe_text()
    return (X,)


@app.cell
def _(mo):
    umap_button = mo.ui.run_button(label="Apply UMAP (2D + 3D)")
    umap_button
    return (umap_button,)


@app.cell
def _(UMAP, X, mo, umap_button):
    mo.stop(not umap_button.value)

    @mo.persistent_cache
    def run_umap():
        umap2d = UMAP(
            n_components=2,
            n_neighbors=10,
            min_dist=0.1,
            metric="cosine",
            random_state=42,
        )
        umap3d = UMAP(
            n_components=3,
            n_neighbors=10,
            min_dist=0.1,
            metric="cosine",
            random_state=42,
        )
        coords2d = umap2d.fit_transform(X)
        coords3d = umap3d.fit_transform(X)
        return coords2d, coords3d

    coords2d, coords3d = run_umap()
    return coords2d, coords3d


@app.cell(hide_code=True)
def _(mo):
    mo.md("""
    ## Visualization
    """)
    return


@app.cell
def _():
    import anywidget
    import traitlets

    return anywidget, traitlets


@app.cell
def _(NOTEBOOK_DIR, anywidget, traitlets):
    _src = NOTEBOOK_DIR.parent / "src" if NOTEBOOK_DIR.name == "notebooks" else NOTEBOOK_DIR / "src"

    class Canvas3DScatter(anywidget.AnyWidget):
        """Interactive 2D/3D canvas scatter plot widget."""

        points_2d = traitlets.List(traitlets.List()).tag(sync=True)
        points_3d = traitlets.List(traitlets.List()).tag(sync=True)
        colors = traitlets.List().tag(sync=True)
        labels = traitlets.List().tag(sync=True)
        mode = traitlets.Unicode("2d").tag(sync=True)
        selected_indices = traitlets.List().tag(sync=True)

        _esm = _src / "scatter3d_widget.js"
        _css = _src / "scatter3d_widget.css"

    return (Canvas3DScatter,)


@app.cell
def _():
    return


@app.cell(column=1, hide_code=True)
def _(mo):
    mo.md(r"""
    ### Legend

    | Colour | Collection |
    |--------|-----------|
    | 🟢 `#6ee7b7` | resource_watch |
    | 🔵 `#38bdf8` | arcgis_wri_catalog |
    | 🟣 `#a78bfa` | global_forest_watch |
    | 🟠 `#fb923c` | energy_access_explorer |
    | 🩷 `#f472b6` | wri_data_explorer |
    """)
    return


@app.cell(hide_code=True)
def _(Canvas3DScatter, coords2d, coords3d, df_all, mo):
    # Normalise coordinates to [0, 1]
    def _norm(arr):
        lo, hi = arr.min(axis=0), arr.max(axis=0)
        rng = hi - lo
        rng[rng == 0] = 1
        return (arr - lo) / rng

    _pts2d = _norm(coords2d).tolist()
    _pts3d = _norm(coords3d).tolist()

    # Assign a colour per source_collection
    _palette = ["#6ee7b7", "#38bdf8", "#a78bfa", "#fb923c", "#f472b6"]
    _collections = df_all["source_collection"].unique().tolist()
    _cmap = {c: _palette[i % len(_palette)] for i, c in enumerate(_collections)}
    _colors = df_all["source_collection"].map(_cmap).tolist()

    _labels = df_all["dataset_name"].tolist()

    scatter_widget = mo.ui.anywidget(
        Canvas3DScatter(
            points_2d=_pts2d,
            points_3d=_pts3d,
            colors=_colors,
            labels=_labels,
        )
    )
    scatter_widget
    return (scatter_widget,)


@app.cell(hide_code=True)
def _(mo):
    mo.md("""
    ## Selection
    """)
    return


@app.cell(hide_code=True)
def _(mo, scatter_widget):
    mo.md(f"""
    **{len(scatter_widget.value.get('selected_indices', []))} datasets selected** (Shift+drag on the canvas to select)
    """)
    return


@app.cell
def _(df_all, scatter_widget):
    _indices = scatter_widget.value.get("selected_indices", [])
    _display_cols = [
        "dataset_name",
        "source",
        "asset_created_year",
    ]

    df_selected = (
        df_all.iloc[_indices][_display_cols]
        if _indices
        else df_all.head(0)[_display_cols]
    )
    df_selected
    return


if __name__ == "__main__":
    app.run()
