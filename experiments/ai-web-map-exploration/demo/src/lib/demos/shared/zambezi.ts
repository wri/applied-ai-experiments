/**
 * Shared hover config for the Zambezi smallholder-farm layers. The three
 * agentic demos render the same zambezi-farms.geojson under different layer
 * ids, so the config is parameterized.
 */

import { fmtHa, fmtMeters, humanize, type HoverLayerConfig } from '$lib/map/hover';

export function farmHoverConfig(layerId: string): HoverLayerConfig[] {
	return [
		{
			layerId,
			title: (p) => String(p.name ?? 'Farm site'),
			hitPad: 5,
			fields: [
				{ prop: 'crop', label: 'crop', format: humanize },
				{ prop: 'area_ha', label: 'area', format: fmtHa },
				{ prop: 'households', label: 'households' },
				{ prop: 'dist_river_m', label: 'river distance', format: fmtMeters },
				{ prop: 'flood_exposure', label: 'exposure', format: humanize }
			]
		}
	];
}
