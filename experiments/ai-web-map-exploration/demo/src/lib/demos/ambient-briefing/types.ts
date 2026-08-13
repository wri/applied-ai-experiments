export interface SavedRegion {
	id: string;
	name: string;
	bbox: [number, number, number, number];
	layers: string[];
	note: string;
}

export interface ChangeEvent {
	id: string;
	regionId: string;
	type: 'flood_alert' | 'deforestation' | 'new_imagery' | 'layer_update' | 'anomaly';
	severity: number;
	title: string;
	detail: string;
	timestamp: string;
	location: [number, number];
	zoom: number;
}

export const EVENT_TYPE_LABELS: Record<ChangeEvent['type'], string> = {
	flood_alert: 'flood alert',
	deforestation: 'forest loss',
	new_imagery: 'new imagery',
	layer_update: 'layer update',
	anomaly: 'anomaly'
};
