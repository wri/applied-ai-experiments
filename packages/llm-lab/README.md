# @wri-datalab/llm-lab

Shared machinery for browser-only LLM demo experiments (BYOK pattern). Everything runs client-side; nothing touches a server.

## What's inside

| Module | Use |
|---|---|
| `runLLM` / `createLLMRun` / `fanOut` | Streaming call wrapper (content, usage, latency, inspectable request) + concurrency-limited fan-out with cooperative abort |
| `parseStructured` / `validateJsonSchema` / `buildRepairPrompt` | Extract JSON from LLM text, validate against user-editable JSON Schema (`@cfworker/json-schema` — light, no eval), human-readable error traces, repair-loop prompt builder |
| `createRunHistory` / `HistoryPanel` | IndexedDB-backed local run history (one shared `wri-llm-lab` DB, scoped per experiment slug) |
| `RequestInspector` | Panel/modal showing the exact messages, params, schema, and raw responses for any call |
| `estimateCost` / `computeCost` / `sumUsage` | Pre-run forecasts (chars/4 heuristic) and actuals from provider usage metadata |
| `SessionTelemetry` / `SessionTelemetryTrigger` / `sessionTelemetry` / `telemetryPanel` | Dev-view dashboard (header-button or floating-FAB trigger) + per-tab store recording every `runLLM` call (tokens by type, params, latency, cost, energy/carbon, errors). See [Session telemetry](#session-telemetry-dev-view-dashboard) |
| `ReplayBanner` / `recordToReplaySession` / `activateReplay` | Play a recorded session back through the normal run path for keyless visitors (no API key → watch a real run). See [Session replay](#session-replay-keyless-fallback) |
| `MockSpec` on `runLLM` / `setForceMock` / `canRunLive` | Per-request mocks: keyless mode for demos that must handle arbitrary input, with no fixture to record. See [Per-request mocks](#per-request-mocks-keyless-fallback) |
| `./models` (`getModel`, `modelsForDemo`, `MODELS`, …) | Central model registry — ids, pricing, tiers, capabilities, per-demo model sets. See [Model registry](#model-registry-models) |
| `downloadJson/Csv/Markdown`, `downloadSvg/Png`, `encodeShareConfig` | Export layer; share-config strips anything credential-shaped |

## Session telemetry (dev-view dashboard)

A floating "dev view" that surfaces top-level metrics for **every LLM call made in a
session** — token counts by type, the model parameters used, latency, cost, finish
reason, and errors. Built for the demos' transparency goal; includes per-call
**energy & carbon estimates** (see below).

It works automatically: `runLLM` is the single choke point for all calls (`createLLMRun`
and `fanOut` route through it), so one tap there captures everything. A demo opts in by
mounting the widget **once** in its root layout:

```svelte
<!-- src/routes/+layout.svelte, inside <div data-variant="prototype"> -->
<script>
  import { SessionTelemetry } from '@wri-datalab/llm-lab';
</script>

<SessionTelemetry slug="my-experiment" />   <!-- slug namespaces sessionStorage -->
```

That's the whole integration — no per-call wiring. The widget shows a count + running
cost; clicking it opens the dashboard (per-call rows expand to the `RequestInspector`).
Mounting it activates the tap; demos that don't mount it incur zero overhead.

**Header trigger (the demo standard):** instead of the floating FAB, put the dashboard
in the demo header — mount `<SessionTelemetry slug={SLUG} trigger="none" />` in the
layout and `<SessionTelemetryTrigger />` last in the page's `headerActions` snippet
(it's a `HeaderButton` with a live call-count chip). The modal's open state is the
exported `telemetryPanel` singleton (`show()`/`hide()`/`toggle()`), so it can also be
opened programmatically (e.g. from a command palette).

- **Programmatic access**: `sessionTelemetry` (a singleton store) exposes `entries`,
  `aggregates` (tokens by type, total cost, by-model/provider, latency), `clear()`,
  `setPaused()`, `exportJson()`.
- **Opt a call out**: pass `telemetry: false` to `runLLM` (e.g. internal/preflight calls).
- **Persistence**: per-tab via `sessionStorage`, keyed by `slug` (all demos share one
  origin on Pages, so the slug is required), trimmed + capped.
- **Cost caveat**: priced from the model registry on input+output tokens only, so totals
  are an estimate (shown with a "≥" when any model lacks pricing).

### Energy & carbon estimates

The dashboard estimates the electricity each call drew (Wh) and the emissions that implies
(gCO2e) from the token usage it already records, totals them across the session, and shows
a per-call figure. **On by default** (`<SessionTelemetry estimateEnergy />`) — pass
`estimateEnergy={false}` (or toggle it in the panel) to turn it off.

**Interactive assumptions.** Energy/carbon are computed *live* from the call's measured
tokens and a reactive set of assumptions — nothing is baked in at ingest. The dashboard has
a dense **Assumptions** panel (⚙) where you can change any factor and watch every figure
recompute instantly: grid intensity (with region presets — Global / US / EU / France /
Coal-heavy), PUE, the cache-read and cache-write multipliers, and per-tier Wh/1k-tokens for
prefill vs decode. Edited assumptions persist per session.

These are transparent, order-of-magnitude *estimates*, not measurements — we can't see the
serving hardware or grid mix. The model (`telemetry/energy-carbon.ts`):

- Decode (output + thinking) tokens dominate — each is one autoregressive pass; prefill
  (input) tokens are processed in parallel and cost a fraction per token.
- Per-token energy scales with the registry `tier` (`budget` < `mid` < `frontier`).
- **Cache reads** reuse a stored KV cache → billed at `cacheReadFactor` (0.1×). **Cache
  writes** still prefill + store the tokens → `cacheWriteFactor` (1.25×).
- Data-center overhead (PUE) is folded in; emissions = energy × grid carbon intensity.

Grid intensity is by far the biggest lever (France ~45 vs coal-heavy ~820 gCO2e/kWh).
Programmatic access:

```ts
import {
  estimateEnergyCarbon, sessionTelemetry, DEFAULT_EMISSION_FACTORS, GRID_PRESETS,
} from '@wri-datalab/llm-lab';

estimateEnergyCarbon(usage, 'claude-opus-4-8');          // → { wattHours, gramsCO2e } | null
sessionTelemetry.setFactors({ gridIntensityGramsPerKwh: 45 }); // updates the live view + totals
sessionTelemetry.aggregates.totalGramsCO2e;              // session total under current factors
```

`DEFAULT_EMISSION_FACTORS` documents every constant; `formatEnergy`/`formatCarbon` render
the values.

## Session replay (keyless fallback)

A visitor with **no API key** can't make live calls. Session replay lets them watch a
**real session that was recorded earlier** instead: the demo runs its normal flow, but
every `runLLM` call resolves from a committed recording rather than the network.

It reuses the same choke point as telemetry. When a `ReplaySession` is active, `runLLM`
streams the recorded response (matched by the call's `label`) through `onDelta` with
simulated typing, preserving the recorded usage/latency so cost and the telemetry
dashboard stay faithful. Because the replayed content is byte-identical to what was
recorded, any content-dependent branching (parse → repair, validation, analysis)
re-derives the **same** sequence of calls — so no per-demo state injection is needed.

**Wiring a demo** (three small pieces):

```svelte
<script>
  import { ReplayBanner, type ReplaySession } from '@wri-datalab/llm-lab';
  import sessionData from '$lib/replay/session.json';
  const session = sessionData as unknown as ReplaySession;
</script>

<!-- top of the page content -->
<ReplayBanner
  {stores}
  {session}
  onPlay={() => state.run(session.calls[0].request.providerId, session.calls[0].request.model)}
  restoreConfig={(c) => state.restoreConfig(c)} />
```

1. Commit a fixture at `src/lib/replay/session.json` (see authoring below).
2. Add a `restoreConfig(config)` method to the demo's state machine that sets its inputs
   from the saved config blob (the same shape `history.save({ config })` already records).
3. Render `<ReplayBanner>` near the top. It shows a prominent **"▶ Play a recorded demo"**
   banner when no provider can make a live call (a key-required provider needs a valid key;
   a keyless provider like Ollama counts only if models were actually discovered), and a
   subtle **"Demo replay"** toggle otherwise. `onPlay` runs the demo's normal handler using
   the **recorded** provider/model.

**Authoring a fixture** (record → export → commit):

1. With a working key, run the demo live so it saves to run history.
2. Open the **Run history** panel and click **"Export replay session"** on the run. This
   calls `recordToReplaySession(record)` and downloads a `ReplaySession` JSON.
3. **Secrets are scrubbed on export** (fixtures are committed to a public repo): credential-
   named properties are dropped (`stripSecrets`) and key-shaped values (`sk-ant-…`, `AIza…`,
   `hf_…`, …) in prompts/errors/config are redacted. If anything is redacted the export
   toasts a warning. **Review the JSON before committing** — human review is the backstop.
4. Drop the file at `src/lib/replay/session.json` and commit.

Programmatic API: `activateReplay(session)` / `deactivateReplay()` / `isReplayActive()` /
`resetReplayCursor()` / `getActiveSession()`, plus `recordToReplaySession(record, meta)` →
`{ session, redactions }`. `ReplayBanner` exhausts its session's `calls` per run; matching
is by `label` (stable across `fanOut` concurrency), falling back to recorded order for
unlabeled calls.

## Per-request mocks (keyless fallback)

The second keyless mechanism. Replay plays back one *recorded* journey; a mock resolves
**each call** from a spec supplied at the call site, so it handles input you can't predict.
Pick by asking whether the demo must respond to arbitrary interactive input:

| | Replay | Mock |
|---|---|---|
| Covers | The one journey that was recorded | Any input the specs match |
| Fidelity | Real recorded usage / latency / cost | Synthetic content, **no usage → no cost** |
| Setup | Record a session with a real key, commit the fixture | Write specs; no key, nothing to record |
| Re-record when | Prompts or schemas change | — (specs live next to the code) |

Attach a spec to any call and it becomes the keyless behaviour for that call:

```ts
import { runLLM, type MockSpec } from '@wri-datalab/llm-lab';

const routerMock: MockSpec = {
  kind: 'match',                       // pick by pattern against the last user text
  cases: [{ pattern: /count the words/i, text: '```json\n{"route":"no_llm"}\n```' }],
  fallback: '```json\n{"route":"strong_model"}\n```',
};

await runLLM(stores, { providerId, model, messages, label: 'router', mock: routerMock });
```

Spec kinds: `{kind:'text'}`, `{kind:'json', value}` (serialised **fenced**, like a real
model's reply), `{kind:'match', cases, fallback}`, and `{kind:'fn', run}` for computed
fixtures (repair turns, composed templates).

**Precedence in `runLLM`:** an active replay session wins (real data beats synthetic), then
a mock spec, then the live network path. A mock is used when `opts.mock` is present **and**
either force-mock is on or `canRunLive(stores, providerId)` is false — the same "can this
visitor make a live call?" test `ReplayBanner` applies, so the two mechanisms agree.

Two properties make this honest, and a demo must not undo either:

1. **A mock resolves to a string that travels the demo's normal path.** Fenced JSON goes
   through the same `parseStructured` → validate → repair the live path uses, so a fixture
   that would fail the schema fails in mock too. Fixtures can't silently drift from the
   contract they claim to demonstrate.
2. **Mock results carry no `usage`.** Cost helpers return `null` for unknown usage, so the
   telemetry dashboard and any cost column read as no spend rather than a plausible
   invented figure. `RunLLMResult.mocked` is set so the UI can label the run — per
   `docs/responsible-ai.md`, synthetic output must be visibly labelled as such.

`setForceMock(true)` / `isForceMock()` force mock mode even with a key — useful for
demoing live (deterministic and free) and for showing a key-holder what keyless visitors
see. Also exported: `resolveMock`, `mockRun`, `lastUserText`, `shouldMock`.

For a worked example, see `experiments/model-router-lab/demo/src/lib/mocks.ts`: one
`match` spec routes each of its four sample tasks to a different route, and one fixture
deliberately suggests a route the demo won't execute, so keyless visitors still see the
code overrule the model.

## Model registry (`./models`)

`@wri-datalab/llm-lab/models` is the **single source of truth for model ids, pricing,
tiers, and capabilities**, plus which models each demo offers.

```ts
import { getModel, modelsForDemo, modelSelectorConfigForDemo } from '@wri-datalab/llm-lab/models';

getModel('claude-opus-4-8');                  // RegistryModel (follows `replacedBy` for renamed ids)
modelSelectorConfigForDemo('prompt-comparator'); // static config for <ModelSelector config={…}>
```

- **`registry.ts`** — the catalog (`MODELS`). Each entry has pricing
  (`inputPricePerMillion`/`outputPricePerMillion`, reconciled as of `PRICING_AS_OF`), a
  `tier` (`budget` | `mid` | `frontier`), `capabilities`, and an optional `replacedBy`
  for deprecations. Update Anthropic ids/pricing from the `claude-api` skill.
- **`demos.ts`** — per-demo model sets (`DEMO_MODEL_SETS`): declarative filters
  (`providers`/`tiers`/`capabilities`/`include`/`exclude`, `dynamicProviders` for live
  discovery like OpenRouter/Hugging Face) keyed by experiment slug.
- **`index.ts`** — helpers: `allModels`, `modelsByProvider`, `getModel`, `tierModel`,
  `modelsForDemo`, `modelSelectorConfigForDemo`, `defaultModelForDemo`.

The telemetry dashboard reads this registry to price calls; the BYOK `<ModelSelector>`
reads it (via `modelSelectorConfigForDemo`) to know which models to offer.

## Notes

- **Cancellation is cooperative**: byo-keys streams don't accept an AbortSignal, so abort stops consuming the stream (which closes the reader). Good enough for demos.
- `createLLMRun` lives in a `.svelte.ts` file (runes); everything else is framework-free TypeScript.
- Raw-src package like `@wri-datalab/ui` — consumers compile it via vite-plugin-svelte.

```sh
pnpm --filter @wri-datalab/llm-lab test
pnpm --filter @wri-datalab/llm-lab check
```
