/**
 * Structured output, monorepo convention: prompt for JSON → extract (fenced
 * block first, then outermost-brace scan) → validate against a JSON Schema →
 * up to 2 repair turns → typed error. Mock fixtures run through the same
 * extraction + validation path, so they cannot silently drift from the schema.
 */

import { validateJsonSchema } from '@wri-datalab/llm-lab';
import type { LlmClient, LlmMessage, LlmRequest, Schema } from './types';

export class StructuredOutputError extends Error {
	constructor(
		message: string,
		public raw: string,
		public validationErrors: string[],
		/** full loop trace up to the failure (for the request inspector) */
		public attempts: StructuredAttempt[] = []
	) {
		super(message);
		this.name = 'StructuredOutputError';
	}
}

export interface StructuredAttempt {
	raw: string;
	extracted: string | null;
	valid: boolean;
	errors: string[];
}

export interface StructuredResult<T> {
	value: T;
	/** full loop trace, for demos that visualize the pipeline */
	attempts: StructuredAttempt[];
}

export function extractJson(text: string): string | null {
	// fenced block first
	const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
	if (fence) {
		const inner = fence[1].trim();
		if (inner.startsWith('{') || inner.startsWith('[')) return inner;
	}
	// outermost brace/bracket scan
	for (const [open, close] of [
		['{', '}'],
		['[', ']']
	] as const) {
		const start = text.indexOf(open);
		if (start === -1) continue;
		let depth = 0;
		let inString = false;
		let escape = false;
		for (let i = start; i < text.length; i++) {
			const ch = text[i];
			if (escape) {
				escape = false;
				continue;
			}
			if (ch === '\\') {
				escape = true;
				continue;
			}
			if (ch === '"') inString = !inString;
			if (inString) continue;
			if (ch === open) depth++;
			if (ch === close) {
				depth--;
				if (depth === 0) return text.slice(start, i + 1);
			}
		}
	}
	return null;
}

export function validateAgainstSchema(
	value: unknown,
	schema: Schema
): { valid: boolean; errors: string[] } {
	const result = validateJsonSchema(schema, value);
	return {
		valid: result.valid,
		errors: result.issues.map((e) => `${e.path || '(root)'}: ${e.message}`)
	};
}

function schemaInstruction(schema: Schema): string {
	return (
		`Respond ONLY with a JSON object that validates against this JSON Schema — ` +
		`no prose before or after (a \`\`\`json fence is allowed):\n` +
		JSON.stringify(schema)
	);
}

function repairMessage(errors: string[], parseFailed: boolean): string {
	return parseFailed
		? 'Your previous response did not contain parseable JSON. Emit ONLY the corrected JSON object.'
		: `Your previous JSON failed schema validation:\n${errors.map((e) => `- ${e}`).join('\n')}\nEmit ONLY the corrected JSON object.`;
}

export async function structured<T>(
	client: LlmClient,
	req: LlmRequest,
	schema: Schema,
	opts: { maxRepairs?: number; signal?: AbortSignal } = {}
): Promise<StructuredResult<T>> {
	const maxRepairs = opts.maxRepairs ?? 2;
	const system = [req.system, schemaInstruction(schema)].filter(Boolean).join('\n\n');
	const messages: LlmMessage[] = [...req.messages];
	const attempts: StructuredAttempt[] = [];

	for (let attempt = 0; attempt <= maxRepairs; attempt++) {
		const raw = await client.complete({ ...req, system, messages }, opts.signal);
		const extracted = extractJson(raw);
		if (extracted === null) {
			attempts.push({ raw, extracted: null, valid: false, errors: ['No JSON found in response'] });
			messages.push({ role: 'assistant', content: raw });
			messages.push({ role: 'user', content: repairMessage([], true) });
			continue;
		}
		let parsed: unknown;
		try {
			parsed = JSON.parse(extracted);
		} catch (e) {
			attempts.push({
				raw,
				extracted,
				valid: false,
				errors: [`JSON parse error: ${(e as Error).message}`]
			});
			messages.push({ role: 'assistant', content: raw });
			messages.push({ role: 'user', content: repairMessage([], true) });
			continue;
		}
		const { valid, errors } = validateAgainstSchema(parsed, schema);
		attempts.push({ raw, extracted, valid, errors });
		if (valid) return { value: parsed as T, attempts };
		messages.push({ role: 'assistant', content: raw });
		messages.push({ role: 'user', content: repairMessage(errors, false) });
	}

	const last = attempts[attempts.length - 1];
	throw new StructuredOutputError(
		`Structured output failed after ${attempts.length} attempt(s).`,
		last?.raw ?? '',
		last?.errors ?? [],
		attempts
	);
}
