import type { Component } from 'svelte';
import { CATEGORY_ORDER, type DemoCategory, type DemoDefinition } from './types';

// Eager glob of tiny meta files builds the nav at startup; Demo components are
// lazy-globbed so each demo is its own code-split chunk.
const metaModules = import.meta.glob<{ meta: DemoDefinition }>('./*/meta.ts', { eager: true });
const componentModules = import.meta.glob<{ default: Component }>('./*/Demo.svelte');

function slugFromPath(path: string): string {
	return path.split('/')[1];
}

export const demos: DemoDefinition[] = Object.entries(metaModules)
	.map(([path, mod]) => {
		const meta = mod.meta;
		if (meta.slug !== slugFromPath(path)) {
			console.warn(`Demo meta slug "${meta.slug}" does not match folder "${slugFromPath(path)}"`);
		}
		return meta;
	})
	.sort(
		(a, b) =>
			CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category) || a.order - b.order
	);

export const demosByCategory: Map<DemoCategory, DemoDefinition[]> = new Map(
	CATEGORY_ORDER.map((cat) => [cat, demos.filter((d) => d.category === cat)])
);

export function getDemo(slug: string): DemoDefinition | undefined {
	return demos.find((d) => d.slug === slug);
}

export async function loadDemo(slug: string): Promise<Component> {
	const loader = componentModules[`./${slug}/Demo.svelte`];
	if (!loader) throw new Error(`No demo component for slug "${slug}"`);
	return (await loader()).default;
}
