/**
 * Step-plan runner: executes a structured plan (tool + args + narration per
 * step) against the shared map, with pause/resume and a live timeline.
 */

import maplibregl from 'maplibre-gl';
import type { Schema } from '$lib/llm/types';
import { mapStore } from '$lib/map/MapStore.svelte';

export interface PlanStep {
	tool: 'flyTo' | 'setFilter' | 'toggleLayer' | 'highlight' | 'report';
	args: Record<string, unknown>;
	narration: string;
}

export interface Plan {
	steps: PlanStep[];
}

export const PLAN_SCHEMA: Schema = {
	type: 'object',
	required: ['steps'],
	additionalProperties: false,
	properties: {
		steps: {
			type: 'array',
			minItems: 2,
			maxItems: 8,
			items: {
				type: 'object',
				required: ['tool', 'args', 'narration'],
				additionalProperties: false,
				properties: {
					tool: { enum: ['flyTo', 'setFilter', 'toggleLayer', 'highlight', 'report'] },
					args: { type: 'object' },
					narration: { type: 'string', maxLength: 300 }
				}
			}
		}
	}
};

export type StepStatus = 'pending' | 'active' | 'done';

export class PlanRunner {
	steps = $state<PlanStep[]>([]);
	statuses = $state<StepStatus[]>([]);
	reports = $state<string[]>([]);
	running = $state(false);
	paused = $state(false);
	finished = $state(false);

	private marker: maplibregl.Marker | null = null;
	private generation = 0;

	load(plan: Plan) {
		this.stop();
		this.steps = plan.steps;
		this.statuses = plan.steps.map(() => 'pending');
		this.reports = [];
		this.finished = false;
	}

	stop() {
		this.generation++;
		this.running = false;
		this.paused = false;
		this.clearMarker();
	}

	private clearMarker() {
		if (this.marker) {
			try {
				mapStore.scene.removeMarker(this.marker);
			} catch {
				// scene may already be reset
			}
			this.marker = null;
		}
	}

	private async waitWhilePaused(gen: number) {
		while (this.paused && this.generation === gen) {
			await new Promise((r) => setTimeout(r, 150));
		}
	}

	async run() {
		if (this.running || !this.steps.length) return;
		const gen = ++this.generation;
		this.running = true;
		this.finished = false;
		this.statuses = this.steps.map(() => 'pending');
		this.reports = [];

		for (let i = 0; i < this.steps.length; i++) {
			if (this.generation !== gen) return;
			await this.waitWhilePaused(gen);
			if (this.generation !== gen) return;

			this.statuses = this.statuses.map((s, j) => (j === i ? 'active' : j < i ? 'done' : 'pending'));
			await this.execute(this.steps[i]);
			// hold so the viewer can absorb the move
			await new Promise((r) => setTimeout(r, this.steps[i].tool === 'flyTo' ? 2600 : 1700));
		}
		if (this.generation !== gen) return;
		this.statuses = this.statuses.map(() => 'done');
		this.running = false;
		this.finished = true;
	}

	private async execute(step: PlanStep): Promise<void> {
		const a = step.args as Record<string, never>;
		switch (step.tool) {
			case 'flyTo': {
				const center = a['center'] as unknown as [number, number] | undefined;
				const zoom = a['zoom'] as unknown as number | undefined;
				if (center && typeof zoom === 'number') {
					await mapStore.flyTo({ center, zoom }, 2200);
				}
				break;
			}
			case 'setFilter': {
				const layer = String(a['layer'] ?? 'flood-zones');
				const filter = (a['filter'] ?? null) as never;
				mapStore.scene.setFilter(layer, filter);
				// keep outlines in sync with the fill layer (cartographic nicety)
				if (layer === 'flood-zones') mapStore.scene.setFilter('flood-zones-outline', filter);
				if (layer === 'landuse-fill') mapStore.scene.setFilter('landuse-outline', filter);
				break;
			}
			case 'toggleLayer': {
				const layer = String(a['layer'] ?? '');
				const visible = a['visible'] !== false;
				mapStore.scene.setLayout(layer, 'visibility', visible ? 'visible' : 'none');
				break;
			}
			case 'highlight': {
				const center = a['center'] as unknown as [number, number] | undefined;
				if (center) {
					this.clearMarker();
					const el = document.createElement('div');
					el.className = 'pulse-marker';
					this.marker = mapStore.scene.addMarker(
						new maplibregl.Marker({ element: el }).setLngLat(center)
					);
				}
				break;
			}
			case 'report': {
				const text = String(a['text'] ?? '');
				if (text) this.reports = [...this.reports, text];
				break;
			}
		}
	}
}
