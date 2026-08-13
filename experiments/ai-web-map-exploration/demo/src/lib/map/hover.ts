/**
 * Config vocabulary for the shared hover-attributes popup: which layers are
 * hoverable, which feature properties to show, and how to format them.
 */

export interface HoverField {
	prop: string;
	label: string;
	/** format receives the raw value + full props (for composite fields) */
	format?: (v: unknown, props: Record<string, unknown>) => string;
}

export interface HoverLayerConfig {
	layerId: string;
	/** panel-title line; defaults to the layer id */
	title?: string | ((props: Record<string, unknown>) => string);
	fields: HoverField[];
	/** hit padding in px around the cursor (default 4) */
	hitPad?: number;
}

export const fmtHa = (v: unknown) => `${Number(v).toFixed(1)} ha`;

export const fmtMeters = (v: unknown) =>
	Number(v) >= 1000 ? `${(Number(v) / 1000).toFixed(1)} km` : `${Math.round(Number(v))} m`;

export const fmtPct = (v: unknown) => `${Math.round(Number(v) * 100)}%`;

export const humanize = (v: unknown) => String(v ?? '').replaceAll('_', ' ');
