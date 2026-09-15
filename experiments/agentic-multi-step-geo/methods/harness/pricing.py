"""List API prices used to impute dollar cost from logged token counts.

Sessions run on a subscription plan and bill nothing directly; the
benchmark reports what the same token volumes would cost at list price.
Cache tokens are priced separately: cache writes bill at 1.25x the input
rate (5-minute TTL, which is what Claude Code uses), cache reads at 0.1x.

Prices are USD per million tokens, current as of 2026-07-23.
Sonnet 5 has an introductory price ($2/$10) through 2026-08-31; we use
the list price so results stay comparable after the promo ends.
"""

from dataclasses import dataclass

CACHE_WRITE_MULTIPLIER = 1.25
CACHE_READ_MULTIPLIER = 0.10


@dataclass(frozen=True)
class ModelPrice:
    model_id: str
    input_per_mtok: float
    output_per_mtok: float

    @property
    def cache_write_per_mtok(self) -> float:
        return self.input_per_mtok * CACHE_WRITE_MULTIPLIER

    @property
    def cache_read_per_mtok(self) -> float:
        return self.input_per_mtok * CACHE_READ_MULTIPLIER


PRICES: dict[str, ModelPrice] = {
    "haiku": ModelPrice("claude-haiku-4-5", 1.00, 5.00),
    "sonnet": ModelPrice("claude-sonnet-5", 3.00, 15.00),
    "opus": ModelPrice("claude-opus-4-8", 5.00, 25.00),
}


def imputed_cost_usd(
    model: str,
    input_tokens: int,
    output_tokens: int,
    cache_creation_tokens: int = 0,
    cache_read_tokens: int = 0,
) -> float:
    """Dollar cost of a session's token counts at list prices."""
    p = PRICES[model]
    per_tok = 1e-6
    return (
        input_tokens * p.input_per_mtok
        + output_tokens * p.output_per_mtok
        + cache_creation_tokens * p.cache_write_per_mtok
        + cache_read_tokens * p.cache_read_per_mtok
    ) * per_tok
