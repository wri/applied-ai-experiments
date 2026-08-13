# Structured Output Lab

> See [brief.md](./brief.md) for context, signals, and findings.

Part of the LLM-lab demo series (see also `ask-ten-times`, `concept-map`,
`mcp-web-map`), which share `@wri-datalab/llm-lab` for run history
(IndexedDB), request inspection, JSON Schema validation, cost tracking, session telemetry,
and exports.

## Setup

### Prerequisites

- Node.js 24+, pnpm (run `pnpm install` at the repo root — this demo is part of the workspace)
- **No API key needed to look around**: with no key configured, a "Play a recorded demo"
  banner replays a real recorded extraction through the normal run path. Add an Anthropic,
  OpenAI or Gemini key via the settings menu for live calls; keys live only in your browser's
  localStorage and go straight to the provider.

### Install & Run

```bash
# from repo root
pnpm install

cd experiments/structured-output-lab/demo
pnpm dev      # http://localhost:5173
pnpm check    # svelte-check, strict
pnpm build    # static build → demo/dist/
```

## The three panels

**1. Messy input** — sample emails and notes, or paste your own. Pasted text only; no file
upload this pass.

**2. Schema design** — two modes, and the split is deliberate:

| Mode | For | Contains |
|---|---|---|
| **Template** | Anyone who doesn't write JSON Schema | Six ready shapes: risks, action items, stakeholders, budget lines, entities, claim/evidence |
| **Raw** | Anyone who does | A JSON Schema editor, free-form |

**3. Validated output** — three simultaneous views: raw JSON, the validation trace, and a
shape-aware render (object → cards, array-of-objects → table).

## Validation and repair

This is the part worth copying. Validation runs through `@wri-datalab/llm-lab`'s
`parseStructured`, and each failure renders as **one row per issue** — a keyword badge
(`required`, `type`, `enum`…) plus a plain sentence. Not a raw validator dump. Per the brief,
that presentation *is* the finding: the same information as a stack trace reads as a broken
system, while a keyword plus a sentence reads as a careful one.

**Repair output** feeds the schema, the previous output and the specific issues back to the
model. It is:

- **A button, not automatic** — pressing it is what makes the round trip legible.
- **Capped at two attempts**, with the count surfaced ("conforms after 1 repair"), so a third
  failure reads as *your schema is wrong*, not *the model is flaky*.

In practice the first extraction usually validates outright, which means repair is the least
exercised path in the demo. Treat it as insurance.

## Try these

To see it work: pick a sample input, choose the **risks** template, run. You should get
structured risks with severity and verbatim evidence, valid first time.

To see the actual point: **switch to raw mode and break the schema** — add a `required` field
the source text can't support, or narrow an `enum` — then rerun the same input. The trace names
exactly which constraint failed, and repair either satisfies it or tells you it can't. That
moment is where "the schema is the contract" becomes visible; the templates deliberately
smooth over it, which the brief records as an unresolved tension.

## What's in here

```
demo/
├── src/
│   ├── routes/
│   │   ├── +layout.svelte        # data-variant="prototype", ToastContainer, SessionTelemetry
│   │   └── +page.svelte          # Three-panel layout + JSON/CSV export
│   └── lib/
│       ├── schemas/
│       │   └── templates.ts      # The six template shapes
│       ├── prompts/
│       │   └── extract.ts        # Schema-embedding extraction system prompt
│       ├── state/
│       │   └── lab.svelte.ts     # Run → validate → repair machine; MAX_REPAIRS = 2
│       ├── components/
│       │   ├── SchemaPanel.svelte     # Template picker ⇄ raw JSON Schema editor
│       │   ├── ValidationTrace.svelte # One row per issue: keyword badge + sentence
│       │   └── RenderedView.svelte    # Object → cards, array-of-objects → table
│       ├── replay/session.json   # Real recorded session for keyless visitors
│       ├── sample-data.ts        # Sample emails and notes
│       └── slug.ts, stores.ts    # Slug from base path; @byo-keys client
└── static/
```

## References

- [JSON Schema specification](https://json-schema.org/)
