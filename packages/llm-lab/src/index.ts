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
