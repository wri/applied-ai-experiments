import type { SchemaIssue } from './validate';

export interface RepairPromptArgs {
  schema: Record<string, unknown>;
  rawOutput: string;
  issues: SchemaIssue[];
}

/**
 * Build a follow-up user message asking the model to fix its previous output
 * so it conforms to the schema. Send as a new user turn after the failed
 * assistant turn, or as a standalone request.
 */
export function buildRepairPrompt({ schema, rawOutput, issues }: RepairPromptArgs): string {
  const issueLines = issues.map((i) => `- ${i.message}`).join('\n');
  return [
    'Your previous output failed JSON Schema validation.',
    '',
    'Validation errors:',
    issueLines,
    '',
    'The required JSON Schema:',
    '```json',
    JSON.stringify(schema, null, 2),
    '```',
    '',
    'Your previous output:',
    '```',
    rawOutput,
    '```',
    '',
    'Return ONLY the corrected JSON. No prose, no markdown fences, no explanations.',
  ].join('\n');
}
