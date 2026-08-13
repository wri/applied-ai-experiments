import { downloadBlob } from './download';

/**
 * Serialize rows to RFC 4180 CSV. Columns default to the union of keys
 * across all rows, in first-seen order. Nested values are JSON-encoded.
 */
export function toCsv(rows: Array<Record<string, unknown>>, columns?: string[]): string {
  const cols = columns ?? collectColumns(rows);
  const lines = [cols.map(escapeCsv).join(',')];
  for (const row of rows) {
    lines.push(cols.map((col) => escapeCsv(cellText(row[col]))).join(','));
  }
  return lines.join('\r\n');
}

export function downloadCsv(
  rows: Array<Record<string, unknown>>,
  filename: string,
  columns?: string[]
): void {
  downloadBlob(
    new Blob([toCsv(rows, columns)], { type: 'text/csv' }),
    filename.endsWith('.csv') ? filename : `${filename}.csv`
  );
}

function collectColumns(rows: Array<Record<string, unknown>>): string[] {
  const cols: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!seen.has(key)) {
        seen.add(key);
        cols.push(key);
      }
    }
  }
  return cols;
}

function cellText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function escapeCsv(text: string): string {
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}
