import type { BYOKStores } from '@byo-keys/svelte';
import type { ProviderId, ModelInfo, TokenUsage } from '@byo-keys/core';
import {
	runLLM,
	parseStructured,
	buildRepairPrompt,
	checkSchema,
	computeCost,
	sumUsage,
	createRunHistory,
	type InspectableRequest,
	type RunResponse,
	type SchemaIssue,
	type RunRecord,
} from '@wri-datalab/llm-lab';
import { TEMPLATES, getTemplate } from '../schemas/templates';
import { buildExtractionSystemPrompt } from '../prompts/extract';
import { SAMPLES } from '../sample-data';

export interface Attempt {
	label: string;
	request: InspectableRequest;
	response: RunResponse;
}

const MAX_REPAIRS = 2;

export function createLab(stores: BYOKStores) {
	// --- inputs ---
	let sourceText = $state(SAMPLES[0].text);
	let schemaMode = $state<'template' | 'raw'>('template');
	let templateId = $state('risks');
	let rawSchemaText = $state(JSON.stringify(getTemplate('risks').schema, null, 2));

	// --- run state ---
	let running = $state(false);
	let streamingContent = $state('');
	let parsed = $state<unknown>(undefined);
	let rawJson = $state<string | null>(null);
	let valid = $state(false);
	let issues = $state<SchemaIssue[]>([]);
	let attempts = $state<Attempt[]>([]);
	let runError = $state<string | null>(null);
	let costUsd = $state<number | null>(null);
	let hasRun = $state(false);

	const history = createRunHistory('structured-output-lab');

	const schemaState = $derived.by((): { schema: Record<string, unknown> | null; error: string | null } => {
		if (schemaMode === 'template') {
			return { schema: getTemplate(templateId).schema, error: null };
		}
		try {
			const parsedSchema = JSON.parse(rawSchemaText) as Record<string, unknown>;
			const check = checkSchema(parsedSchema);
			return check.ok
				? { schema: parsedSchema, error: null }
				: { schema: null, error: check.error ?? 'Invalid schema' };
		} catch (err) {
			return {
				schema: null,
				error: `Not valid JSON: ${err instanceof Error ? err.message : 'parse error'}`,
			};
		}
	});

	const totalUsage = $derived(sumUsage(attempts.map((a) => a.response.usage)));
	const totalLatencyMs = $derived(attempts.reduce((sum, a) => sum + a.response.latencyMs, 0));
	const repairCount = $derived(Math.max(0, attempts.length - 1));
	const canRepair = $derived(
		hasRun && !running && !valid && rawJson !== null && repairCount < MAX_REPAIRS
	);

	function modelInfo(providerId: ProviderId, modelId: string): ModelInfo | undefined {
		return stores
			.getClient()
			.getModels(providerId)
			.find((m) => m.id === modelId);
	}

	function applyParse(content: string, schema: Record<string, unknown>) {
		const result = parseStructured(content, schema);
		valid = result.ok;
		issues = result.issues;
		parsed = result.value;
		rawJson = result.raw ?? content;
	}

	function recordAttempt(label: string, request: InspectableRequest, response: RunResponse) {
		attempts = [...attempts, { label, request, response }];
	}

	async function saveRun() {
		await history.save({
			label: schemaMode === 'template' ? getTemplate(templateId).name : 'Raw schema',
			config: { sourceText, schemaMode, templateId, rawSchemaText },
			requests: attempts.map((a) => a.request),
			responses: attempts.map((a) => a.response),
		});
	}

	async function run(providerId: ProviderId, modelId: string) {
		const schema = schemaState.schema;
		if (!schema || running) return;

		running = true;
		hasRun = true;
		streamingContent = '';
		parsed = undefined;
		rawJson = null;
		valid = false;
		issues = [];
		attempts = [];
		runError = null;
		costUsd = null;

		const result = await runLLM(stores, {
			providerId,
			model: modelId,
			system: buildExtractionSystemPrompt(schema),
			messages: [{ role: 'user', content: sourceText }],
			temperature: 0,
			maxTokens: 4096,
			schema,
			label: 'extract',
			onDelta: (_, full) => {
				streamingContent = full;
			},
		});

		const response: RunResponse = {
			content: result.content,
			usage: result.usage,
			latencyMs: result.latencyMs,
			error: result.error,
		};

		if (result.error) {
			runError = result.error;
			recordAttempt('extract', result.request, response);
		} else {
			applyParse(result.content, schema);
			response.parsed = parsed;
			response.costUsd = computeCost(modelInfo(providerId, modelId), result.usage ?? sumUsage([])) ?? undefined;
			recordAttempt('extract', result.request, response);
			costUsd = attempts.reduce((sum, a) => sum + (a.response.costUsd ?? 0), 0) || null;
			await saveRun();
		}

		running = false;
	}

	async function repair(providerId: ProviderId, modelId: string) {
		const schema = schemaState.schema;
		if (!schema || !canRepair || rawJson === null) return;

		running = true;
		streamingContent = '';
		const previousOutput = rawJson;

		const result = await runLLM(stores, {
			providerId,
			model: modelId,
			system: buildExtractionSystemPrompt(schema),
			messages: [
				{ role: 'user', content: sourceText },
				{ role: 'assistant', content: previousOutput },
				{ role: 'user', content: buildRepairPrompt({ schema, rawOutput: previousOutput, issues }) },
			],
			temperature: 0,
			maxTokens: 4096,
			schema,
			label: `repair #${repairCount + 1}`,
			onDelta: (_, full) => {
				streamingContent = full;
			},
		});

		const response: RunResponse = {
			content: result.content,
			usage: result.usage,
			latencyMs: result.latencyMs,
			error: result.error,
		};

		if (result.error) {
			runError = result.error;
		} else {
			applyParse(result.content, schema);
			response.parsed = parsed;
			response.costUsd = computeCost(modelInfo(providerId, modelId), result.usage ?? sumUsage([])) ?? undefined;
		}
		recordAttempt(`repair #${repairCount + 1}`, result.request, response);
		costUsd = attempts.reduce((sum, a) => sum + (a.response.costUsd ?? 0), 0) || null;
		await saveRun();

		running = false;
	}

	function restoreConfig(config: Record<string, unknown>) {
		const c = config as {
			sourceText?: string;
			schemaMode?: 'template' | 'raw';
			templateId?: string;
			rawSchemaText?: string;
		};
		if (typeof c.sourceText === 'string') sourceText = c.sourceText;
		if (c.schemaMode === 'template' || c.schemaMode === 'raw') schemaMode = c.schemaMode;
		if (typeof c.templateId === 'string' && TEMPLATES.some((t) => t.id === c.templateId)) {
			templateId = c.templateId;
		}
		if (typeof c.rawSchemaText === 'string') rawSchemaText = c.rawSchemaText;
	}

	function restore(record: RunRecord) {
		restoreConfig(record.config);
	}

	/** Load the current template's schema into the raw editor when switching modes */
	function syncRawFromTemplate() {
		rawSchemaText = JSON.stringify(getTemplate(templateId).schema, null, 2);
	}

	return {
		history,
		get sourceText() { return sourceText; },
		set sourceText(v: string) { sourceText = v; },
		get schemaMode() { return schemaMode; },
		set schemaMode(v: 'template' | 'raw') { schemaMode = v; },
		get templateId() { return templateId; },
		set templateId(v: string) { templateId = v; },
		get rawSchemaText() { return rawSchemaText; },
		set rawSchemaText(v: string) { rawSchemaText = v; },
		get schemaState() { return schemaState; },
		get running() { return running; },
		get streamingContent() { return streamingContent; },
		get parsed() { return parsed; },
		get rawJson() { return rawJson; },
		get valid() { return valid; },
		get issues() { return issues; },
		get attempts() { return attempts; },
		get runError() { return runError; },
		get costUsd() { return costUsd; },
		get hasRun() { return hasRun; },
		get totalUsage() { return totalUsage; },
		get totalLatencyMs() { return totalLatencyMs; },
		get repairCount() { return repairCount; },
		get canRepair() { return canRepair; },
		run,
		repair,
		restore,
		restoreConfig,
		syncRawFromTemplate,
	};
}

export type Lab = ReturnType<typeof createLab>;
