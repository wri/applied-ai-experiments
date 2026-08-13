"""Tests for `just learning` — appending a learning to a brief.

This is the one writer contributors are told to use while an experiment is in
flight, so it has to land the bullet somewhere the readers will find it and leave
the rest of the brief untouched.
"""

import importlib.util
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = REPO_ROOT / ".github" / "scripts"
sys.path.insert(0, str(SCRIPTS))


def _load(name: str, filename: str):
    spec = importlib.util.spec_from_file_location(name, SCRIPTS / filename)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


experiment_doc = _load("experiment_doc", "experiment_doc.py")
add_learning = _load("add_learning", "add-learning.py")

append_learning = add_learning.append_learning
bump_updated_at = add_learning.bump_updated_at
extract_learnings = experiment_doc.extract_learnings

# The shape `.github/templates/_shared/brief.md` actually ships: a prompt paragraph,
# a placeholder bullet, then a `---` rule before `## After`.
TEMPLATE_BODY = """# Title

> lede

## Before

text

---

## Learnings

One bullet per takeaway. Add them as soon as they're solid.

- <a takeaway someone on another team could act on>

---

## After

_Fill this out when the experiment concludes._
"""

LEARNING = "Client-side PDF parsing handles 200-page documents in under 3 seconds."


def test_first_learning_is_extractable():
    out = append_learning(TEMPLATE_BODY, LEARNING)
    learnings, _ = extract_learnings(out)
    assert learnings == [LEARNING]


def test_first_learning_lands_above_the_section_rule():
    """Regression: it used to land *below* the `---`, reading as part of After."""
    out = append_learning(TEMPLATE_BODY, LEARNING)
    section = out.split("## Learnings", 1)[1].split("## After", 1)[0]
    assert f"- {LEARNING}" in section
    # The bullet comes before the rule that closes the section.
    assert section.index(f"- {LEARNING}") < section.rindex("---")


def test_placeholder_bullet_is_dropped():
    out = append_learning(TEMPLATE_BODY, LEARNING)
    assert "<a takeaway" not in out


def test_second_learning_appends_after_the_first():
    out = append_learning(
        append_learning(TEMPLATE_BODY, LEARNING), "A second takeaway, stated plainly."
    )
    learnings, _ = extract_learnings(out)
    assert learnings == [LEARNING, "A second takeaway, stated plainly."]


def test_after_section_is_untouched():
    out = append_learning(TEMPLATE_BODY, LEARNING)
    assert "_Fill this out when the experiment concludes._" in out
    assert out.count("## After") == 1


def test_creates_the_section_when_absent():
    body = "# Title\n\n> lede\n\n## Before\n\ntext\n\n---\n\n## After\n\nout\n"
    out = append_learning(body, LEARNING)
    learnings, _ = extract_learnings(out)
    assert learnings == [LEARNING]
    # Learnings must sit outside After, or the hub renders an Outcome panel for
    # work that hasn't concluded.
    assert out.index("## Learnings") < out.index("## After")


def test_bump_updated_at_rewrites_only_the_date():
    fm = 'title: "X"\ncreated_at: 2026-01-01\nupdated_at: 2020-01-01\n'
    out = bump_updated_at(fm)
    assert "created_at: 2026-01-01" in out
    assert "updated_at: 2020-01-01" not in out


def test_learnings_survive_a_round_trip_through_the_doc_writer():
    """The bullet must still be readable after save()/split() — the path `just learning` takes."""
    fm = 'title: "X"\nstatus: started\nupdated_at: 2020-01-01'
    out = append_learning(TEMPLATE_BODY, LEARNING)
    joined = experiment_doc.join(bump_updated_at(fm), out)
    fm2, body2 = experiment_doc.split(joined)
    assert "updated_at: 2020-01-01" not in fm2
    learnings, _ = extract_learnings(body2)
    assert learnings == [LEARNING]
