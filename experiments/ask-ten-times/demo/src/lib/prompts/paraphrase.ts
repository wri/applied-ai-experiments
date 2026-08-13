export const PARAPHRASE_SCHEMA: Record<string, unknown> = {
	type: 'object',
	required: ['paraphrases'],
	properties: {
		paraphrases: {
			type: 'array',
			items: { type: 'string' },
		},
	},
};

export function buildParaphrasePrompt(question: string, n: number): string {
	return [
		`Generate exactly ${n} meaning-preserving paraphrases of the following question.`,
		'Each paraphrase must ask for exactly the same information — change only wording and structure.',
		'',
		`Question: ${question}`,
		'',
		`Return ONLY a JSON object: {"paraphrases": ["...", ...]} with exactly ${n} strings.`,
		'No prose, no markdown fences.',
	].join('\n');
}
