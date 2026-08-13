/**
 * Mock client: deterministic keyless mode. Streams word-chunks on a timer so
 * streaming UI is fully exercised without a key. JSON fixtures go through the
 * exact same extraction/validation path as live output (see structured.ts),
 * which keeps fixtures honest.
 */

import { lastUserText, type LlmClient, type LlmRequest, type StreamEvent } from './types';

async function resolveMockText(req: LlmRequest): Promise<string> {
	const spec = req.mock;
	switch (spec.kind) {
		case 'text':
			return spec.text;
		case 'json':
			return '```json\n' + JSON.stringify(spec.value, null, 2) + '\n```';
		case 'match': {
			const text = lastUserText(req).toLowerCase();
			for (const c of spec.cases) {
				if (c.pattern.test(text)) return c.text;
			}
			return spec.fallback;
		}
		case 'fn':
			return await spec.run(req);
	}
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
	return new Promise((resolve, reject) => {
		const t = setTimeout(resolve, ms);
		signal?.addEventListener('abort', () => {
			clearTimeout(t);
			reject(new DOMException('aborted', 'AbortError'));
		});
	});
}

export const mockClient: LlmClient = {
	id: 'mock',

	async *stream(req: LlmRequest, signal?: AbortSignal): AsyncGenerator<StreamEvent> {
		const text = await resolveMockText(req);
		// Small initial "thinking" latency keeps the UI honest about async states
		await sleep(350, signal);
		const chunks = text.match(/\S+\s*/g) ?? [];
		for (const chunk of chunks) {
			if (signal?.aborted) return;
			yield { type: 'delta', text: chunk };
			await sleep(14 + Math.random() * 26, signal);
		}
		yield {
			type: 'done',
			usage: { inputTokens: Math.ceil(lastUserText(req).length / 4), outputTokens: Math.ceil(text.length / 4) }
		};
	},

	async complete(req: LlmRequest, signal?: AbortSignal): Promise<string> {
		await sleep(400 + Math.random() * 500, signal);
		return resolveMockText(req);
	}
};
