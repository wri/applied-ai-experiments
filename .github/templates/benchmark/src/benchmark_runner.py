#!/usr/bin/env python3
"""
Benchmark runner for evaluating models.

Usage:
    python src/benchmark_runner.py --model MODEL_ID
"""

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

import yaml

ROOT_DIR = Path(__file__).parent.parent
DATA_DIR = ROOT_DIR / "data"
RESULTS_DIR = ROOT_DIR / "results"


def load_samples(samples_dir: Path) -> list[dict]:
    """Load all benchmark samples."""
    samples = []
    for path in sorted(samples_dir.glob("*.json")):
        with open(path) as f:
            samples.append(json.load(f))
    return samples


def run_benchmark(model_id: str, samples: list[dict]) -> dict:
    """Run benchmark for a model."""
    # TODO: Implement actual benchmark logic
    results = {
        "model_id": model_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "n_samples": len(samples),
        "scores": [],
        "metrics": {},
    }

    for sample in samples:
        # TODO: Run model and score
        score_entry = {
            "sample_id": sample["id"],
            "score": None,
        }
        results["scores"].append(score_entry)

    return results


def main():
    parser = argparse.ArgumentParser(description="Run benchmark")
    parser.add_argument("--model", required=True, help="Model ID to evaluate")
    parser.add_argument("--output", type=Path, default=RESULTS_DIR / "latest.yaml")
    args = parser.parse_args()

    samples = load_samples(DATA_DIR / "samples")
    print(f"Loaded {len(samples)} samples")

    results = run_benchmark(args.model, samples)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    with open(args.output, "w") as f:
        yaml.dump(results, f)

    print(f"Results saved to: {args.output}")


if __name__ == "__main__":
    main()
