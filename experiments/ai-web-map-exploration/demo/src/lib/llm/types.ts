/**
 * LLM layer types. Shaped after the monorepo's @byo-keys/* conventions so the
 * hand-rolled Anthropic client can be swapped for those packages at migration.
 *
 * The load-bearing design decision: every request carries a REQUIRED `mock`
 * spec. Demos never know whether they are talking to Anthropic or the mock —
 * keyless visitors get the full experience, and a key upgrades it in place.
 */

import type { Message as ByoMessage } from '@byo-keys/core';

export type ModelId = 'claude-opus-4-8' | 'claude-sonnet-4-6' | 'claude-haiku-4-5-20251001';

export interface ModelInfo {
	id: ModelId;
	label: string;
	tier: 'frontier' | 'mid' | 'budget';
	vision: boolean;
}

export const MODELS: ModelInfo[] = [
	{ id: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5', tier: 'budget', vision: true },
	{ id: 'claude-sonnet-4-6', label: 'Sonnet 4.6', tier: 'mid', vision: true },
	{ id: 'claude-opus-4-8', label: 'Opus 4.8', tier: 'frontier', vision: true }
];

export const DEFAULT_MODEL: ModelId = 'claude-haiku-4-5-20251001';

export function modelLabel(id: ModelId): string {
	return MODELS.find((m) => m.id === id)?.label ?? id;
}

export type ContentPart =
	| { type: 'text'; text: string }
	| { type: 'image'; mediaType: string; base64: string };

export interface LlmMessage {
	role: 'user' | 'assistant';
	content: string | ContentPart[];
}

/**
 * Deterministic keyless behavior, per request. `match` picks a canned response
 * by pattern against the last user text; `fn` computes one (e.g. template
 * composers, repair-turn fixtures).
 */
export type MockSpec =
	| { kind: 'text'; text: string }
	| { kind: 'match'; cases: { pattern: RegExp; text: string }[]; fallback: string }
	| { kind: 'json'; value: unknown }
	| { kind: 'fn'; run: (req: LlmRequest) => string | Promise<string> };

export interface LlmRequest {
	system?: string;
	messages: LlmMessage[];
	model?: ModelId;
	maxTokens?: number;
	temperature?: number;
	mock: MockSpec;
}

export type StreamEvent =
	| { type: 'delta'; text: string }
	| { type: 'done'; usage?: { inputTokens: number; outputTokens: number } }
	| { type: 'error'; message: string };

export interface LlmClient {
	id: 'anthropic' | 'mock';
	stream(req: LlmRequest, signal?: AbortSignal): AsyncGenerator<StreamEvent>;
	complete(req: LlmRequest, signal?: AbortSignal): Promise<string>;
}

export class LlmError extends Error {
	constructor(
		message: string,
		public status?: number,
		public kind: 'auth' | 'rate_limit' | 'overloaded' | 'network' | 'other' = 'other'
	) {
		super(message);
		this.name = 'LlmError';
	}
}

/** Extract the last user text from a request (mock matching, logging). */
export function lastUserText(req: LlmRequest): string {
	for (let i = req.messages.length - 1; i >= 0; i--) {
		const m = req.messages[i];
		if (m.role !== 'user') continue;
		if (typeof m.content === 'string') return m.content;
		const text = m.content.filter((p) => p.type === 'text');
		if (text.length) return text.map((p) => (p as { text: string }).text).join('\n');
	}
	return '';
}

/**
 * A JSON Schema object. Aliased locally (was `@cfworker/json-schema`'s `Schema`)
 * so demo schema files depend on this adapter, not the validation library — the
 * live validation now runs through `@wri-datalab/llm-lab`'s `validateJsonSchema`.
 */
export type Schema = Record<string, unknown>;

/**
 * Map the app's `LlmMessage[]` onto `@byo-keys/core` `Message[]` — the shape
 * `runLLM`/`chatStream` and the request inspector expect. Image parts become
 * base64 image blocks; text passes through.
 */
export function toByoMessages(messages: LlmMessage[]): ByoMessage[] {
	return messages.map((m) => ({
		role: m.role,
		content:
			typeof m.content === 'string'
				? m.content
				: m.content.map((part) =>
						part.type === 'text'
							? { type: 'text', text: part.text }
							: {
									type: 'image',
									source: { type: 'base64', mediaType: part.mediaType, data: part.base64 },
								}
					)
	}));
}
