export interface EmbPoint {
	id: string;
	name: string;
	category: string;
	ex: number;
	ey: number;
	lon: number;
	lat: number;
}

/**
 * The top place categories (by count) in the real Overture Can Tho extract —
 * points-embeddings.geojson is rebuilt from real places by extract-overture.ts;
 * only the embedding axes are modelled.
 */
export const CATEGORY_COLORS: Record<string, string> = {
	restaurant: '#e05e4e',
	coffee_shop: '#b08350',
	personal_or_beauty_service: '#a855f7',
	fashion_and_apparel_store: '#ec4899',
	hotel: '#38bdf8'
};

export function toPoints(fc: GeoJSON.FeatureCollection): EmbPoint[] {
	return fc.features.map((f) => {
		const p = f.properties as Record<string, unknown>;
		const [lon, lat] = (f.geometry as GeoJSON.Point).coordinates;
		return {
			id: String(p.id),
			name: String(p.name),
			category: String(p.category),
			ex: Number(p.ex),
			ey: Number(p.ey),
			lon,
			lat
		};
	});
}

export function categoryColorExpression(): unknown {
	return [
		'match',
		['get', 'category'],
		...Object.entries(CATEGORY_COLORS).flat(),
		'#888888'
	];
}
