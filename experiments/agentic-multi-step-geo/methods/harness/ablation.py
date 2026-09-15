"""Withhold part of the spec from a session, and record exactly what it saw.

The benchmark measures whether a model implements a written spec. It cannot,
on its own, say how much any part of that spec is worth. An ablation answers
that by removing a piece and re-running: drop a whole policy document, or cut
one section out of one.

Two rules run through everything here.

**A failed operation is an error, never a warning.** A session costs about
four dollars and twelve minutes. An arm whose heading no longer matches the
document would ablate nothing, score like the baseline, and read as evidence
that the spec does not matter -- an expensive false conclusion, and an
invisible one. So a missing file, an absent heading, or an ambiguous one stops
the sweep before the first container starts.

**The ablated document must not look ablated.** A cut leaves no marker and no
run of blank lines. A session that can see something was withheld behaves
differently -- it hedges, or reports the policy as incomplete -- which measures
the notice rather than the missing text.
"""

from __future__ import annotations

import hashlib
import re
import shutil
from pathlib import Path

# What spec_fingerprint covers, relative to the assembled workspace. The input
# lists are deliberately outside it: input_mode is already its own recorded
# axis, and folding it in here would make every csv-versus-geometry comparison
# read as two different specs. When a future operation reaches something new --
# a mirrored catalog, say -- it belongs in this tuple.
FINGERPRINTED = ("task.md", "policies")

# An ATX heading: up to six hashes, whitespace, the text, optional closing
# hashes. Setext headings (text underlined with === or ---) are not supported,
# and that is deliberate: MATCHING.md ends its body with a bare `---` used as a
# horizontal rule, which a setext parser reads as underlining the line above.
HEADING = re.compile(r"^(#{1,6})[ \t]+(.+?)[ \t]*#*[ \t]*$")
FENCE = re.compile(r"^[ \t]*(```|~~~)")

ARM_NAME = re.compile(r"^[a-z0-9][a-z0-9-]*$")


class AblationError(Exception):
    """A spec could not be shaped as the config asked."""


def _resolve(workspace: Path, relpath: str) -> Path:
    """A workspace-relative path, refusing anything that escapes it."""
    if not relpath or Path(relpath).is_absolute():
        raise AblationError(f"path must be workspace-relative: {relpath!r}")
    target = (workspace / relpath).resolve()
    root = workspace.resolve()
    if root != target and root not in target.parents:
        raise AblationError(f"path escapes the workspace: {relpath!r}")
    return target


def _headings(lines: list[str]) -> list[tuple[int, int, str]]:
    """Every ATX heading as (index, level, text), skipping fenced blocks.

    The policy files carry no code fences today. The guard is here because the
    failure it prevents is silent: a `# comment` inside a future SQL example
    would end a section early, and the cut would look like it worked.
    """
    out, fence = [], ""
    for i, line in enumerate(lines):
        marker = FENCE.match(line)
        if marker:
            token = marker.group(1)
            if not fence:
                fence = token
            elif line.strip().startswith(fence):
                fence = ""
            continue
        if fence:
            continue
        found = HEADING.match(line)
        if found:
            out.append((i, len(found.group(1)), found.group(2).strip()))
    return out


def _tidy(lines: list[str]) -> list[str]:
    """Close the seam a cut leaves: at most one blank line, one trailing."""
    out: list[str] = []
    for line in lines:
        if not line.strip() and out and not out[-1].strip():
            continue
        out.append(line)
    while out and not out[-1].strip():
        out.pop()
    return out


def _drop(workspace: Path, spec, receipt: dict) -> None:
    """Delete a whole file from the workspace."""
    if not isinstance(spec, str):
        raise AblationError(f"drop takes a path, got {spec!r}")
    target = _resolve(workspace, spec)
    if not target.is_file():
        raise AblationError(f"drop target is not a file in the workspace: {spec}")
    n = len(target.read_text(encoding="utf-8").splitlines())
    target.unlink()
    receipt[spec] = n


def _cut(workspace: Path, spec, receipt: dict) -> None:
    """Remove one markdown section: its heading and everything under it.

    A section runs to the next heading at the same level or shallower, so a
    subsection travels with its parent and a parent's siblings survive. The
    last section in a file runs to the end.
    """
    if not isinstance(spec, dict) or set(spec) != {"file", "heading"}:
        raise AblationError(
            f"cut takes {{file, heading}}, got {sorted(spec) if isinstance(spec, dict) else spec!r}")
    relpath, wanted = spec["file"], str(spec["heading"]).strip()
    target = _resolve(workspace, relpath)
    if not target.is_file():
        raise AblationError(f"cut target is not a file in the workspace: {relpath}")

    lines = target.read_text(encoding="utf-8").splitlines()
    headings = _headings(lines)
    matches = [h for h in headings if h[2] == wanted]
    if not matches:
        available = "\n  ".join(f"{'#' * lv} {tx}" for _i, lv, tx in headings)
        raise AblationError(
            f"{relpath} has no heading {wanted!r}. It has:\n  {available}")
    if len(matches) > 1:
        at = ", ".join(str(i + 1) for i, _lv, _tx in matches)
        raise AblationError(
            f"{relpath} has {len(matches)} headings named {wanted!r} "
            f"(lines {at}); make them distinct before cutting one")

    start, level, _text = matches[0]
    end = len(lines)
    for i, lv, _tx in headings:
        if i > start and lv <= level:
            end = i
            break

    kept = _tidy(lines[:start] + lines[end:])
    if not kept:
        raise AblationError(
            f"cutting {wanted!r} would empty {relpath}; use drop instead")
    target.write_text("\n".join(kept) + "\n", encoding="utf-8")
    receipt[relpath] = receipt.get(relpath, 0) + (end - start)


# name -> operation. A future ablation registers one entry; nothing else here
# needs to know it exists.
OPS = {"drop": _drop, "cut": _cut}


def apply_arm(workspace: Path, ops: list) -> dict[str, int]:
    """Shape an assembled workspace, returning {path: lines removed}.

    Runs after the workspace is copied, never instead of the copy, so there
    stays one assembly path and no new copy line for the golden-fixture guard
    in tests/test_run.py to police.
    """
    receipt: dict[str, int] = {}
    for op in ops or []:
        if not isinstance(op, dict) or len(op) != 1:
            raise AblationError(f"an operation is one of {sorted(OPS)}: {op!r}")
        (kind, spec), = op.items()
        if kind not in OPS:
            raise AblationError(f"unknown operation {kind!r}, expected one of {sorted(OPS)}")
        OPS[kind](workspace, spec, receipt)
    return receipt


def spec_fingerprint(workspace: Path) -> tuple[str, dict[str, str]]:
    """A digest of the spec a session actually saw, plus its per-file manifest.

    Parallel to golden_fingerprint in run.py, and there for the same reason: a
    score is only comparable to another score taken against the same inputs.
    The relative path goes into the digest as well as the content, so dropping
    a file moves the fingerprint even though no surviving file changed.

    The manifest turns "these two runs disagree" into "...because MATCHING.md
    differs" without re-running either of them.
    """
    manifest: dict[str, str] = {}
    for name in FINGERPRINTED:
        base = workspace / name
        if base.is_file():
            found = [base]
        elif base.is_dir():
            found = [p for p in base.rglob("*") if p.is_file()]
        else:
            continue
        for path in found:
            rel = path.relative_to(workspace).as_posix()
            manifest[rel] = hashlib.sha256(path.read_bytes()).hexdigest()

    digest = hashlib.sha256()
    for rel in sorted(manifest):
        digest.update(f"{rel}\n{manifest[rel]}\n".encode())
    return digest.hexdigest()[:12], dict(sorted(manifest.items()))


def load_arms(path: Path) -> dict:
    """Read and structurally validate the ablation config.

    grade.py imports yaml inside the function and falls back to an empty
    result when PyYAML is missing, because grading without questions.yaml is
    degraded but still useful. The same fallback here would be a disaster: it
    would run every arm with no operations and spend a sweep producing
    identical baselines. So this one raises.
    """
    try:
        import yaml
    except ImportError as exc:                              # pragma: no cover
        raise AblationError("the ablation config needs PyYAML") from exc
    if not path.exists():
        raise AblationError(f"no ablation config at {path}")

    spec = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    arms = spec.get("arms")
    if not isinstance(arms, dict) or not arms:
        raise AblationError(f"{path} defines no arms")

    for name, arm in arms.items():
        if not ARM_NAME.match(str(name)):
            raise AblationError(
                f"arm name {name!r} must be lowercase letters, digits and dashes")
        if not isinstance(arm, dict):
            raise AblationError(f"arm {name!r} must be a mapping")
        if not str(arm.get("why", "")).strip():
            raise AblationError(
                f"arm {name!r} needs a `why`: it is printed under the report "
                f"table, and an arm nobody can explain is one nobody should run")
        if "ops" not in arm or not isinstance(arm["ops"], list):
            raise AblationError(f"arm {name!r} needs an `ops` list (empty is fine)")

    baseline = spec.get("baseline")
    if baseline is None:
        empty = [n for n, a in arms.items() if not a["ops"]]
        if len(empty) != 1:
            raise AblationError(
                "name a `baseline` arm: the config has "
                f"{len(empty)} arms with no operations")
        baseline = empty[0]
    if baseline not in arms:
        raise AblationError(f"baseline {baseline!r} is not one of {sorted(arms)}")
    return {"baseline": baseline, "arms": arms}


def spec_sources(repo_root: Path) -> dict[str, Path]:
    """Where each fingerprinted workspace path comes from in the repo.

    run.py assembles the workspace from these; validation stages the same set
    so a dry run exercises the paths a session will.
    """
    return {"task.md": repo_root / "prompts" / "task.md",
            "policies": repo_root / "policies"}


def stage_spec(repo_root: Path, dest: Path) -> None:
    """Copy the spec into `dest` the way run.py assembles a workspace."""
    for name, src in spec_sources(repo_root).items():
        if src.is_dir():
            shutil.copytree(src, dest / name)
        else:
            shutil.copy(src, dest / name)


def validate_arms(config: dict, repo_root: Path, workdir: Path) -> dict[str, dict[str, int]]:
    """Dry-apply every arm against the real spec, returning each receipt.

    This is what makes a typo cheap. Run it before the first session and a
    heading that has been reworded since the arm was written fails in a
    second, rather than after four hours of containers have scored like the
    baseline.
    """
    receipts = {}
    for name, arm in config["arms"].items():
        staged = workdir / name
        staged.mkdir(parents=True)
        stage_spec(repo_root, staged)
        try:
            receipts[name] = apply_arm(staged, arm["ops"])
        except AblationError as exc:
            raise AblationError(f"arm {name!r}: {exc}") from exc
    return receipts
