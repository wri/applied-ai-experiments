"""Model-call helper. Returns the model's text output for a given prompt.

When ANTHROPIC_API_KEY is not set, returns a deterministic stub built from
the prompt itself. This lets the notebook demonstrate the full eval flow
(scorers, aggregation, visualisation) without credentials.
"""

from __future__ import annotations

import json
import os
import re

DEFAULT_MODEL = "claude-haiku-4-5-20251001"


def _stub_summary(prompt: str) -> str:
    body = prompt.split("TEXT:", 1)[-1]
    sentences = re.split(r"(?<=[.!?])\s+", body.strip())
    return " ".join(sentences[:2]).strip() or body[:200].strip()


def _stub_extraction(prompt: str, schema: dict) -> str:
    return json.dumps({k: None for k in schema})


def _stub_classification(prompt: str, labels: list[str]) -> str:
    """Surface-sentiment stub.

    Deliberately weak: classifies on positive/negative token presence only.
    This is the failure mode the notebook is meant to surface. Cases that
    use positive-sounding language to convey criticism (sarcasm, conceded
    clauses) will be misclassified — which is exactly what a real eval
    needs to expose. Do not "fix" this stub.
    """
    body = prompt.lower()
    positive = ["impressive", "encouragingly", "merit", "strong", "step forward",
                "improve", "recommend", "ambitious"]
    negative = ["fail", "overrun", "cannot", "lacks"]
    pos_hits = sum(1 for w in positive if w in body)
    neg_hits = sum(1 for w in negative if w in body)
    if pos_hits == 0 and neg_hits == 0:
        return "neutral"
    return "supportive" if pos_hits >= neg_hits else "critical"


def call_summarise(text: str, model: str = DEFAULT_MODEL) -> str:
    prompt = (
        "Summarise the following text in one sentence. Stay strictly faithful "
        "to the source — do not add facts that are not present.\n\nTEXT:\n" + text
    )
    if not os.environ.get("ANTHROPIC_API_KEY"):
        return _stub_summary(prompt)
    return _anthropic_text(prompt, model)


def call_extract(text: str, schema: dict, model: str = DEFAULT_MODEL) -> dict:
    fields = ", ".join(schema.keys())
    prompt = (
        "Extract the following fields as JSON: " + fields + "\n"
        "Return ONLY a JSON object. Use null when a field is not present.\n\n"
        "TEXT:\n" + text
    )
    if not os.environ.get("ANTHROPIC_API_KEY"):
        raw = _stub_extraction(prompt, schema)
    else:
        raw = _anthropic_text(prompt, model)
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`").lstrip("json").strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        return {k: None for k in schema}


def call_classify(text: str, labels: list[str], model: str = DEFAULT_MODEL) -> str:
    label_list = ", ".join(labels)
    prompt = (
        f"Classify the stance of the following text as exactly one of: {label_list}. "
        "Return only the single label, no explanation.\n\nTEXT:\n" + text
    )
    if not os.environ.get("ANTHROPIC_API_KEY"):
        return _stub_classification(prompt, labels)
    raw = _anthropic_text(prompt, model).strip().lower()
    for label in labels:
        if label.lower() in raw:
            return label
    return raw


def _anthropic_text(prompt: str, model: str) -> str:
    from anthropic import Anthropic

    client = Anthropic()
    msg = client.messages.create(
        model=model,
        max_tokens=400,
        temperature=0.0,
        messages=[{"role": "user", "content": prompt}],
    )
    return msg.content[0].text
