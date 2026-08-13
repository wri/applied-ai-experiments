import { extractJson } from './extract-json';
import { validateJsonSchema, type SchemaIssue } from './validate';

export interface ParseStructuredResult {
  ok: boolean;
  /** Parsed value (present even when invalid, so UIs can show what came back) */
  value?: unknown;
  /** The exact JSON text that was parsed */
  raw?: string;
  issues: SchemaIssue[];
}

/**
 * Extract JSON from LLM output text and validate it against a JSON Schema.
 */
export function parseStructured(
  text: string,
  schema: Record<string, unknown>
): ParseStructuredResult {
  const extracted = extractJson(text);
  if (!extracted.ok) {
    return {
      ok: false,
      issues: [{ path: '', keyword: 'json', message: `Output is not valid JSON: ${extracted.error}` }],
    };
  }
  const validation = validateJsonSchema(schema, extracted.value);
  return {
    ok: validation.valid,
    value: extracted.value,
    raw: extracted.raw,
    issues: validation.issues,
  };
}
