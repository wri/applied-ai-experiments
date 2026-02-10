"""Exact match scoring function."""


def exact_match_scorer(expected: str, actual: str, case_sensitive: bool = False) -> dict:
    """
    Score based on exact string match.

    Args:
        expected: Expected output
        actual: Actual output from model
        case_sensitive: Whether comparison is case-sensitive

    Returns:
        Dictionary with score and metadata
    """
    if not case_sensitive:
        expected = expected.lower().strip()
        actual = actual.lower().strip() if actual else ""
    else:
        expected = expected.strip()
        actual = actual.strip() if actual else ""

    match = expected == actual

    return {
        "scorer": "exact_match",
        "score": 1.0 if match else 0.0,
        "match": match,
        "expected": expected,
        "actual": actual,
    }
