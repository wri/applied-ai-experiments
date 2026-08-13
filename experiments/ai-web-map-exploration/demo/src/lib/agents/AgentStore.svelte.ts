/**
 * Shared agent/task model for the two agentic demos. One store instance per
 * demo (constructed with its script) so scenes don't leak between demos.
 * Selection lives here so it survives the kanban ↔ map view switch — that
 * continuity is the design probe.
 */

export type AgentStatus = 'queued' | 'working' | 'review' | 'done';

export const STATUS_ORDER: AgentStatus[] = ['queued', 'working', 'review', 'done'];

export const STATUS_LABELS: Record<AgentStatus, string> = {
	queued: 'Queued',
	working: 'Working',
	review: 'Review',
	done: 'Done'
};

/** Status colors on the map (design-system status hues) */
export const STATUS_COLORS: Record<AgentStatus, string> = {
	queued: '#706a64',
	working: '#d97706',
	review: '#0284c7',
	done: '#16a34a'
};

/**
 * Typed asset payloads — what makes an asset a first-class inspectable object
 * rather than a chip with a label. The demo owns layer semantics: `layers` is
 * a demo-interpreted vocabulary (the agentic demos use the MapCite keys
 * flood: none|current|projected|both, farms: none|all|exposed).
 */
export type AssetPayload =
	| {
			type: 'map-state';
			camera: { center: [number, number]; zoom: number };
			layers: Record<string, string>;
			note?: string;
	  }
	| { type: 'stats'; rows: [string, string][]; caption?: string }
	| { type: 'notes'; markdown: string };

export interface AgentAsset {
	id: string;
	name: string;
	kind: 'layer' | 'stats' | 'map-state' | 'notes';
	detail?: string;
	payload?: AssetPayload;
}

export interface LogEntry {
	at: string;
	msg: string;
}

export interface AgentTask {
	id: string;
	name: string;
	role: 'retrieval' | 'analysis' | 'cartography' | 'critique' | 'survey' | 'monitoring';
	description: string;
	status: AgentStatus;
	/** area of interest [w, s, e, n] */
	aoi: [number, number, number, number];
	assets: AgentAsset[];
	log: LogEntry[];
	dependsOn?: string[];
}

export class AgentStore {
	tasks = $state<AgentTask[]>([]);
	selectedId = $state<string | null>(null);
	/** Asset currently open in the AssetViewer (survives view switches). */
	openAsset = $state<{ taskId: string; assetId: string } | null>(null);

	private initial: AgentTask[] = [];

	constructor(tasks: AgentTask[]) {
		this.initial = tasks;
		this.reset();
	}

	reset() {
		this.tasks = this.initial.map((t) => ({
			...t,
			assets: [...t.assets],
			log: [...t.log]
		}));
		this.selectedId = null;
		this.openAsset = null;
	}

	get selected(): AgentTask | null {
		return this.tasks.find((t) => t.id === this.selectedId) ?? null;
	}

	get openedAsset(): { task: AgentTask; asset: AgentAsset } | null {
		if (!this.openAsset) return null;
		const task = this.task(this.openAsset.taskId);
		const asset = task?.assets.find((a) => a.id === this.openAsset?.assetId);
		return task && asset ? { task, asset } : null;
	}

	task(id: string): AgentTask | undefined {
		return this.tasks.find((t) => t.id === id);
	}

	private update(id: string, fn: (t: AgentTask) => AgentTask) {
		this.tasks = this.tasks.map((t) => (t.id === id ? fn(t) : t));
	}

	setStatus(id: string, status: AgentStatus) {
		this.update(id, (t) => ({ ...t, status }));
	}

	appendLog(id: string, msg: string) {
		const at = new Date().toLocaleTimeString();
		this.update(id, (t) => ({ ...t, log: [...t.log, { at, msg }] }));
	}

	attachAsset(id: string, asset: AgentAsset) {
		this.update(id, (t) => ({
			...t,
			assets: t.assets.some((a) => a.id === asset.id) ? t.assets : [...t.assets, asset]
		}));
	}

	/** The plan's dependsOn graph as LineStrings between AOI centroids. */
	dependencyEdges(): GeoJSON.FeatureCollection {
		const centroid = (t: AgentTask): [number, number] => [
			(t.aoi[0] + t.aoi[2]) / 2,
			(t.aoi[1] + t.aoi[3]) / 2
		];
		const features: GeoJSON.Feature[] = [];
		for (const t of this.tasks) {
			for (const dep of t.dependsOn ?? []) {
				const from = this.task(dep);
				if (!from) continue;
				features.push({
					type: 'Feature',
					properties: { from: from.id, to: t.id },
					geometry: { type: 'LineString', coordinates: [centroid(from), centroid(t)] }
				});
			}
		}
		return { type: 'FeatureCollection', features };
	}

	aoiPolygons(): GeoJSON.FeatureCollection {
		return {
			type: 'FeatureCollection',
			features: this.tasks.map((t) => {
				const [w, s, e, n] = t.aoi;
				return {
					type: 'Feature',
					properties: { id: t.id, name: t.name, status: t.status },
					geometry: {
						type: 'Polygon',
						coordinates: [
							[
								[w, s],
								[e, s],
								[e, n],
								[w, n],
								[w, s]
							]
						]
					}
				};
			})
		};
	}
}
