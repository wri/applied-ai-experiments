export function buildExtractionSystemPrompt(schema: Record<string, unknown>): string {
	return [
		'You are a structured data extractor. The user will give you messy real-world text.',
		'Extract the requested data and return ONLY a JSON object that conforms to this JSON Schema:',
		'',
		JSON.stringify(schema, null, 2),
		'',
		'Rules:',
		'- Return ONLY the JSON object. No prose, no markdown fences, no explanations.',
		'- Use null for information that is not present. Never invent values.',
		'- When a field asks for evidence or quotes, copy text verbatim from the source.',
		'- Dates should be ISO format (YYYY-MM-DD) when the source allows it.',
	].join('\n');
}
