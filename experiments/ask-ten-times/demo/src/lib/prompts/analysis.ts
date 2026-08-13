export const ANALYSIS_SCHEMA: Record<string, unknown> = {
	type: 'object',
	required: [
		'claims',
		'stable_points',
		'disputed_points',
		'rare_but_important_points',
		'recommended_answer',
		'confidence_assessment',
	],
	properties: {
		claims: {
			type: 'array',
			items: {
				type: 'object',
				required: ['text', 'present_in_runs'],
				properties: {
					text: { type: 'string', description: 'A short distinct claim, max ~15 words' },
					present_in_runs: {
						type: 'array',
						items: { type: 'integer', minimum: 1 },
						description: '1-based run numbers that contain this claim',
					},
				},
			},
		},
		stable_points: { type: 'array', items: { type: 'string' } },
		disputed_points: {
			type: 'array',
			items: { type: 'string' },
			description: 'Places where runs disagree or contradict each other',
		},
		rare_but_important_points: { type: 'array', items: { type: 'string' } },
		recommended_answer: { type: 'string' },
		confidence_assessment: { type: 'string' },
	},
};

const MAX_RUN_CHARS = 1500;

export function buildAnalysisPrompt(question: string, outputs: string[]): string {
	const runs = outputs
		.map((output, i) => {
			const truncated =
				output.length > MAX_RUN_CHARS ? `${output.slice(0, MAX_RUN_CHARS)}\n[...truncated]` : output;
			return `### Run ${i + 1}\n${truncated}`;
		})
		.join('\n\n');

	return [
		`The same question was asked to an LLM ${outputs.length} times. Analyze the variability across runs.`,
		'',
		`Question: ${question}`,
		'',
		runs,
		'',
		'Tasks:',
		'1. Extract every distinct claim made across the runs (deduplicate paraphrases into one claim).',
		'   For each claim, list the 1-based run numbers in which it appears.',
		'2. Summarize stable points (in most runs), disputed points (runs disagree), and',
		'   rare-but-important points (appear in few runs but matter).',
		'3. Write a recommended consensus answer and a short confidence assessment that names',
		'   what was unstable.',
		'',
		'Return ONLY a JSON object conforming to the schema you were given. No prose, no fences.',
	].join('\n');
}

export function buildAnalysisSystemPrompt(): string {
	return [
		'You analyze sets of LLM responses for stability and variance. Be precise about which run',
		'said what — never attribute a claim to a run that does not contain it.',
		'Return ONLY JSON conforming to this JSON Schema:',
		'',
		JSON.stringify(ANALYSIS_SCHEMA, null, 2),
	].join('\n');
}
