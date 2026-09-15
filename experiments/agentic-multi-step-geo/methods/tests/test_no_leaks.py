"""Golden-answer values must never appear in anything a session can read.

The session workspace receives prompts/task.md, fixtures/questions.yaml,
policies/ and the input list (harness/run.py). Golden fixtures never enter it.
That guarantee is worthless if a policy document quotes a golden value in
passing: a measured-rationale sentence like "8,453,554 rows under 8,437,940
distinct ids" hands the session q03 without a query.

This test scans every mounted file for the distinctive values in
fixtures/golden/. Explanatory prose belongs in docs/METHODS.md, which is not
mounted.
"""

from __future__ import annotations

import csv
import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
GOLDEN_DIR = REPO_ROOT / "fixtures" / "golden"

# Exactly what harness/run.py copies into the container workspace.
MOUNTED = [
    REPO_ROOT / "prompts" / "task.md",
    REPO_ROOT / "fixtures" / "questions.yaml",
    *sorted((REPO_ROOT / "policies").glob("*.md")),
]

# Values a policy document is entitled to state, because the policy *is* the
# value: thresholds, radii, tolerances, MapBiomas class codes, EPSG codes.
# A golden answer that happens to equal one of these is not evidence of a leak.
POLICY_CONSTANTS = {
    "0.667", "25", "1e-9", "5", "2", "100", "300", "10", "2.0", "1000",
    "4326", "5880", "111320", "2020", "2023", "1115", "2024",
    # MapBiomas class codes named in EUDR_CROPS.md
    "9", "15", "18", "20", "21", "35", "39", "40", "41", "46", "47", "48", "62",
}

# Integers with fewer digits than this are too common in prose to attribute to
# a fixture. Three digits is the floor because the sample list resolves to 117
# parcels and matches 793 fields, both of them answers.
MIN_DISTINCTIVE_DIGITS = 3

# Strings below this length collide with ordinary words.
MIN_DISTINCTIVE_STR = 4

# A leak is a value the session has to *compute*. Enum labels are not: the
# policy defines `intake_point`, `observed`, `assumed_pasture` and the rest, so
# a document naming one states its own vocabulary. Data-derived strings —
# municipality names, cod_imovel, facility ids — carry an uppercase letter or a
# digit; controlled-vocabulary labels are lowercase snake_case by convention.
VOCAB_LABEL = re.compile(r"^[a-z][a-z_]*$")

# Hansen era bands are fixed by the source product, so a year or a year range is
# a label the questions may state as a format example, not a computed value.
ERA_LABEL = re.compile(r"^(19|20)\d{2}(-(19|20)\d{2})?$")

# Known and accepted: the task hands over the three dataset URLs, and the field
# file's URL contains the collection id that q01 asks the catalog to recommend.
# Withholding the URLs would turn stage 1 into a different exercise — finding
# the data rather than reading its metadata — so the overlap is deliberate.
# Listed here so it stays a decision on the record rather than a silent pass.
EXEMPT_VALUES = {"trazo3-fields"}

# MapBiomas class names are controlled vocabulary too, and Title Case rather
# than snake_case. EUDR_CROPS.md's scope table is their definition, so it is
# read as the allowlist rather than duplicated here.
CROPS_DOC = REPO_ROOT / "policies" / "EUDR_CROPS.md"


def _class_names() -> set[str]:
    """Class names from the scope table in EUDR_CROPS.md."""
    names: set[str] = set()
    for line in CROPS_DOC.read_text(encoding="utf-8").splitlines():
        cells = [c.strip() for c in line.split("|")]
        # | `mbmode24` | Class | ... -- code in cell 1, class name in cell 2.
        if len(cells) > 3 and cells[1].isdigit():
            names.add(cells[2])
    return names - {""}


def _golden_cells() -> dict[str, set[str]]:
    """Every cell of every golden fixture, keyed by question id."""
    cells: dict[str, set[str]] = {}
    for path in sorted(GOLDEN_DIR.glob("*.csv")):
        with path.open(newline="", encoding="utf-8") as fh:
            rows = list(csv.reader(fh))
        if not rows:
            continue
        header, *body = rows
        values = {v.strip() for row in body for v in row if v.strip()}
        # Column names are the oracle's choice and the grader ignores them,
        # so a policy naming a column is not a leak.
        values -= {h.strip() for h in header}
        if values:
            cells[path.stem] = values
    return cells


def _needles(value: str, vocab: frozenset[str] = frozenset()) -> list[str]:
    """Regexes matching how a value could be written in prose.

    A count reads as 8453554 or 8,453,554; a float as 26.8 either way.
    """
    if value in POLICY_CONSTANTS or value in EXEMPT_VALUES or ERA_LABEL.match(value):
        return []

    try:
        number = float(value)
    except ValueError:
        # Non-numeric: municipality names, cod_imovel, entity ids.
        if (
            len(value) < MIN_DISTINCTIVE_STR
            or VOCAB_LABEL.match(value)
            or value in vocab
        ):
            return []
        return [re.escape(value)]

    if number.is_integer():
        as_int = int(number)
        if len(str(abs(as_int))) < MIN_DISTINCTIVE_DIGITS:
            return []
        forms = {str(as_int), f"{as_int:,}"}
        return [rf"(?<![\d.,]){re.escape(f)}(?![\d,])" for f in forms]

    # `(?![\deE])` so a threshold written 1.2e-11 does not match the golden 1.2.
    return [rf"(?<![\d.,]){re.escape(value)}(?![\deE])"]


def find_leaks() -> list[tuple[str, int, str, str, str]]:
    """(file, line_number, value, question_ids, line) for every golden value found.

    One entry per (file, line, value). A value shared by several fixtures is
    reported once, listing every question it gives away.
    """
    golden = _golden_cells()
    owners: dict[str, set[str]] = {}
    for qid, values in golden.items():
        for value in values:
            owners.setdefault(value, set()).add(qid)

    vocab = frozenset(_class_names())
    leaks: list[tuple[str, int, str, str, str]] = []
    for path in MOUNTED:
        rel = path.relative_to(REPO_ROOT).as_posix()
        lines = path.read_text(encoding="utf-8").splitlines()
        for value in sorted(owners):
            patterns = _needles(value, vocab)
            if not patterns:
                continue
            for lineno, line in enumerate(lines, start=1):
                if any(re.search(p, line) for p in patterns):
                    qids = ",".join(sorted(owners[value]))
                    leaks.append((rel, lineno, value, qids, line.strip()))
    return sorted(leaks)


def test_no_golden_values_in_mounted_files() -> None:
    leaks = find_leaks()
    if leaks:
        report = "\n".join(
            f"  {rel}:{lineno}: {value!r} gives away {qids} -- {line}"
            for rel, lineno, value, qids, line in leaks
        )
        raise AssertionError(
            f"{len(leaks)} golden value(s) reachable from the session workspace.\n"
            f"Move the explanation to docs/METHODS.md (not mounted):\n{report}"
        )


def test_question_ids_not_named_in_policies() -> None:
    """A policy must not tell the session what a specific question reports."""
    hits = []
    for path in sorted((REPO_ROOT / "policies").glob("*.md")):
        rel = path.relative_to(REPO_ROOT).as_posix()
        for lineno, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
            if re.search(r"\bq\d{2}\b", line):
                hits.append(f"  {rel}:{lineno}: {line.strip()}")
    assert not hits, (
        "policies name a question id; the session reads these files:\n"
        + "\n".join(hits)
    )


if __name__ == "__main__":
    for rel, lineno, value, qids, line in find_leaks():
        print(f"{rel}:{lineno}: {value!r} -> {qids} | {line}")
