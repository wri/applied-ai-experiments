# /// script
# requires-python = ">=3.11"
# dependencies = [
#     "marimo",
#     "pandas==2.3.3",
# ]
# ///

import marimo

__generated_with = "0.17.2"
app = marimo.App(width="medium")


@app.cell(hide_code=True)
def _(mo):
    mo.md(
        r"""
    ## Energy Access Explorer datasets extract

    Guess the datasets that are in the EAE by looking at a methodology technote. 

    Build a structured catalog from the "Energy Access Explorer: Data and Methods" document:
    https://files.wri.org/d8/s3fs-public/energy-access-explorer-data-and-methods.pdf
    """
    )
    return


@app.cell(hide_code=True)
def _(mo):
    mo.md(
        r"""
    ## Energy Access Explorer (PDF scrape) → `eae_datasets_pdf-extract.csv`

     **What this does**

     * Extracts a structured list of EAE inputs from the WRI *Energy Access Explorer: Data and Methods* PDF.
     * Produces a catalog aligned to our schema with concise descriptions.

     **Source**

     * Uploaded PDF: *energy-access-explorer-data-and-methods.pdf* (Figure 1 + Table 1)

     **Fields captured**

     * Core: `id`, `name`, `category` (Demographics, Social & Productive Uses, Resources, Infrastructure), `group` (Demand/Supply)
     * Descriptors: `unit`, `tags`, `description`
     * Flags: `usedIn_EAP`, `usedIn_Demand`, `usedIn_Supply`, `usedIn_NeedAssist`
     * Placeholders (not in PDF): `provider`, `layerCount`, `layerNames`, timestamps

     **Implementation notes**

     * This is a *document-derived* catalog (static snapshot), not an API crawl.
     * Where the PDF lacks providers/timestamps, we leave fields blank.
     * Descriptions are concise, one-liners summarizing each input.
    """
    )
    return


@app.cell
def _():
    import marimo as mo

    return (mo,)


@app.cell
def _():
    import pandas as pd
    from pathlib import Path
    import re

    # Calculate data directory - works whether run from src/ or root
    SCRIPT_DIR = Path.cwd()
    DATA_DIR = SCRIPT_DIR.parent / "data" if SCRIPT_DIR.name == "src" else SCRIPT_DIR / "data"
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    return DATA_DIR, Path, pd, re


@app.cell
def _(DATA_DIR, Path, pd, re):
    # We create a pandas DataFrame with columns aligned (where possible) to schema already used,
    # plus a concise description. Write dataframe to CSV

    # Helper to slugify into an id
    def slugify(s):
        s = s.strip().lower()
        s = re.sub(r"[^a-z0-9\s\-_/]", "", s)
        s = s.replace("/", " ")
        s = re.sub(r"\s+", "-", s)
        s = re.sub(r"-+", "-", s)
        return s

    rows = []

    def add_row(
        name,
        category,
        group,
        unit=None,
        eap=True,
        demand=None,
        supply=None,
        need=None,
        tags=None,
        description=None,
    ):
        row = {
            "id": slugify(name if group is None else f"{group}-{name}"),
            "name": name,
            "category": category,  # Demographics / Social & Productive Uses / Resources / Infrastructure
            "group": group,  # High-level bucket from Figure 1 (Demand or Supply) if relevant
            "unit": unit or "",
            "usedIn_EAP": bool(eap) if eap is not None else "",
            "usedIn_Demand": bool(demand) if demand is not None else "",
            "usedIn_Supply": bool(supply) if supply is not None else "",
            "usedIn_NeedAssist": bool(need) if need is not None else "",
            "provider": "",  # not in the PDF
            "tags": ", ".join(tags) if tags else "",
            "layerCount": "",  # not applicable
            "layerNames": "",  # not applicable
            "createdAt": "",  # not available
            "dataLastUpdated": "",  # not available
            "updatedAt": "",  # not available
            "description": description or "",
        }
        rows.append(row)

    # --- DEMAND SIDE (Demographics + Social & Productive Uses) ---
    # Demographics (Figure 1 + narrative)
    add_row(
        name="Population",
        category="Demographics",
        group="Demand",
        unit="People/km²",
        eap=True,
        demand=True,
        supply=None,
        need=None,
        tags=["population", "geospatial"],
        description="Population density as a proxy for demand concentration.",
    )
    add_row(
        name="Poverty",
        category="Demographics",
        group="Demand",
        unit="% of population below poverty line",
        eap=True,
        demand=True,
        supply=None,
        need=True,  # Need for Assistance uses higher when far/poor per Table 1
        tags=["poverty", "affordability"],
        description="Share of people below poverty line; affordability proxy (inverted in demand index).",
    )
    add_row(
        name="Household Electrification",
        category="Demographics",
        group="Demand",
        unit="Percent of households electrified",
        eap=True,
        demand=True,
        supply=None,
        need=None,
        tags=["electrification", "access"],
        description="Household electricity access rate to reflect unmet demand.",
    )
    add_row(
        name="Mobile Phone Ownership",
        category="Demographics",
        group="Demand",
        unit="Ownership rate",
        eap=True,
        demand=True,
        supply=None,
        need=None,
        tags=["mobile", "ownership", "proxy"],
        description="Proxy for ability to pay and service needs; also relevant for PAYG models.",
    )
    add_row(
        name="Radio Ownership",
        category="Demographics",
        group="Demand",
        unit="Ownership rate",
        eap=True,
        demand=True,
        supply=None,
        need=None,
        tags=["radio", "ownership", "proxy"],
        description="Proxy for asset ownership and electricity service demand.",
    )
    add_row(
        name="Iron Sheet Roofing",
        category="Demographics",
        group="Demand",
        unit="Share of households",
        eap=True,
        demand=True,
        supply=None,
        need=None,
        tags=["roofing", "asset proxy"],
        description="Asset proxy linked to income/ability to pay in certain geographies.",
    )
    add_row(
        name="Livestock Ownership",
        category="Demographics",
        group="Demand",
        unit="Ownership rate",
        eap=True,
        demand=True,
        supply=None,
        need=None,
        tags=["livestock", "asset proxy"],
        description="Asset proxy; used as a filter when available at coarse resolution.",
    )

    # Social & Productive Uses (Figure 1 + Table 1)
    add_row(
        name="Education Facilities",
        category="Social & Productive Uses",
        group="Demand",
        unit="Distance to nearest facility (km)",
        eap=True,
        demand=True,
        supply=None,
        need=True,
        tags=["schools", "public services"],
        description="Proximity to schools; important social load and service demand.",
    )
    add_row(
        name="Health Care Facilities",
        category="Social & Productive Uses",
        group="Demand",
        unit="Distance to nearest facility (km)",
        eap=True,
        demand=True,
        supply=None,
        need=True,
        tags=["clinics", "hospitals", "public services"],
        description="Proximity to health facilities; critical social load and service demand.",
    )
    add_row(
        name="Agricultural Zones",
        category="Social & Productive Uses",
        group="Demand",
        unit="Presence/extent",
        eap=True,
        demand=True,
        supply=None,
        need=None,
        tags=["agriculture", "productive use"],
        description="Areas of agricultural activity; proxy for productive demand potential.",
    )
    add_row(
        name="Irrigated Croplands",
        category="Social & Productive Uses",
        group="Demand",
        unit="Production (metric tons)",
        eap=True,
        demand=True,
        supply=None,
        need=True,
        tags=["agriculture", "irrigation"],
        description="Irrigated crop production as a driver of electricity demand (e.g., pumping).",
    )
    add_row(
        name="Rain-fed Croplands",
        category="Social & Productive Uses",
        group="Demand",
        unit="Production (metric tons)",
        eap=True,
        demand=True,
        supply=None,
        need=True,
        tags=["agriculture"],
        description="Rain-fed crop production; indicates potential productive loads.",
    )
    add_row(
        name="Mines and Quarries",
        category="Social & Productive Uses",
        group="Demand",
        unit="Distance to nearest site (km)",
        eap=True,
        demand=True,
        supply=None,
        need=True,
        tags=["mining", "industry"],
        description="Proximity to mines/quarries; potential large loads off-grid or grid-based.",
    )
    add_row(
        name="Commercial Activities & SMEs",
        category="Social & Productive Uses",
        group="Demand",
        unit="Presence/extent",
        eap=True,
        demand=True,
        supply=None,
        need=None,
        tags=["commerce", "SME"],
        description="Commercial and SME activity as a proxy for demand (from Figure 1).",
    )
    add_row(
        name="Public Institutions",
        category="Social & Productive Uses",
        group="Demand",
        unit="Presence/extent",
        eap=True,
        demand=True,
        supply=None,
        need=None,
        tags=["public institutions"],
        description="Institutional demand centers (from Figure 1).",
    )
    add_row(
        name="Nighttime Lights",
        category="Social & Productive Uses",
        group="Demand",
        unit="Calibrated radiance (0–255)",
        eap=True,
        demand=True,
        supply=None,
        need=True,
        tags=["NTL", "remote sensing"],
        description="Proxy for existing electricity use and socioeconomic activity.",
    )

    # --- SUPPLY SIDE (Resources + Infrastructure) ---
    # Resources
    add_row(
        name="Solar Potential (GHI)",
        category="Resources",
        group="Supply",
        unit="kWh/m² (yearly sum of GHI)",
        eap=True,
        demand=None,
        supply=True,
        need=None,
        tags=["solar", "GHI"],
        description="Global Horizontal Irradiance indicating solar PV potential.",
    )
    add_row(
        name="Wind Potential (Wind Speed)",
        category="Resources",
        group="Supply",
        unit="m/s at 50 m",
        eap=True,
        demand=None,
        supply=True,
        need=None,
        tags=["wind"],
        description="Wind speed as a proxy for wind power potential.",
    )
    add_row(
        name="Geothermal Potential (Locations)",
        category="Resources",
        group="Supply",
        unit="Distance to potential site (km)",
        eap=True,
        demand=None,
        supply=True,
        need=None,
        tags=["geothermal"],
        description="Proximity to potential geothermal sites.",
    )
    add_row(
        name="Mini & Small Hydropower Potential (Locations)",
        category="Resources",
        group="Supply",
        unit="Distance to potential site (km)",
        eap=True,
        demand=None,
        supply=True,
        need=None,
        tags=["hydropower", "mini-hydro"],
        description="Proximity to potential mini/small hydro sites.",
    )

    # Infrastructure
    add_row(
        name="Existing Transmission & Distribution Network",
        category="Infrastructure",
        group="Supply",
        unit="Distance to nearest line (km)",
        eap=True,
        demand=None,
        supply=True,
        need=True,
        tags=["grid", "transmission", "distribution"],
        description="Proximity to existing grid infrastructure; key for grid-extension viability.",
    )
    add_row(
        name="Planned Transmission & Distribution Network",
        category="Infrastructure",
        group="Supply",
        unit="Distance to nearest planned line (km)",
        eap=True,
        demand=None,
        supply=True,
        need=True,
        tags=["grid planning", "transmission", "distribution"],
        description="Proximity to planned grid expansions; impacts future connectivity.",
    )
    add_row(
        name="Mini-grids (Existing)",
        category="Infrastructure",
        group="Supply",
        unit="Distance to nearest mini-grid (km)",
        eap=True,
        demand=None,
        supply=True,
        need=True,
        tags=["mini-grid", "off-grid"],
        description="Proximity to existing mini-grids indicating current off-grid supply.",
    )
    add_row(
        name="Power Plants",
        category="Infrastructure",
        group="Supply",
        unit="Distance to nearest power plant (km)",
        eap=True,
        demand=None,
        supply=True,
        need=True,
        tags=["generation", "grid"],
        description="Proximity to generation sites as part of supply and grid context.",
    )
    add_row(
        name="Accessibility to Cities",
        category="Infrastructure",
        group="Supply",
        unit="Travel time to nearest city (minutes)",
        eap=True,
        demand=None,
        supply=True,
        need=True,
        tags=["accessibility", "roads", "cities"],
        description="Travel time as a proxy for market access and logistics costs.",
    )

    # Assemble DataFrame
    df = pd.DataFrame(rows)

    # Order columns similar to earlier schema plus our fields
    cols = [
        "id",
        "name",
        "category",
        "group",
        "unit",
        "usedIn_EAP",
        "usedIn_Demand",
        "usedIn_Supply",
        "usedIn_NeedAssist",
        "provider",
        "tags",
        "layerCount",
        "layerNames",
        "createdAt",
        "dataLastUpdated",
        "updatedAt",
        "description",
    ]
    df = df[cols]

    # Save to CSV
    out_path = DATA_DIR / "eae_datasets_pdf-extract.csv"
    df.to_csv(out_path, index=False, encoding="utf-8")
    return (df,)


@app.cell
def _(df):
    df
    return


@app.cell
def _():
    return


if __name__ == "__main__":
    app.run()
