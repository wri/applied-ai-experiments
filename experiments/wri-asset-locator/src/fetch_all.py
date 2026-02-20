#!/usr/bin/env python3
"""Fetch all WRI datasets by running each fetch notebook in sequence."""

import subprocess
import sys
from pathlib import Path

FETCH_NOTEBOOKS = [
    "fetch_datasets_arcgis_wri_catalog.py",
    "fetch_datasets_global_forest_watch.py",
    "fetch_datasets_resource_watch_datasets.py",
    "fetch_datasets_scrape_pdfreport_energy_access_explorer.py",
    "fetch_datasets_wri_data_explorer.py",
    "combine_assets_data.py",  # Combines all individual datasets
]


def main():
    print("Fetching all WRI assets and combining data...")
    print(f"Running {len(FETCH_NOTEBOOKS)} scripts\n")

    # Get src directory (where this script lives)
    src_dir = Path(__file__).parent

    # Ensure data directory exists (relative to src/)
    data_dir = src_dir.parent / "data"
    data_dir.mkdir(parents=True, exist_ok=True)

    # Run each notebook from the src directory
    for i, notebook in enumerate(FETCH_NOTEBOOKS, 1):
        print(f"[{i}/{len(FETCH_NOTEBOOKS)}] Running {notebook}...")
        try:
            notebook_path = src_dir / notebook
            subprocess.run(["uv", "run", str(notebook_path)], check=True)
            print(f"✓ Completed {notebook}\n")
        except subprocess.CalledProcessError as e:
            print(f"✗ Failed: {notebook}", file=sys.stderr)
            sys.exit(1)

    print(f"✓ All assets fetched and combined successfully!")
    print(f"Data files are in: {data_dir.absolute()}")
    print(f"\nCombined data available in: wri_assets_info_combined.csv")


if __name__ == "__main__":
    main()
