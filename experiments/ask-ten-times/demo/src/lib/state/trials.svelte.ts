import type { BYOKStores } from '@byo-keys/svelte';
import type { ProviderId, ModelInfo, TokenUsage } from '@byo-keys/core';
import {
	runLLM,
	fanOut,
	parseStructured,
	buildRepairPrompt,
	computeCost,
	sumUsage,
	createRunHistory,
	type InspectableRequest,
	type RunResponse,
	type RunRecord,
} from '@wri-datalab/llm-lab';
import {
	ANALYSIS_SCHEMA,
	buildAnalysisPrompt,
	buildAnalysisSystemPrompt,
} from '../prompts/analysis';
import { PARAPHRASE_SCHEMA, buildParaphrasePrompt } from '../prompts/paraphrase';
import { SAMPLE_QUESTIONS } from '../sample-data';

export type Phase = 'idle' | 'paraphrasing' | 'running' | 'analyzing' | 'done' | 'cancelled';

export interface Trial {
	index: number;
	prompt: string;
	status: 'pending' | 'running' | 'done' | 'error';
	content: string;
	error?: string;
	latencyMs: number;
	usage?: TokenUsage;
	request?: InspectableRequest;
}

export interface AnalysisResult {
	claims: Array<{ text: string; present_in_runs: number[] }>;
	stable_points: string[];
	disputed_points: string[];
	rare_but_important_points: string[];
	recommended_answer: string;
	confidence_assessment: string;
}

export function createTrialsState(stores: BYOKStores) {
	let question = $state(SAMPLE_QUESTIONS[0].text);
	let n = $state(10);
	let temperature = $state(1.0);
	let paraphrase = $state(false);

	let phase = $state<Phase>('idle');
	let trials = $state<Trial[]>([]);
	let analysis = $state<AnalysisResult | null>(null);
	let analysisError = $state<string | null>(null);
	let analysisRaw = $state('');
	let analysisRequest = $state<InspectableRequest | null>(null);
	// Final analysis response (content + usage), captured so a saved run is
	// replay-complete: the recording needs the analysis call, not just the trials.
	let analysisResponse = $state<RunResponse | null>(null);
	let costUsd = $state<number | null>(null);

	let controller: AbortController | null = null;

	const history = createRunHistory('ask-ten-times');

	const completedCount = $derived(trials.filter((t) => t.status === 'done').length);
	const totalUsage = $derived(sumUsage(trials.map((t) => t.usage)));
	const busy = $derived(phase === 'paraphrasing' || phase === 'running' || phase === 'analyzing');

	function modelInfo(providerId: ProviderId, modelId: string): ModelInfo | undefined {
		return stores
			.getClient()
			.getModels(providerId)
			.find((m) => m.id === modelId);
	}

	async function generateParaphrases(
		providerId: ProviderId,
		modelId: string,
		signal: AbortSignal
	): Promise<string[]> {
		const result = await runLLM(stores, {
			providerId,
			model: modelId,
			messages: [{ role: 'user', content: buildParaphrasePrompt(question, n) }],
			temperature: 0.8,
			maxTokens: 2048,
			schema: PARAPHRASE_SCHEMA,
			label: 'paraphrase',
			signal,
		});
		if (result.error) return [];
		const parsed = parseStructured(result.content, PARAPHRASE_SCHEMA);
		if (!parsed.ok) return [];
		const list = (parsed.value as { paraphrases: string[] }).paraphrases;
		return list.filter((p) => typeof p === 'string' && p.trim().length > 0);
	}

	async function runAnalysis(providerId: ProviderId, modelId: string, signal: AbortSignal) {
		const outputs = trials.filter((t) => t.status === 'done').map((t) => t.content);
		if (outputs.length < 2) {
			analysisError = 'Not enough completed runs to analyze.';
			return;
		}

		const system = buildAnalysisSystemPrompt();
		const userPrompt = buildAnalysisPrompt(question, outputs);

		let result = await runLLM(stores, {
			providerId,
			model: modelId,
			system,
			messages: [{ role: 'user', content: userPrompt }],
			temperature: 0,
			maxTokens: 4096,
			schema: ANALYSIS_SCHEMA,
			label: 'analysis',
			signal,
		});
		analysisRequest = result.request;
		analysisRaw = result.content;
		analysisResponse = {
			content: result.content,
			usage: result.usage,
			latencyMs: result.latencyMs,
			finishReason: result.finishReason,
			error: result.error,
		};

		if (result.error) {
			analysisError = result.error;
			return;
		}

		let parsed = parseStructured(result.content, ANALYSIS_SCHEMA);
		if (!parsed.ok && !signal.aborted) {
			// One repair pass before giving up
			result = await runLLM(stores, {
				providerId,
				model: modelId,
				system,
				messages: [
					{ role: 'user', content: userPrompt },
					{ role: 'assistant', content: result.content },
					{
						role: 'user',
						content: buildRepairPrompt({
							schema: ANALYSIS_SCHEMA,
							rawOutput: result.content,
							issues: parsed.issues,
						}),
					},
				],
				temperature: 0,
				maxTokens: 4096,
				schema: ANALYSIS_SCHEMA,
				label: 'analysis repair',
				signal,
			});
			analysisRaw = result.content;
			analysisResponse = {
				content: result.content,
				usage: result.usage,
				latencyMs: result.latencyMs,
				finishReason: result.finishReason,
				error: result.error,
			};
			parsed = parseStructured(result.content, ANALYSIS_SCHEMA);
		}

		if (parsed.ok) {
			const value = parsed.value as AnalysisResult;
			// Drop run references the judge hallucinated beyond the actual run count
			value.claims = value.claims.map((claim) => ({
				...claim,
				present_in_runs: claim.present_in_runs.filter((r) => r >= 1 && r <= outputs.length),
			}));
			analysis = value;
		} else {
			analysisError = `Analysis output failed validation: ${parsed.issues
				.map((i) => i.message)
				.join('; ')}`;
		}
	}

	async function run(providerId: ProviderId, modelId: string) {
		if (busy) return;
		controller = new AbortController();
		const signal = controller.signal;

		trials = [];
		analysis = null;
		analysisError = null;
		analysisRaw = '';
		analysisRequest = null;
		analysisResponse = null;
		costUsd = null;

		// 1. Optional paraphrases
		let prompts: string[] = Array.from({ length: n }, () => question);
		if (paraphrase) {
			phase = 'paraphrasing';
			const paraphrases = await generateParaphrases(providerId, modelId, signal);
			if (signal.aborted) {
				phase = 'cancelled';
				return;
			}
			if (paraphrases.length > 0) {
				prompts = Array.from({ length: n }, (_, i) => paraphrases[i % paraphrases.length]);
			}
		}

		// 2. Fan out N runs
		phase = 'running';
		trials = prompts.map((prompt, index) => ({
			index,
			prompt,
			status: 'pending' as const,
			content: '',
			latencyMs: 0,
		}));

		await fanOut(
			trials.map((trial, i) => async () => {
				trials[i].status = 'running';
				const result = await runLLM(stores, {
					providerId,
					model: modelId,
					messages: [{ role: 'user', content: trial.prompt }],
					temperature,
					maxTokens: 1024,
					label: `run ${i + 1}`,
					signal,
					onDelta: (_, full) => {
						trials[i].content = full;
					},
				});
				trials[i].content = result.content;
				trials[i].latencyMs = result.latencyMs;
				trials[i].usage = result.usage;
				trials[i].request = result.request;
				trials[i].status = result.error ? 'error' : 'done';
				trials[i].error = result.error;
			}),
			{ concurrency: 3, signal }
		);

		if (signal.aborted) {
			phase = 'cancelled';
			return;
		}

		// 3. Analysis pass
		phase = 'analyzing';
		await runAnalysis(providerId, modelId, signal);
		if (signal.aborted) {
			phase = 'cancelled';
			return;
		}

		const model = modelInfo(providerId, modelId);
		const usages = [...trials.map((t) => t.usage)];
		costUsd = computeCost(model, sumUsage(usages));

		phase = 'done';

		await history.save({
			label: `${n}× @ t=${temperature}`,
			config: { question, n, temperature, paraphrase },
			requests: [
				...trials.filter((t) => t.request).map((t) => t.request as InspectableRequest),
				...(analysisRequest ? [analysisRequest] : []),
			],
			responses: [
				...trials.map(
					(t): RunResponse => ({
						content: t.content,
						usage: t.usage,
						latencyMs: t.latencyMs,
						error: t.error,
					})
				),
				...(analysisResponse ? [analysisResponse] : []),
			],
		});
	}

	function cancel() {
		controller?.abort();
	}

	function restoreConfig(config: Record<string, unknown>) {
		const c = config as {
			question?: string;
			n?: number;
			temperature?: number;
			paraphrase?: boolean;
		};
		if (typeof c.question === 'string') question = c.question;
		if (typeof c.n === 'number') n = c.n;
		if (typeof c.temperature === 'number') temperature = c.temperature;
		if (typeof c.paraphrase === 'boolean') paraphrase = c.paraphrase;
	}

	function restore(record: RunRecord) {
		restoreConfig(record.config);
	}

	function buildMarkdownReport(): string {
		const lines = [
			'# Ask the Same Question 10 Times — report',
			'',
			`**Question:** ${question}`,
			`**Runs:** ${trials.length} · temperature ${temperature} · paraphrase ${paraphrase ? 'on' : 'off'}`,
			'',
		];
		if (analysis) {
			lines.push('## Consensus answer', '', analysis.recommended_answer, '');
			lines.push('## Confidence assessment', '', analysis.confidence_assessment, '');
			lines.push('## Stable points', '', ...analysis.stable_points.map((p) => `- ${p}`), '');
			lines.push('## Disputed points', '', ...analysis.disputed_points.map((p) => `- ${p}`), '');
			lines.push(
				'## Rare but important points',
				'',
				...analysis.rare_but_important_points.map((p) => `- ${p}`),
				''
			);
			lines.push('## Claim × run matrix', '');
			lines.push(`| Claim | ${trials.map((_, i) => `R${i + 1}`).join(' | ')} |`);
			lines.push(`|---|${trials.map(() => '---').join('|')}|`);
			for (const claim of analysis.claims) {
				const cells = trials.map((_, i) => (claim.present_in_runs.includes(i + 1) ? '●' : ''));
				lines.push(`| ${claim.text.replace(/\|/g, '\\|')} | ${cells.join(' | ')} |`);
			}
			lines.push('');
		}
		lines.push('## Raw runs', '');
		for (const trial of trials) {
			lines.push(`### Run ${trial.index + 1}`, '', trial.content, '');
		}
		return lines.join('\n');
	}

	return {
		history,
		get question() { return question; },
		set question(v: string) { question = v; },
		get n() { return n; },
		set n(v: number) { n = v; },
		get temperature() { return temperature; },
		set temperature(v: number) { temperature = v; },
		get paraphrase() { return paraphrase; },
		set paraphrase(v: boolean) { paraphrase = v; },
		get phase() { return phase; },
		get trials() { return trials; },
		get analysis() { return analysis; },
		get analysisError() { return analysisError; },
		get analysisRaw() { return analysisRaw; },
		get analysisRequest() { return analysisRequest; },
		get costUsd() { return costUsd; },
		get completedCount() { return completedCount; },
		get totalUsage() { return totalUsage; },
		get busy() { return busy; },
		run,
		cancel,
		restore,
		restoreConfig,
		buildMarkdownReport,
	};
}

export type TrialsState = ReturnType<typeof createTrialsState>;
