"""LLM-as-judge scoring function."""


def llm_judge_scorer(
    expected: str,
    actual: str,
    criteria: str = "accuracy",
    model: str = "claude-3-5-sonnet-20241022",
) -> dict:
    """
    Score using an LLM as a judge.

    Args:
        expected: Expected output (or reference answer)
        actual: Actual output from model being evaluated
        criteria: Evaluation criteria (e.g., "accuracy", "relevance", "completeness")
        model: Model to use as judge

    Returns:
        Dictionary with score and reasoning
    """
    # TODO: Implement actual LLM judge call
    # Example implementation:
    #
    # from anthropic import Anthropic
    # client = Anthropic()
    #
    # prompt = f"""
    # Evaluate the following response based on {criteria}.
    #
    # Expected/Reference:
    # {expected}
    #
    # Actual Response:
    # {actual}
    #
    # Score from 0.0 to 1.0 and explain your reasoning.
    # """
    #
    # response = client.messages.create(
    #     model=model,
    #     max_tokens=500,
    #     messages=[{"role": "user", "content": prompt}]
    # )

    return {
        "scorer": "llm_judge",
        "score": None,  # TODO: Parse from LLM response
        "reasoning": None,  # TODO: Extract reasoning
        "criteria": criteria,
        "judge_model": model,
    }
