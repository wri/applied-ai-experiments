"""
LLM Query Utilities with LiteLLM and Langfuse Integration

Required Environment Variables:
    Langfuse:
        LANGFUSE_PUBLIC_KEY    - Your Langfuse public key
        LANGFUSE_SECRET_KEY    - Your Langfuse secret key
        LANGFUSE_HOST          - Langfuse host URL (defaults to https://cloud.langfuse.com)

    LLM Providers (set only those you'll use):
        OPENROUTER_API_KEY     - For OpenRouter models
        OPENAI_API_KEY         - For direct OpenAI models
        ANTHROPIC_API_KEY      - For direct Anthropic models
"""

import time
import asyncio
from dataclasses import dataclass
from typing import TypedDict, Optional, Dict

import litellm
from langfuse.decorators import observe

# ============================================================================
# LANGFUSE SETUP
# ============================================================================

litellm.success_callback = ["langfuse"]
litellm.failure_callback = ["langfuse"]
litellm.suppress_debug_info = True

# ============================================================================
# TYPE DEFINITIONS
# ============================================================================


class LMModelUsage(TypedDict):
    """Token usage information from LLM response."""

    prompt_tokens: int
    completion_tokens: int
    total_tokens: int


class LMQueryResult(TypedDict):
    """Result from querying an LLM model."""

    success: bool
    model: str
    latency_s: float

    # Success-only fields
    text: Optional[str]
    usage: Optional[LMModelUsage]
    cost: Optional[float]
    finish_reason: Optional[str]
    response_ms: Optional[float]
    metadata: Optional[dict]

    # Error-only fields
    error: Optional[str]
    error_type: Optional[str]


# ============================================================================
# MODEL DEFINITION
# ============================================================================


@dataclass(frozen=True)
class LMModel:
    """
    Language model configuration for LiteLLM.

    Attributes:
        name: Human-friendly display name (e.g., "GPT-4o")
        model: Full LiteLLM model string (e.g., "openrouter/openai/gpt-4o")
        tags: Optional tuple of tags for categorization (e.g., ("frontier", "expensive"))
    """

    name: str
    model: str
    tags: tuple = ()


# ============================================================================
# QUERY FUNCTION
# ============================================================================


@observe(name="llm.query", as_type="generation")
async def query_model(
    model: LMModel,
    prompt: str,
    temperature: float = 0.2,
    timeout: float = 180.0,
    **kwargs,
) -> LMQueryResult:
    """
    Query an LLM model asynchronously with comprehensive metadata tracking.

    This function uses LiteLLM to support multiple providers (OpenRouter, OpenAI,
    Anthropic, etc.) and automatically logs all requests to Langfuse for observability.

    Args:
        model: LMModel instance specifying which model to query
        prompt: User prompt/query string
        temperature: Sampling temperature (0.0 = deterministic, 2.0 = very random)
        timeout: Maximum time to wait for response in seconds (default: 180)
        **kwargs: Additional arguments passed to litellm.acompletion()
                 Common options: max_tokens, top_p, frequency_penalty,
                 metadata (dict for custom Langfuse metadata)

    Returns:
        LMQueryResult dict with either:
          - success=True: text, usage, cost, latency_s, finish_reason, etc.
          - success=False: error, error_type, latency_s

    Examples:
        >>> model = LMModel("GPT-4o", "openrouter/openai/gpt-4o")
        >>> result = await query_model(model, "Hello!", temperature=0.5)
        >>> if result["success"]:
        ...     print(result["text"])
        ...     print(f"Used {result['usage']['total_tokens']} tokens")

        >>> # With custom Langfuse metadata
        >>> result = await query_model(
        ...     model,
        ...     "Explain AI",
        ...     metadata={"trace_user_id": "user-123", "session_id": "session-1"}
        ... )
    """
    t0 = time.perf_counter()

    try:
        # Prepare metadata for Langfuse
        base_metadata = {
            "tags": ["compare-suite"] + list(model.tags),
            "model_slug": model.model,
            "model_name": model.name,
        }
        user_metadata = kwargs.pop("metadata", {})
        merged_metadata = {**base_metadata, **user_metadata}

        # Prepare messages in OpenAI format
        messages = [{"role": "user", "content": prompt}]

        # Call LiteLLM with timeout
        response = await asyncio.wait_for(
            litellm.acompletion(
                model=model.model,
                messages=messages,
                temperature=temperature,
                metadata=merged_metadata,
                **kwargs,
            ),
            timeout=timeout,
        )

        # Calculate latency
        latency = time.perf_counter() - t0

        # Extract response data
        choice = response.choices[0]
        text = choice.message.content
        finish_reason = choice.finish_reason

        # Extract usage (token counts)
        usage: LMModelUsage = {
            "prompt_tokens": response.usage.prompt_tokens,
            "completion_tokens": response.usage.completion_tokens,
            "total_tokens": response.usage.total_tokens,
        }

        # Extract cost (may be None if not available)
        cost = None
        if hasattr(response, "_hidden_params"):
            cost = response._hidden_params.get("response_cost")

        # Extract response_ms if available
        response_ms = getattr(response, "response_ms", None)

        # Return success result
        return LMQueryResult(
            success=True,
            text=text,
            latency_s=latency,
            model=model.model,
            usage=usage,
            cost=cost,
            finish_reason=finish_reason,
            response_ms=response_ms,
            metadata=merged_metadata,
            error=None,
            error_type=None,
        )

    except asyncio.TimeoutError:
        latency = time.perf_counter() - t0
        return LMQueryResult(
            success=False,
            error=f"Request timed out after {timeout}s",
            error_type="TimeoutError",
            model=model.model,
            latency_s=latency,
            text=None,
            usage=None,
            cost=None,
            finish_reason=None,
            response_ms=None,
            metadata=None,
        )

    except Exception as e:
        latency = time.perf_counter() - t0
        return LMQueryResult(
            success=False,
            error=str(e),
            error_type=type(e).__name__,
            model=model.model,
            latency_s=latency,
            text=None,
            usage=None,
            cost=None,
            finish_reason=None,
            response_ms=None,
            metadata=None,
        )


# ============================================================================
# MODEL REGISTRY
# ============================================================================
#
# This registry will contain pre-configured LMModel instances for common models.
# Structure:
#   MODEL_REGISTRY = {
#       "model-key": LMModel(name="...", model="...", tags=(...)),
#       ...
#   }
#
# Provider priorities:
#   1. OpenRouter (preferred for variety and unified billing)
#   2. OpenAI (for GPT models)
#   3. Anthropic (for Claude models)
#
# Planned categories:
#   - Frontier models: Latest, most capable (GPT-4o, Claude Sonnet 4.5, etc.)
#   - Cheap models: Cost-effective options
#   - Small models: Fast, lightweight
#   - Reasoning models: Specialized for complex reasoning
#   - Coding models: Optimized for code generation
#
# TODO: Populate with actual models after confirming provider access
# ============================================================================

MODEL_REGISTRY: Dict[str, LMModel] = {
    # OpenAI - Large Proprietary
    "gpt-5.2": LMModel(
        name="GPT-5.2", model="openai/gpt-5.2", tags=("large", "proprietary")
    ),
    # OpenRouter - Medium Open Source (Apache 2.0)
    "qwen3-32b": LMModel(
        name="Qwen3 32B",
        model="openrouter/qwen/qwen3-32b",
        tags=("medium", "apache-2.0"),
    ),
    # OpenRouter - Large Proprietary
    "gemini-2-flash": LMModel(
        name="Gemini 2.0 Flash",
        model="openrouter/google/gemini-2.0-flash-001",
        tags=("large", "proprietary", "fast", "multimodal"),
    ),
    # OpenRouter - Large Proprietary (Mistral Research License)
    "mistral-large": LMModel(
        name="Mistral Large 2512",
        model="openrouter/mistralai/mistral-large-2512",
        tags=("large", "proprietary", "reasoning"),
    ),
    # OpenRouter - Tiny Open Source (Apache 2.0) - Free Tier
    "qwen3-4b-free": LMModel(
        name="Qwen3 4B Free",
        model="openrouter/qwen/qwen3-4b:free",
        tags=("tiny", "apache-2.0", "free", "fast"),
    ),
}


def get_models_ordered_by_size() -> Dict[str, str]:
    """
    Get models ordered by size (tiny -> small -> medium -> large),
    with alphabetical sorting as tiebreaker.

    Returns:
        Dict mapping registry keys to display names, sorted by size then alphabetically
    """
    # Define size order
    size_order = {"tiny": 0, "small": 1, "medium": 2, "large": 3}

    # Create list of (key, model) tuples
    items = list(MODEL_REGISTRY.items())

    # Sort by: 1) size (tiny first), 2) name (alphabetically)
    def sort_key(item):
        key, model = item
        # Extract size tag (default to 'large' if not found)
        size = next((tag for tag in model.tags if tag in size_order), "large")
        return (size_order.get(size, 999), model.name.lower())

    items.sort(key=sort_key)

    # Return as ordered dict: {key: display_name}
    return {key: model.name for key, model in items}


# ============================================================================
# FUTURE: STREAMING SUPPORT
# ============================================================================
#
# To add streaming support in the future, implement:
#
# @observe(name="llm.query.stream", as_type="generation")
# async def query_model_stream(
#     model: LMModel,
#     prompt: str,
#     temperature: float = 0.2,
#     timeout: float = 180.0,
#     **kwargs
# ) -> AsyncIterator[str]:
#     """
#     Stream LLM responses token-by-token.
#
#     Yields text chunks as they arrive. Use in marimo with:
#         async for chunk in query_model_stream(model, prompt):
#             output.append(chunk)
#     """
#     # Implementation would use litellm.acompletion(stream=True)
#     # and yield chunks from response iterator
#     pass
#
# ============================================================================
