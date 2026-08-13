# {Experiment Title}

> <One or two sentences: what this experiment is and what it produces. This is the catalog
> blurb — the hub card, the social preview, and the RSS entry are all generated from it.
> The *motivation* goes in "What problem…" below.>

## Before

### What problem or question does this address?

What's the situation that makes this experiment worth running? Connect it to a real need — a team bottleneck, a product gap, a capability we lack, a claim we want to test. Name the decision this result informs, and for whom.

### What does this experiment actually do?

Describe concretely what you'll build, test, or measure. Someone reading this should be able to picture the work.

### What signals are we looking for?

What would make this a clear success? A clear failure? If you have a specific hypothesis, state it here. If you're exploring, describe what a useful vs. useless outcome looks like. This is the section you'll come back to at the end.

### What are the boundaries?

Time box, scope limits, what you're deliberately not doing, dependencies or access you need, known constraints.

---

## Learnings

One bullet per takeaway. Add them **as soon as they're solid** — don't wait for close-out; these publish at any status. The hub reads this section directly, so it's the only place to write them. Shortcut: `just learning <slug> "..."`.

Each bullet must **stand alone**: the hub's Learnings page shows these grouped by theme alongside learnings from other experiments, stripped of this experiment's context. "Run the router on the cheap tier at temperature 0" works; "keeping two routes unexecutable made the claim visible" needs the experiment, so that framing belongs in "What happened?" below.

Be specific, with numbers where you have them. One bullet per learning, no sub-bullets.

- <a takeaway someone on another team could act on>

---

## After

_Fill this section out when the experiment concludes or is stopped._

_A partial close-out is fine and common: the build can be done and the learnings real
while a signal still waits on colleague testing or a queued eval. Leave what you can't
answer empty — the hub omits empty sections rather than showing a bare heading, and the
gates treat them as pending, not missing. To say what you're waiting on (better for a
reader, and it shows on the page), write a line like
`_Pending: 3-4 non-engineers testing the demo, week of Aug 11._` under the heading._

**Outcome:** <one sentence, signal-prefixed — "Confirmed: …" / "Refuted: …" / "Inconclusive (never ran the eval): …">

_The hub renders the Outcome line above as the experiment's outcome callout, and strips
it from this section, so it never appears twice on the page. Write it once, here._

### Signal check

Answer each signal from "What signals are we looking for?" explicitly: **Confirmed** / **Refuted** / **Inconclusive — because X**. "We didn't measure it" is valid, but say what it would take to measure.

### What happened?

What did you actually do? (Often different from what you planned.) This is where the narrative behind the Learnings goes — what surprised you, what confirmed expectations, and the context that makes a learning make sense.

### What would you recommend?

Should we adopt this, keep exploring, stop, share it, build on it? Be direct.

### What decisions and tradeoffs came up along the way?

Non-obvious choices you made during the work. Things you tried that didn't work. Forks in the road and which way you went and why. These are often more valuable than the main findings.
