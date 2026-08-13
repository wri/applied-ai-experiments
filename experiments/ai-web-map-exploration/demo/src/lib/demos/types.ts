/**
 * Demo self-description. Every folder under src/lib/demos/ with a meta.ts and
 * a Demo.svelte is automatically registered into the left panel and routing —
 * adding demo #13 means adding a folder, nothing else.
 */

export type DemoCategory = 'ui-patterns' | 'features' | 'ambitious';

export type DemoStatus = 'stub' | 'wip' | 'ready';

export interface DemoMapConfig {
	camera: {
		center: [number, number];
		zoom: number;
		pitch?: number;
		bearing?: number;
	};
	basemap: 'streets' | 'satellite';
}

export interface DemoDefinition {
	slug: string;
	title: string;
	category: DemoCategory;
	/** Sort order within category */
	order: number;
	/** One line for the left panel */
	blurb: string;
	/** Longer description shown on the demo's intro card */
	description: string;
	status: DemoStatus;
	/** Whether this demo makes LLM calls (drives the mock/live badge relevance) */
	usesLlm: boolean;
	/** Map camera + basemap applied on activation; null hides the map entirely */
	map: DemoMapConfig | null;
}

export const CATEGORY_LABELS: Record<DemoCategory, string> = {
	'ui-patterns': 'UI Patterns & Context Surfaces',
	features: 'Feature Concepts',
	ambitious: 'Agentic'
};

export const CATEGORY_ORDER: DemoCategory[] = ['ui-patterns', 'features', 'ambitious'];
