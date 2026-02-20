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
]


def main():
    print("Fetching all WRI datasets...")
    print(f"Running {len(FETCH_NOTEBOOKS)} fetch notebooks\n")

    # Ensure data directory exists (relative to src/)
    data_dir = Path(__file__).parent.parent / "data"
    data_dir.mkdir(parents=True, exist_ok=True)

    # Run each notebook
    for i, notebook in enumerate(FETCH_NOTEBOOKS, 1):
        print(f"[{i}/{len(FETCH_NOTEBOOKS)}] Running {notebook}...")
        try:
            subprocess.run(["uv", "run", notebook], check=True)
            print(f"✓ Completed {notebook}\n")
        except subprocess.CalledProcessError as e:
            print(f"✗ Failed: {notebook}", file=sys.stderr)
            sys.exit(1)

    print(f"✓ All datasets fetched successfully!")
    print(f"Data files are in: {data_dir.absolute()}")


if __name__ == "__main__":
    main()
