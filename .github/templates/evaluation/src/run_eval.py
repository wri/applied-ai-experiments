#!/usr/bin/env python3
"""
Main evaluation runner.

Usage:
    python src/run_eval.py
    python src/run_eval.py --config configs/models.yaml
"""

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

import yaml

# Paths
SCRIPT_DIR = Path(__file__).parent
ROOT_DIR = SCRIPT_DIR.parent
DATA_DIR = ROOT_DIR / "data"
RESULTS_DIR = ROOT_DIR / "results"
CONFIGS_DIR = ROOT_DIR / "configs"


def load_test_cases(path: Path) -> list[dict]:
    """Load test cases from YAML file."""
    with open(path) as f:
        data = yaml.safe_load(f)
    return data.get("test_cases", [])


def load_config(path: Path) -> dict:
    """Load evaluation configuration."""
    with open(path) as f:
        return yaml.safe_load(f)


def evaluate_model(model_id: str, test_cases: list[dict], config: dict) -> dict:
    """
    Run evaluation for a single model.

    Args:
        model_id: Identifier for the model
        test_cases: List of test case dictionaries
        config: Model configuration

    Returns:
        Dictionary with evaluation results
    """
    # TODO: Implement actual evaluation logic
    results = {
        "model_id": model_id,
        "config": config,
        "scores": [],
        "metrics": {},
    }

    for case in test_cases:
        # TODO: Run model inference
        # TODO: Score the response
        score = {
            "case_id": case.get("id"),
            "input": case.get("input"),
            "expected": case.get("expected"),
            "actual": None,  # TODO: Model output
            "score": None,  # TODO: Computed score
        }
        results["scores"].append(score)

    # TODO: Compute aggregate metrics
    # results["metrics"] = {
    #     "accuracy": compute_accuracy(results["scores"]),
    #     "latency_ms": compute_avg_latency(results["scores"]),
    # }

    return results


def run_evaluation(config_path: Path) -> dict:
    """
    Run full evaluation across all configured models.

    Args:
        config_path: Path to models configuration file

    Returns:
        Dictionary with all evaluation results
    """
    config = load_config(config_path)
    test_cases = load_test_cases(DATA_DIR / "test_cases.yaml")

    print(f"Loaded {len(test_cases)} test cases")
    print(f"Evaluating {len(config.get('models', []))} models")

    results = {
        "eval_id": f"eval-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "config_file": str(config_path),
        "n_test_cases": len(test_cases),
        "models": {},
    }

    for model_config in config.get("models", []):
        model_id = model_config.get("id")
        print(f"\nEvaluating: {model_id}")

        model_results = evaluate_model(model_id, test_cases, model_config)
        results["models"][model_id] = model_results

    return results


def save_results(results: dict, output_path: Path):
    """Save evaluation results to file."""
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Save as YAML for human readability
    yaml_path = output_path.with_suffix(".yaml")
    with open(yaml_path, "w") as f:
        yaml.dump(results, f, default_flow_style=False, sort_keys=False)
    print(f"Results saved to: {yaml_path}")

    # Also save as JSON for programmatic access
    json_path = output_path.with_suffix(".json")
    with open(json_path, "w") as f:
        json.dump(results, f, indent=2, default=str)
    print(f"Results saved to: {json_path}")


def main():
    parser = argparse.ArgumentParser(description="Run evaluation")
    parser.add_argument(
        "--config",
        type=Path,
        default=CONFIGS_DIR / "models.yaml",
        help="Path to models configuration file",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=RESULTS_DIR / "eval-results",
        help="Output path for results (without extension)",
    )
    args = parser.parse_args()

    print("=" * 60)
    print("EVALUATION RUNNER")
    print("=" * 60)

    results = run_evaluation(args.config)
    save_results(results, args.output)

    print("\n" + "=" * 60)
    print("EVALUATION COMPLETE")
    print("=" * 60)


if __name__ == "__main__":
    main()
