/**
 * Provider resolution: mock vs live, transparent to demos. The header badge
 * always reflects `mode`, and "force mock" makes live-demoing deterministic
 * (and free) even with a key saved.
 *
 * Refactored onto the shared packages: key presence comes from the @byo-keys
 * stores, live calls run through @wri-datalab/llm-lab's `runLLM` (which taps the
 * session-telemetry dashboard automatically). The keyless mock path is retained
 * as-is; mock calls are emitted to the same telemetry sink so a keyless session
 * still lists every call — with no cost, since nothing hit the network.
 */

import { browser } from '$app/environment';
import { emitTelemetry, type InspectableRequest } from '@wri-datalab/llm-lab';
import { storageGet, storageSet } from '$lib/state/storage';
import { stores } from '$lib/stores';
import { createLiveClient } from './anthropic';
import { mockClient } from './mock';
import { structured, StructuredOutputError, type StructuredResult } from './structured';
import {
	DEFAULT_MODEL,
	MODELS,
	toByoMessages,
	type LlmClient,
	type LlmRequest,
	type ModelId,
	type Schema,
	type StreamEvent
} from './types';

const live = createLiveClient(stores);

class LlmProvider {
	forceMock = $state<boolean>(storageGet('forceMock', false));
	model = $state<ModelId>(storageGet<ModelId>('model', DEFAULT_MODEL));

	/** Mirrors @byo-keys key presence for Anthropic (reactive). */
	private hasAnthropicKey = $state(false);

	constructor() {
		if (browser) {
			stores.keys.subscribe((keys) => {
				this.hasAnthropicKey = !!keys.anthropic?.hasKey;
			});
		}
	}

	readonly mode = $derived<'mock' | 'live'>(
		this.forceMock || !this.hasAnthropicKey ? 'mock' : 'live'
	);

	get client(): LlmClient {
		return this.mode === 'mock' ? mockClient : live;
	}

	setForceMock(v: boolean) {
		this.forceMock = v;
		storageSet('forceMock', v);
	}

	setModel(m: ModelId) {
		if (MODELS.some((x) => x.id === m)) {
			this.model = m;
			storageSet('model', m);
		}
	}

	private withModel(req: LlmRequest): LlmRequest {
		return { ...req, model: req.model ?? this.model };
	}

	/**
	 * Emit a telemetry record for a mock call so keyless sessions still surface
	 * every call in the shared dashboard. Live calls are emitted by runLLM, so we
	 * only do this in mock mode to avoid double-counting.
	 */
	private emitMock(req: LlmRequest, latencyMs: number, schema?: Schema) {
		const request: InspectableRequest = {
			providerId: 'anthropic',
			model: req.model ?? this.model,
			system: req.system,
			messages: toByoMessages(req.messages),
			params: { temperature: req.temperature, maxTokens: req.maxTokens },
			schema,
			sentAt: Date.now()
		};
		// No usage: a mock call cost nothing, so the dashboard shows $0 for it.
		emitTelemetry({ request, latencyMs });
	}

	async *stream(req: LlmRequest, signal?: AbortSignal): AsyncGenerator<StreamEvent> {
		const r = this.withModel(req);
		const isMock = this.mode === 'mock';
		const t0 = performance.now();
		for await (const ev of this.client.stream(r, signal)) {
			if (isMock && ev.type === 'done') this.emitMock(r, performance.now() - t0);
			yield ev;
		}
	}

	async complete(req: LlmRequest, signal?: AbortSignal): Promise<string> {
		const r = this.withModel(req);
		const isMock = this.mode === 'mock';
		const t0 = performance.now();
		const text = await this.client.complete(r, signal);
		if (isMock) this.emitMock(r, performance.now() - t0);
		return text;
	}

	async structured<T>(
		req: LlmRequest,
		schema: Schema,
		opts: { maxRepairs?: number; signal?: AbortSignal } = {}
	): Promise<StructuredResult<T>> {
		const r = this.withModel(req);
		const isMock = this.mode === 'mock';
		const t0 = performance.now();
		try {
			const result = await structured<T>(this.client, r, schema, opts);
			if (isMock) this.emitMock(r, performance.now() - t0, schema);
			return result;
		} catch (e) {
			if (isMock) this.emitMock(r, performance.now() - t0, schema);
			if (e instanceof StructuredOutputError) throw e;
			throw e;
		}
	}
}

export const llm = new LlmProvider();
