import type { ProviderId, Message, TokenUsage, FinishReason } from '@byo-keys/core';

/**
 * Everything that was sent to the model for a single LLM call, in a shape
 * the RequestInspector can render verbatim. Demos should never show users
 * a result without being able to show them this.
 */
export interface InspectableRequest {
  providerId: ProviderId;
  model: string;
  system?: string;
  messages: Message[];
  params: {
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    topK?: number;
  };
  /** JSON Schema the output was expected to conform to, when applicable */
  schema?: Record<string, unknown>;
  /** A short label for multi-call runs, e.g. "variant:rubric" or "repair #2" */
  label?: string;
  /** Epoch ms when the request was sent */
  sentAt: number;
}

/** One model response within a run (a run may fan out to N responses). */
export interface RunResponse {
  content: string;
  /** Validated/parsed JSON when the call expected structured output */
  parsed?: unknown;
  usage?: TokenUsage;
  latencyMs: number;
  costUsd?: number;
  finishReason?: FinishReason;
  error?: string;
}

/** A persisted experiment run (IndexedDB record). */
export interface RunRecord {
  id: string;
  /** Experiment slug, e.g. 'prompt-comparator' */
  experiment: string;
  createdAt: number;
  label?: string;
  /** Demo-owned config blob (prompts, params, schema text, ...) for restore/duplicate */
  config: Record<string, unknown>;
  /** Requests sent during the run (representative or exhaustive, demo's choice) */
  requests: InspectableRequest[];
  responses: RunResponse[];
}
