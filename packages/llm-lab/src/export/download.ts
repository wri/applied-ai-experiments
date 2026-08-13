export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function downloadJson(data: unknown, filename: string): void {
  downloadBlob(
    new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
    filename.endsWith('.json') ? filename : `${filename}.json`
  );
}

export function downloadMarkdown(markdown: string, filename: string): void {
  downloadBlob(
    new Blob([markdown], { type: 'text/markdown' }),
    filename.endsWith('.md') ? filename : `${filename}.md`
  );
}

export function downloadText(text: string, filename: string): void {
  downloadBlob(new Blob([text], { type: 'text/plain' }), filename);
}
