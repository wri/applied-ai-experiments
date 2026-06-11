import { Validator } from '@cfworker/json-schema';
import type { Schema, OutputUnit } from '@cfworker/json-schema';

export interface SchemaIssue {
  /** Dotted instance path, e.g. "risks[0].severity" ('' = root) */
  path: string;
  /** Failing keyword: required | type | enum | ... */
  keyword: string;
  /** Human-readable message, e.g. "Missing required field `deadline`" */
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: SchemaIssue[];
}

/** Keywords that represent actual leaf failures, not applicator bookkeeping. */
const LEAF_KEYWORDS = new Set([
  'required',
  'type',
  'enum',
  'const',
  'minimum',
  'maximum',
  'exclusiveMinimum',
  'exclusiveMaximum',
  'minLength',
  'maxLength',
  'pattern',
  'minItems',
  'maxItems',
  'uniqueItems',
  'additionalProperties',
  'format',
  'multipleOf',
]);

/**
 * Check whether a schema itself is usable (e.g. user-edited raw JSON Schema).
 */
export function checkSchema(schema: Record<string, unknown>): { ok: boolean; error?: string } {
  try {
    const validator = new Validator(schema as Schema, '2020-12', false);
    validator.validate({});
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Invalid schema' };
  }
}

/**
 * Validate data against a JSON Schema, producing human-readable issues.
 */
export function validateJsonSchema(
  schema: Record<string, unknown>,
  data: unknown
): ValidationResult {
  let result;
  try {
    const validator = new Validator(schema as Schema, '2020-12', false);
    result = validator.validate(data);
  } catch (err) {
    return {
      valid: false,
      issues: [
        {
          path: '',
          keyword: 'schema',
          message: `Schema error: ${err instanceof Error ? err.message : 'invalid schema'}`,
        },
      ],
    };
  }

  if (result.valid) return { valid: true, issues: [] };

  const issues: SchemaIssue[] = [];
  const seen = new Set<string>();
  for (const unit of result.errors) {
    const keyword = lastSegment(unit.keywordLocation);
    if (!LEAF_KEYWORDS.has(keyword)) continue;
    const issue = humanize(unit, keyword, schema, data);
    const key = `${issue.path}|${issue.keyword}|${issue.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    issues.push(issue);
  }

  // Every failure was applicator-level noise — fall back to the first raw error
  if (issues.length === 0 && result.errors.length > 0) {
    const first = result.errors[result.errors.length - 1];
    issues.push({
      path: pointerToPath(first.instanceLocation),
      keyword: lastSegment(first.keywordLocation),
      message: first.error,
    });
  }

  return { valid: false, issues };
}

function humanize(
  unit: OutputUnit,
  keyword: string,
  schema: Record<string, unknown>,
  data: unknown
): SchemaIssue {
  const path = pointerToPath(unit.instanceLocation);
  const at = path ? ` at \`${path}\`` : '';
  const value = resolvePointer(data, unit.instanceLocation);

  switch (keyword) {
    case 'required': {
      const prop = unit.error.match(/"([^"]+)"/)?.[1];
      return {
        path,
        keyword,
        message: prop
          ? `Missing required field \`${prop}\`${at}`
          : `Missing required field${at}`,
      };
    }
    case 'type': {
      const expected = resolvePointer(schema, unit.keywordLocation);
      const actual = describeType(value);
      return {
        path,
        keyword,
        message: `Expected ${formatExpected(expected)}${at}, got ${actual}`,
      };
    }
    case 'enum': {
      const allowed = resolvePointer(schema, unit.keywordLocation);
      const allowedText = Array.isArray(allowed)
        ? ` — expected one of: ${allowed.map((v) => JSON.stringify(v)).join(', ')}`
        : '';
      return {
        path,
        keyword,
        message: `Invalid value ${JSON.stringify(value)}${at}${allowedText}`,
      };
    }
    case 'const': {
      const expected = resolvePointer(schema, unit.keywordLocation);
      return {
        path,
        keyword,
        message: `Expected the constant ${JSON.stringify(expected)}${at}, got ${JSON.stringify(value)}`,
      };
    }
    case 'additionalProperties':
      return { path, keyword, message: `Unexpected extra property${at}` };
    default:
      return { path, keyword, message: `${unit.error}${at}` };
  }
}

function formatExpected(expected: unknown): string {
  if (typeof expected === 'string') return expected;
  if (Array.isArray(expected)) return expected.join(' or ');
  return 'a different type';
}

function describeType(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function lastSegment(pointer: string): string {
  const parts = pointer.split('/');
  return decodePointerSegment(parts[parts.length - 1] ?? '');
}

/** Convert a JSON pointer like "#/risks/0/severity" to "risks[0].severity". */
export function pointerToPath(pointer: string): string {
  const segments = pointer
    .replace(/^#?\/?/, '')
    .split('/')
    .filter((s) => s.length > 0)
    .map(decodePointerSegment);
  let path = '';
  for (const seg of segments) {
    if (/^\d+$/.test(seg)) {
      path += `[${seg}]`;
    } else {
      path += path ? `.${seg}` : seg;
    }
  }
  return path;
}

function decodePointerSegment(segment: string): string {
  return segment.replace(/~1/g, '/').replace(/~0/g, '~');
}

/** Resolve a JSON pointer (e.g. "#/properties/severity/enum") against a value. */
export function resolvePointer(value: unknown, pointer: string): unknown {
  const segments = pointer
    .replace(/^#?\/?/, '')
    .split('/')
    .filter((s) => s.length > 0)
    .map(decodePointerSegment);
  let current: unknown = value;
  for (const seg of segments) {
    if (current === null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[seg];
  }
  return current;
}
