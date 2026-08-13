"""LLM-as-judge helper.

Wraps a single Anthropic API call into a simple judge function. The notebook
falls back to a deterministic stub when ANTHROPIC_API_KEY is not set, so the
notebook still runs end-to-end without credentials.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass

JUDGE_MODEL = "claude-haiku-4-5-20251001"


@dataclass
class JudgeVerdict:
    score: float
    reasoning: str
    faithful: bool


def _stub_verdict(output: str, reference: str) -> JudgeVerdict:
    overlap = len(set(output.lower().split()) & set(reference.lower().split()))
    ref_tokens = max(1, len(set(reference.lower().split())))
    score = min(1.0, overlap / ref_tokens)
    return JudgeVerdict(
        score=round(score, 2),
        reasoning="(stub: ANTHROPIC_API_KEY not set; using token-overlap proxy)",
        faithful=score >= 0.5,
    )


def judge_faithfulness(output: str, reference: str, source: str) -> JudgeVerdict:
    """Score whether `output` is faithful to `source` against `reference`.

    Returns a JudgeVerdict with score in [0, 1] and a short reasoning string.
    """
    if not os.environ.get("ANTHROPIC_API_KEY"):
        return _stub_verdict(output, reference)

    from anthropic import Anthropic

    client = Anthropic()
    rubric = (
        "You are evaluating whether a generated summary is faithful to its "
        "source. Score 1.0 if the summary makes only claims supported by the "
        "source, 0.5 if it omits key facts but adds nothing false, 0.0 if it "
        "fabricates or misattributes any claim. Return STRICT JSON: "
        '{"score": <float 0-1>, "faithful": <bool>, "reasoning": "<one sentence>"}.'
    )
    user = (
        f"SOURCE:\n{source}\n\n"
        f"REFERENCE SUMMARY:\n{reference}\n\n"
        f"GENERATED SUMMARY:\n{output}\n\n"
        "Return JSON only."
    )

    msg = client.messages.create(
        model=JUDGE_MODEL,
        max_tokens=300,
        temperature=0.0,
        system=rubric,
        messages=[{"role": "user", "content": user}],
    )
    text = msg.content[0].text.strip()
    if text.startswith("```"):
        text = text.strip("`").lstrip("json").strip()
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        return JudgeVerdict(score=0.0, reasoning=f"judge returned non-JSON: {text[:120]}", faithful=False)

    return JudgeVerdict(
        score=float(parsed.get("score", 0.0)),
        reasoning=str(parsed.get("reasoning", "")),
        faithful=bool(parsed.get("faithful", False)),
    )
