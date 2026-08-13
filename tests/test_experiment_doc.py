"""Tests for the frontmatter splitter.

These are the safety net for the info.yaml -> brief.md frontmatter migration:
`split`/`join` are pure string functions, and every reader and writer depends on
them getting the edge cases right.
"""

import importlib.util
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[1]
_spec = importlib.util.spec_from_file_location(
    "experiment_doc", REPO_ROOT / ".github" / "scripts" / "experiment_doc.py"
)
experiment_doc = importlib.util.module_from_spec(_spec)
sys.modules["experiment_doc"] = experiment_doc
_spec.loader.exec_module(experiment_doc)

split = experiment_doc.split
join = experiment_doc.join


def test_no_frontmatter_returns_whole_text_as_body():
    text = "# Title\n\n> lede\n\n## Before\n"
    assert split(text) == (None, text)


def test_basic_split():
    fm, body = split("---\ntitle: X\n---\n\n# Title\n")
    assert fm == "title: X"
    assert body == "# Title\n"


def test_horizontal_rules_in_body_survive():
    """The real hazard: briefs use `---` to separate Before / Learnings / After."""
    text = (
        "---\ntitle: X\ntype: prototype\n---\n\n"
        "# Title\n\n> lede\n\n## Before\n\nbody\n\n---\n\n## Learnings\n\n- one\n\n---\n\n## After\n\nout\n"
    )
    fm, body = split(text)
    assert fm == "title: X\ntype: prototype"
    assert body.count("\n---\n") == 2
    assert "## Learnings" in body and "## After" in body


def test_never_uses_naive_split_on_dashes():
    """A body rule must not be mistaken for the closing delimiter."""
    fm, body = split("---\ntitle: X\n---\n\nintro\n\n---\n\ntail\n")
    assert fm == "title: X"
    assert body.startswith("intro")
    assert "tail" in body


def test_crlf_is_handled():
    fm, body = split("---\r\ntitle: X\r\n---\r\n\r\n# Title\r\n")
    assert fm == "title: X"
    assert "# Title" in body


def test_dots_terminator():
    fm, body = split("---\ntitle: X\n...\n\n# Title\n")
    assert fm == "title: X"
    assert body == "# Title\n"


def test_unterminated_block_is_all_body():
    """Better to render a broken file than to guess where metadata ends."""
    text = "---\ntitle: X\n\n# Title\n"
    assert split(text) == (None, text)


def test_dashes_not_on_first_line_are_not_frontmatter():
    text = "# Title\n\n---\n\nbody\n"
    assert split(text) == (None, text)


def test_frontmatter_with_no_body():
    fm, body = split("---\ntitle: X\n---\n")
    assert fm == "title: X"
    assert body == ""


def test_comments_survive_round_trip():
    """The comments are the authoring guide — they must never be re-serialised."""
    fm_in = "# ---- Required ----\ntitle: X\ntype: prototype   # enum comment\n"
    text = join(fm_in, "# Title\n")
    fm_out, body = split(text)
    assert fm_out == fm_in.strip("\n")
    assert "# ---- Required ----" in fm_out
    assert "# enum comment" in fm_out


@pytest.mark.parametrize(
    "fm,body",
    [
        ("title: X", "# Title\n\n---\n\n## After\n"),
        ("a: 1\nb: 2", "text\n"),
        ("title: X", ""),
    ],
)
def test_join_split_round_trip(fm, body):
    fm2, body2 = split(join(fm, body))
    assert fm2 == fm
    assert body2.strip() == body.strip()


def test_join_without_frontmatter_returns_body_only():
    assert join(None, "# Title\n") == "# Title\n"


# --- load_meta: brief.md is the only metadata source ------------------------


def _write_brief(tmp_path, text):
    exp = tmp_path / "my-experiment"
    exp.mkdir()
    (exp / "brief.md").write_text(text)
    return exp


def test_load_meta_reads_frontmatter_and_body(tmp_path):
    exp = _write_brief(tmp_path, "---\ntitle: X\nstatus: done\n---\n\n# X\n\n> lede\n")
    meta, body, error = experiment_doc.load_meta(exp)
    assert error is None
    assert meta == {"title": "X", "status": "done"}
    assert "> lede" in body


def test_load_meta_on_missing_brief_is_empty_not_an_error(tmp_path):
    """Callers distinguish 'no experiment here' from 'this brief is broken'."""
    exp = tmp_path / "nothing"
    exp.mkdir()
    assert experiment_doc.load_meta(exp) == ({}, "", None)


def test_load_meta_reports_unparseable_frontmatter(tmp_path):
    exp = _write_brief(tmp_path, "---\ntitle: [unclosed\n---\n\n# X\n")
    meta, _, error = experiment_doc.load_meta(exp)
    assert meta == {}
    assert error


def test_load_meta_ignores_a_stray_info_yaml(tmp_path):
    """There is exactly one metadata source. A leftover info.yaml must not win."""
    exp = _write_brief(tmp_path, "---\ntitle: FromBrief\n---\n\n# X\n")
    (exp / "info.yaml").write_text("title: FromInfoYaml\n")
    meta, _, _ = experiment_doc.load_meta(exp)
    assert meta["title"] == "FromBrief"


def test_load_meta_without_frontmatter_still_returns_the_body(tmp_path):
    exp = _write_brief(tmp_path, "# X\n\n> lede\n")
    meta, body, error = experiment_doc.load_meta(exp)
    assert meta == {}
    assert error is None
    assert "> lede" in body


# --- Partial close-outs: pending vs. never-written ---------------------------
# The common real shape: build finished, learnings published, one or two signals
# still waiting on colleague feedback. That has to read as pending, not as missing.

PARTIAL_AFTER = """# T

> lede

## Before

### What signals are we looking for?

Success: a novice can do the thing.

---

## Learnings

- A takeaway that stands on its own, with a number in it.

---

## After


### Signal check


### What happened?

Built the demo. Two schema modes, and the split mattered more than expected.

### What would you recommend?

_Pending: waiting on 3-4 non-engineers to test it, week of Aug 11._

### What decisions and tradeoffs came up along the way?

"""


def test_unfilled_subsections_are_found_with_and_without_reasons():
    unfilled = dict(experiment_doc.unfilled_after_subsections(PARTIAL_AFTER))
    assert unfilled["Signal check"] is None
    assert "3-4 non-engineers" in unfilled["What would you recommend?"]
    assert unfilled["What decisions and tradeoffs came up along the way?"] is None
    # The written one is not listed.
    assert "What happened?" not in unfilled


def test_a_written_subsection_is_never_treated_as_pending():
    filled = [h for h, _ in experiment_doc.after_subsections(PARTIAL_AFTER)]
    assert "What happened?" in filled
    assert experiment_doc.after_is_underway(PARTIAL_AFTER) is True


def test_an_untouched_after_section_is_not_underway():
    """A close-out nobody started must still be reported as missing."""
    body = PARTIAL_AFTER.replace(
        "Built the demo. Two schema modes, and the split mattered more than expected.", ""
    )
    assert experiment_doc.after_is_underway(body) is False


def test_no_after_section_at_all_is_not_underway():
    assert experiment_doc.after_is_underway("# T\n\n## Before\n\ntext\n") is False


def test_pending_reason_parsing():
    assert experiment_doc.pending_reason("_Pending: colleague testing_") == "colleague testing"
    assert experiment_doc.pending_reason("_pending: mixed Case_") == "mixed Case"
    assert experiment_doc.pending_reason("_Pending_") is None
    assert experiment_doc.pending_reason("real prose about pending things") is None
