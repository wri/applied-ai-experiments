// =============================================================================
// @wri-datalab/llm-lab — shared machinery for browser-only LLM demos
// =============================================================================
//
// Usage:
//   import { runLLM, fanOut, parseStructured, createRunHistory } from '@wri-datalab/llm-lab';
//
// =============================================================================

// Core data shapes
export type { InspectableRequest, RunResponse, RunRecord } from './types';

// Schema: extraction, validation, repair
export { extractJson, type ExtractJsonResult } from './schema/extract-json';
export {
  validateJsonSchema,
  checkSchema,
  pointerToPath,
  resolvePointer,
  type SchemaIssue,
  type ValidationResult,
} from './schema/validate';
export { buildRepairPrompt, type RepairPromptArgs } from './schema/repair-prompt';
export { parseStructured, type ParseStructuredResult } from './schema/parse-structured';

// Cost
export {
  estimateTokensFromText,
  estimateCost,
  computeCost,
  formatUsd,
  sumUsage,
  type CostEstimate,
} from './cost/cost';

// Export helpers
export { downloadBlob, downloadJson, downloadMarkdown, downloadText } from './export/download';
export { toCsv, downloadCsv } from './export/csv';
export {
  serializeSvg,
  downloadSvg,
  svgToPngBlob,
  downloadPng,
  type PngOptions,
} from './export/image';
export {
  encodeShareConfig,
  decodeShareConfig,
  stripSecrets,
} from './export/share-config';

// Run helpers
export { runLLM, type RunLLMOptions, type RunLLMResult } from './run/run-llm';
export { createLLMRun, type LLMRun } from './run/llm-run.svelte';
export { fanOut, type FanOutOptions } from './run/fan-out';

// Run history (IndexedDB)
export { createRunHistory, type RunHistory, type NewRunRecord } from './history/run-history';
export { indexedDbAvailable } from './history/db';

// Components
export { default as RequestInspector } from './inspect/RequestInspector.svelte';
export { default as HistoryPanel } from './history/HistoryPanel.svelte';

// Session replay (keyless-visitor playback of a recorded session)
export {
  activateReplay,
  deactivateReplay,
  resetReplayCursor,
  isReplayActive,
  getActiveSession,
  replayRun,
  type ReplaySession,
  type ReplayCall,
} from './replay/replay.svelte';
export {
  recordToReplaySession,
  type ReplaySessionMeta,
  type RecordToReplayResult,
} from './replay/record';
export { default as ReplayBanner } from './replay/ReplayBanner.svelte';

// Per-request mocks (keyless mode for arbitrary input, with no fixture to record)
export {
  setForceMock,
  isForceMock,
  canRunLive,
  shouldMock,
  resolveMock,
  mockRun,
  createDemoMode,
  lastUserText,
  type MockSpec,
} from './mock/mock.svelte';

// Session telemetry (the dev-view / debugger dashboard)
export { default as SessionTelemetry } from './telemetry/SessionTelemetry.svelte';
export { default as SessionTelemetryTrigger } from './telemetry/SessionTelemetryTrigger.svelte';
export { telemetryPanel } from './telemetry/telemetry-ui.svelte';
export {
  sessionTelemetry,
  createSessionTelemetry,
  registerTelemetryEnricher,
  type SessionTelemetryStore,
  type TelemetryEntry,
  type TelemetryAggregates,
  type UsageByType,
  type GroupAggregate,
  type EnergyMetrics,
  type CarbonMetrics,
  type TelemetryEnricher,
} from './telemetry/session-telemetry.svelte';
export {
  registerTelemetrySink,
  emitTelemetry,
  type TelemetryRecord,
  type TelemetrySink,
} from './telemetry/sink';
export {
  estimateEnergyCarbon,
  mergeFactors,
  cloneDefaultFactors,
  formatEnergy,
  formatCarbon,
  DEFAULT_EMISSION_FACTORS,
  GRID_PRESETS,
  type EmissionFactors,
  type TierFactors,
  type EnergyCarbonEstimate,
} from './telemetry/energy-carbon';
