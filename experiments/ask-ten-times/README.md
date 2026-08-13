# Ask the Same Question 10 Times

> See [brief.md](./brief.md) for context, signals, and findings.

Part of the LLM-lab demo series (see also `structured-output-lab`, `concept-map`,
`mcp-web-map`), which share `@wri-datalab/llm-lab` for fan-out with
concurrency and cancellation, run history (IndexedDB), request inspection, cost forecasting,
session telemetry, and exports.

## Setup

### Prerequisites

- Node.js 24+, pnpm (run `pnpm install` at the repo root — this demo is part of the workspace)
- **No API key needed to look around**: with no key configured, a "Play a recorded demo"
  banner replays a session from `demo/src/lib/replay/session.json`. **That fixture is
  currently an illustrative example, not a recording** — it is structured exactly like a live
  export (real prompts, the real analysis schema, staggered per-call timings), but the run
  texts were written rather than sampled from a model. It is labelled as such in the banner.
  That distinction matters more here than in most demos, because the finding **is** the
  divergence between samples — so treat the keyless view as an illustration of the interface,
  not as evidence. See [Replacing the fixture with a real recording](#replacing-the-fixture-with-a-real-recording).
  Add an Anthropic, OpenAI or Gemini key via the settings menu for live runs.

### Install & Run

```bash
# from repo root
pnpm install

cd experiments/ask-ten-times/demo
pnpm dev      # http://localhost:5173
pnpm check    # svelte-check, strict
pnpm build    # static build → demo/dist/
```

## What the output looks like

This is the example session that ships in `demo/src/lib/replay/session.json` — an illustration
of the shape of the result, not evidence of a finding (see the note in Prerequisites).

**Question:** *"Should a mid-sized city prioritize planting street trees or restoring nearby
wetlands to reduce urban flooding?"* — six runs, temperature 1.0.

| Claim | Present in |
|---|---|
| Wetlands store and slowly release far more stormwater than street trees | **6/6** |
| Street trees are cheaper, faster to deploy, and distribute across the city | **6/6** |
| Land availability and permitting constrain wetland restoration | 4/6 |
| The right answer depends on catchment-scale flooding vs local street ponding | 3/6 |
| Trees add heat and air-quality co-benefits wetlands cannot deliver | 2/6 |
| **Maintenance funding, not capital cost, is the usual failure point** | **1/6** |
| **Commission a hydrology study of where water accumulates before choosing** | **1/6** |

The bottom two rows are the whole point of the layout. Both are decision-relevant — one names
where these projects actually fail, the other says diagnose before you spend — and a
single-response workflow would surface either only by luck. The consensus step sorts them into
*rare but important* rather than discarding them as noise.

Note that six runs is already plenty to see this. See the brief: **"ask ten times" oversells
the N required.**

## How to read the heatmap

- **Dense rows** = what the model always says. You'd have got these from one call; they're the
  least interesting part of the screen.
- **Sparse rows** = fragile claims. Read these first. A claim in 1 of 6 runs is either noise or
  the most valuable thing on the page, and only you can tell which.
- **The consensus panel** separates stable / disputed / rare-but-important and ends with an
  explicit confidence assessment naming what varied. That last part is load-bearing: a
  synthesis without it becomes exactly the false single answer this demo warns about.

## Try these

Any question where the answer involves judgement rather than fact will do — factual questions
converge and make a boring heatmap. Good shapes:

- Trade-off questions ("prioritize X or Y for outcome Z?") — the example above.
- "What are the risks of…" — risk lists are where rare rows cluster.
- Anything you were about to act on after asking once.

The four preset questions in the dropdown are two of each shape. Editing the question by hand
switches the dropdown to "Custom question".

Then turn on **paraphrase** to vary the wording as well as the sampling. Off by default,
deliberately: the default run varies *only* sampling, which is what isolates nondeterminism.

## Replacing the fixture with a real recording

The shipped fixture is illustrative. To replace it with a genuine run:

1. Configure a key and run the demo live on the default preset — **6 trials, temperature 1.0,
   paraphrase off** — so the recording matches the configuration documented above.
2. Open the **Run history** panel and click **Export replay** on that run. (The llm-lab README
   calls this button "Export replay session"; the button itself reads "Export replay".)
3. Move the downloaded file to `demo/src/lib/replay/session.json`.
4. Set `title` and `description` by hand — the export path never populates `description` — and
   drop the "illustrative example" wording from the description now that it is untrue.
5. Rebuild the claim table above from the new analysis output, and restore the stronger
   "real recorded run" framing in Prerequisites and in `brief.md`.

Export scrubbing (`recordToReplaySession`) strips secrets by name and redacts key-shaped
strings, but read the diff before committing regardless.

## What's in here

```
demo/
├── src/
│   ├── routes/
│   │   ├── +layout.svelte        # data-variant="prototype", ToastContainer, SessionTelemetry
│   │   └── +page.svelte          # Console: question, N, temperature, paraphrase → runs → analysis
│   └── lib/
│       ├── prompts/
│       │   ├── paraphrase.ts     # One call generating N meaning-preserving paraphrases
│       │   └── analysis.ts       # Combined claim-matrix + consensus prompt and JSON Schema
│       ├── state/
│       │   └── trials.svelte.ts  # Fan-out/fan-in machine, concurrency cap, cancellation
│       ├── components/
│       │   ├── RunCard.svelte        # One streaming run
│       │   ├── ClaimHeatmap.svelte   # Rows = claims, columns = runs
│       │   └── ConsensusPanel.svelte # Stable / disputed / rare + confidence
│       ├── replay/session.json   # Keyless-visitor session (illustrative — see above)
│       ├── sample-data.ts        # The four preset questions; [0] must match the fixture
│       └── slug.ts, stores.ts
└── static/
```
