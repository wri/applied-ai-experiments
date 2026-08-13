import { describe, it, expect } from 'vitest';
import { validateJsonSchema, checkSchema, pointerToPath } from './validate';
import { parseStructured } from './parse-structured';
import { buildRepairPrompt } from './repair-prompt';

const RISK_SCHEMA = {
  type: 'object',
  required: ['title', 'deadline', 'risks'],
  properties: {
    title: { type: 'string' },
    deadline: { type: ['string', 'null'] },
    risks: {
      type: 'array',
      items: {
        type: 'object',
        required: ['risk', 'severity'],
        properties: {
          risk: { type: 'string' },
          severity: { type: 'string', enum: ['low', 'medium', 'high'] },
        },
      },
    },
  },
} as Record<string, unknown>;

describe('validateJsonSchema', () => {
  it('passes valid data', () => {
    const result = validateJsonSchema(RISK_SCHEMA, {
      title: 'x',
      deadline: null,
      risks: [{ risk: 'flood', severity: 'high' }],
    });
    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it('reports missing required fields by name', () => {
    const result = validateJsonSchema(RISK_SCHEMA, { title: 'x', risks: [] });
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.message.includes('`deadline`'))).toBe(true);
  });

  it('reports invalid enum values with allowed options', () => {
    const result = validateJsonSchema(RISK_SCHEMA, {
      title: 'x',
      deadline: null,
      risks: [{ risk: 'flood', severity: 'urgent' }],
    });
    expect(result.valid).toBe(false);
    const enumIssue = result.issues.find((i) => i.keyword === 'enum');
    expect(enumIssue).toBeDefined();
    expect(enumIssue!.message).toContain('"urgent"');
    expect(enumIssue!.message).toContain('low');
    expect(enumIssue!.path).toBe('risks[0].severity');
  });

  it('reports type mismatches with actual type', () => {
    const result = validateJsonSchema(RISK_SCHEMA, {
      title: 'x',
      deadline: null,
      risks: 'not an array',
    });
    expect(result.valid).toBe(false);
    const typeIssue = result.issues.find((i) => i.keyword === 'type' && i.path === 'risks');
    expect(typeIssue).toBeDefined();
    expect(typeIssue!.message).toContain('array');
    expect(typeIssue!.message).toContain('string');
  });
});

describe('checkSchema', () => {
  it('accepts a valid schema', () => {
    expect(checkSchema(RISK_SCHEMA).ok).toBe(true);
  });
});

describe('pointerToPath', () => {
  it('converts pointers to dotted paths', () => {
    expect(pointerToPath('#/risks/0/severity')).toBe('risks[0].severity');
    expect(pointerToPath('#')).toBe('');
    expect(pointerToPath('#/a/b')).toBe('a.b');
  });
});

describe('parseStructured', () => {
  it('extracts and validates in one step', () => {
    const text = '```json\n{"title": "x", "deadline": null, "risks": []}\n```';
    const result = parseStructured(text, RISK_SCHEMA);
    expect(result.ok).toBe(true);
  });

  it('reports JSON failure as an issue', () => {
    const result = parseStructured('no json here', RISK_SCHEMA);
    expect(result.ok).toBe(false);
    expect(result.issues[0].keyword).toBe('json');
  });

  it('keeps the parsed value when validation fails', () => {
    const result = parseStructured('{"title": 1}', RISK_SCHEMA);
    expect(result.ok).toBe(false);
    expect(result.value).toEqual({ title: 1 });
  });
});

describe('buildRepairPrompt', () => {
  it('includes errors, schema, and original output', () => {
    const prompt = buildRepairPrompt({
      schema: RISK_SCHEMA,
      rawOutput: '{"title": 1}',
      issues: [{ path: '', keyword: 'required', message: 'Missing required field `deadline`' }],
    });
    expect(prompt).toContain('Missing required field `deadline`');
    expect(prompt).toContain('"title": 1');
    expect(prompt).toContain('Return ONLY the corrected JSON');
  });
});
