export type ExtractJsonResult =
  | { ok: true; value: unknown; raw: string }
  | { ok: false; error: string };

/**
 * Extract a JSON value from LLM output text. Handles markdown code fences,
 * prose before/after the JSON, and picks the first balanced object or array.
 */
export function extractJson(text: string): ExtractJsonResult {
  let candidate = text.trim();
  if (candidate.length === 0) {
    return { ok: false, error: 'Empty response' };
  }

  // Prefer the contents of a ```json ... ``` (or plain ```) fence if present
  const fence = candidate.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) {
    candidate = fence[1].trim();
  }

  const direct = tryParse(candidate);
  if (direct.ok) return { ...direct, raw: candidate };

  // Fall back to the first balanced {...} or [...] in the text
  const balanced = findFirstBalanced(candidate);
  if (balanced) {
    const parsed = tryParse(balanced);
    if (parsed.ok) return { ...parsed, raw: balanced };
  }

  return { ok: false, error: direct.error };
}

function tryParse(raw: string): { ok: true; value: unknown } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Invalid JSON' };
  }
}

/**
 * Find the first balanced JSON object or array in the text, respecting
 * string literals and escapes so braces inside strings don't confuse it.
 */
function findFirstBalanced(text: string): string | null {
  const start = findStart(text);
  if (start === -1) return null;

  const open = text[start];
  const close = open === '{' ? '}' : ']';
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
    } else if (ch === open) {
      depth++;
    } else if (ch === close) {
      depth--;
      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
  }
  return null;
}

function findStart(text: string): number {
  const obj = text.indexOf('{');
  const arr = text.indexOf('[');
  if (obj === -1) return arr;
  if (arr === -1) return obj;
  return Math.min(obj, arr);
}
