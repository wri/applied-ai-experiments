import { downloadBlob } from './download';

/**
 * Serialize an SVG element to a standalone SVG document string,
 * inlining xmlns and explicit width/height so it opens outside the page.
 */
export function serializeSvg(node: SVGSVGElement): string {
  const clone = node.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');

  const { width, height } = svgSize(node);
  clone.setAttribute('width', String(width));
  clone.setAttribute('height', String(height));

  return new XMLSerializer().serializeToString(clone);
}

export function downloadSvg(node: SVGSVGElement, filename: string): void {
  downloadBlob(
    new Blob([serializeSvg(node)], { type: 'image/svg+xml' }),
    filename.endsWith('.svg') ? filename : `${filename}.svg`
  );
}

export interface PngOptions {
  /** Multiplier on top of devicePixelRatio (default 2 for crisp output) */
  scale?: number;
  /** Background fill; SVGs are transparent by default */
  background?: string;
}

export async function svgToPngBlob(node: SVGSVGElement, opts: PngOptions = {}): Promise<Blob> {
  const { scale = 2, background } = opts;
  const { width, height } = svgSize(node);
  const svgText = serializeSvg(node);
  const svgUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgText)}`;

  const image = await loadImage(svgUrl);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Failed to encode PNG'));
    }, 'image/png');
  });
}

export async function downloadPng(
  node: SVGSVGElement,
  filename: string,
  opts?: PngOptions
): Promise<void> {
  const blob = await svgToPngBlob(node, opts);
  downloadBlob(blob, filename.endsWith('.png') ? filename : `${filename}.png`);
}

function svgSize(node: SVGSVGElement): { width: number; height: number } {
  const rect = node.getBoundingClientRect();
  if (rect.width > 0 && rect.height > 0) {
    return { width: rect.width, height: rect.height };
  }
  const viewBox = node.viewBox?.baseVal;
  if (viewBox && viewBox.width > 0) {
    return { width: viewBox.width, height: viewBox.height };
  }
  return { width: 800, height: 600 };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to load SVG as image'));
    image.src = src;
  });
}
