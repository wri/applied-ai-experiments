"""Where runs live on disk, and which of them count.

A run used to be `results/{model}/pass-{n}`, a position in a sequence. Two
runs could want the same name, so the harness carried guards to stop the
second destroying the first, and the directory told a reader nothing about
when it ran or against what code. A run is now named for its start time and
the harness commit, which collides with nothing and reads on sight.

Nothing here knows that naming scheme. A run is a directory holding a
meta.json, which keeps the readers working whatever the name says.
"""

from __future__ import annotations

import json
from pathlib import Path

# A session that wrote no answer at all measured nothing about the model. It
# stays on disk for the audit trail and stays out of the averages.
SCORED_STATUSES = {"done", "incomplete"}


def run_dirs(results_dir: Path, model: str = "") -> list[Path]:
    """Every run directory, oldest first.

    Run ids start with a UTC timestamp, so sorting the names sorts by time.
    """
    pattern = f"{model}/*" if model else "*/*"
    return sorted(d for d in results_dir.glob(pattern)
                  if (d / "meta.json").exists())


def read_meta(run_dir: Path) -> dict:
    return json.loads((run_dir / "meta.json").read_text(encoding="utf-8"))


def run_name(run_dir: Path) -> str:
    """How a run is named in output: model and run id."""
    return f"{run_dir.parent.name}/{run_dir.name}"


def is_scored(meta: dict) -> bool:
    """Whether a run belongs in an average.

    Runs predating the status field were all complete, so absence reads as
    scored rather than as a run to silently drop.
    """
    return meta.get("status", "done") in SCORED_STATUSES


def arm_of(meta: dict) -> str:
    """Which ablation arm a run was given, defaulting to the whole spec.

    Runs predating the ablation harness carry no block, and they did see the
    whole spec, so reading absence as "full" is accurate rather than a guess.
    """
    return meta.get("ablation", {}).get("arm") or "full"


def spec_of(meta: dict) -> str | None:
    """The digest of the spec a run actually saw, or None if it predates it."""
    return meta.get("spec_fingerprint")


def group_by_arm(dirs: list[Path]) -> dict[tuple[str, str | None], list[Path]]:
    """Runs bucketed by (arm, spec digest), oldest first within a bucket.

    Keyed on the pair, never the arm name alone. A name says what someone
    meant to run; the digest says what the session was handed. Edit a policy
    between Tuesday and Friday and both days answer to `no-coops` while
    measuring different specs, so pooling them would average two experiments.
    """
    groups: dict[tuple[str, str | None], list[Path]] = {}
    for run_dir in dirs:
        meta = read_meta(run_dir)
        groups.setdefault((arm_of(meta), spec_of(meta)), []).append(run_dir)
    return groups


def regraded(meta: dict) -> bool:
    """Whether a run's score comes from different fixtures than it ran against.

    True only when both digests are known and disagree. Runs predating either
    field cannot be compared, and absence is not evidence of a mismatch.
    """
    ran, scored = meta.get("golden_fingerprint"), meta.get("graded_against")
    return bool(ran and scored and ran != scored)
