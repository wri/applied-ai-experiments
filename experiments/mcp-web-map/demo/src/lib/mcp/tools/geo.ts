import type { ToolEntry } from '../types';
import { mapStore, type GeoJSONFeature } from '../../stores/map.svelte';
import { distance } from '@turf/distance';
import { area } from '@turf/area';
import { booleanPointInPolygon } from '@turf/boolean-point-in-polygon';
import { point, polygon } from '@turf/helpers';

type LngLat = [number, number];

function asLngLat(value: unknown, label = 'coordinate'): LngLat {
  if (!Array.isArray(value) || value.length !== 2 || typeof value[0] !== 'number' || typeof value[1] !== 'number') {
    throw new Error(`${label} must be [longitude, latitude]`);
  }
  const [lng, lat] = value as LngLat;
  if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
    throw new Error(`${label} out of range: [${lng}, ${lat}]`);
  }
  return [lng, lat];
}

export const geoTools: ToolEntry[] = [
  {
    definition: {
      name: 'search_place',
      description:
        'Geocode a place name into coordinates using OpenStreetMap Nominatim. Returns candidate locations with center coordinates and bounding boxes. Use the result to call fly_to or fit_bounds — this tool does not move the map itself.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Place name to search for, e.g. "Nairobi, Kenya" or "Yosemite National Park"',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of candidates to return (1-10)',
            minimum: 1,
            maximum: 10,
            default: 5,
          },
        },
        required: ['query'],
      },
    },
    handler: async (args) => {
      const query = String(args.query ?? '').trim();
      if (!query) throw new Error('query is required');
      const limit = Math.min(Math.max(Number(args.limit ?? 5), 1), 10);

      const url =
        `https://nominatim.openstreetmap.org/search?format=jsonv2` +
        `&accept-language=en&limit=${limit}&q=${encodeURIComponent(query)}`;

      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) {
        throw new Error(`Geocoding failed (HTTP ${res.status}). Nominatim rate-limits to ~1 req/sec.`);
      }
      const raw = (await res.json()) as Array<Record<string, unknown>>;

      const results = raw.map((r) => {
        const lng = Number(r.lon);
        const lat = Number(r.lat);
        // Nominatim boundingbox = [south, north, west, east]
        const bb = (r.boundingbox as string[] | undefined)?.map(Number);
        const bbox = bb && bb.length === 4 ? [bb[2], bb[0], bb[3], bb[1]] : undefined; // [west,south,east,north]
        return {
          name: r.display_name as string,
          center: [lng, lat] as LngLat,
          bbox,
          category: r.category as string | undefined,
          type: r.type as string | undefined,
        };
      });

      if (results.length === 0) {
        return { query, count: 0, results: [], message: `No matches found for "${query}"` };
      }
      return { query, count: results.length, results };
    },
  },

  {
    definition: {
      name: 'measure',
      description:
        'Compute the great-circle distance along a path of points (km), or the area of a polygon (km²), using turf.js. Provide coordinates as [longitude, latitude] pairs.',
      parameters: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            description: 'What to measure',
            enum: ['distance', 'area'],
          },
          coordinates: {
            type: 'array',
            description:
              'For distance: an ordered list of [lng,lat] points (>=2). For area: the polygon ring as a list of [lng,lat] points (>=3).',
            items: { type: 'array' },
          },
        },
        required: ['type', 'coordinates'],
      },
    },
    handler: async (args) => {
      const type = String(args.type);
      const coords = args.coordinates as unknown[];
      if (!Array.isArray(coords) || coords.length < 2) {
        throw new Error('coordinates must be an array of at least 2 [lng,lat] points');
      }
      const pts = coords.map((c, i) => asLngLat(c, `coordinates[${i}]`));

      if (type === 'distance') {
        let total = 0;
        const segments: Array<{ from: LngLat; to: LngLat; km: number }> = [];
        for (let i = 1; i < pts.length; i++) {
          const km = distance(point(pts[i - 1]), point(pts[i]), { units: 'kilometers' });
          segments.push({ from: pts[i - 1], to: pts[i], km: round(km) });
          total += km;
        }
        return { type, totalKm: round(total), totalMiles: round(total * 0.621371), segments };
      }

      if (type === 'area') {
        if (pts.length < 3) throw new Error('area requires at least 3 points');
        const ring = [...pts];
        // Close the ring if the caller didn't
        if (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1]) {
          ring.push(ring[0]);
        }
        const sqMeters = area(polygon([ring]));
        return {
          type,
          areaKm2: round(sqMeters / 1_000_000),
          areaHectares: round(sqMeters / 10_000),
        };
      }

      throw new Error(`Unknown measure type: ${type}`);
    },
  },

  {
    definition: {
      name: 'query_at_point',
      description:
        'Identify which feature of a loaded dataset or data layer contains a point (for polygons), or the nearest feature (for points). Defaults to the current map center if no point is given. Returns the matching feature properties.',
      parameters: {
        type: 'object',
        properties: {
          point: {
            type: 'array',
            description: 'Query point as [longitude, latitude]. Defaults to the current map center.',
            items: { type: 'number' },
          },
          dataset: {
            type: 'string',
            description: 'A bundled dataset key (e.g. "countries") to query.',
          },
          layerId: {
            type: 'string',
            description: 'Alternatively, the id of a data layer already added with add_data_layer.',
          },
        },
        required: [],
      },
    },
    handler: async (args) => {
      const queryPoint: LngLat = args.point
        ? asLngLat(args.point, 'point')
        : (mapStore.view.center as LngLat);

      let features: GeoJSONFeature[] | undefined;
      let source = '';
      if (args.layerId) {
        features = mapStore.getManagedData(String(args.layerId))?.features;
        source = `layer "${args.layerId}"`;
      } else {
        const key = String(args.dataset ?? 'countries');
        features = (await mapStore.loadDataset(key)).features;
        source = `dataset "${key}"`;
      }
      if (!features || features.length === 0) {
        throw new Error(`No features available to query from ${source}`);
      }

      const geomType = features[0].geometry?.type ?? '';
      const turfPoint = point(queryPoint);

      if (geomType.includes('Polygon')) {
        const matches = features.filter(
          (f) => f.geometry && booleanPointInPolygon(turfPoint, f as never)
        );
        return {
          point: queryPoint,
          source,
          matchCount: matches.length,
          matches: matches.map((f) => f.properties),
        };
      }

      // Point dataset → nearest feature
      const pointFeatures = features.filter((f) => f.geometry?.type === 'Point');
      if (pointFeatures.length === 0) {
        throw new Error(`${source} has unsupported geometry for query_at_point`);
      }
      let best: { props: unknown; km: number } | null = null;
      for (const f of pointFeatures) {
        const coord = (f.geometry as { coordinates: LngLat }).coordinates;
        const km = distance(turfPoint, point(coord), { units: 'kilometers' });
        if (!best || km < best.km) best = { props: f.properties, km: round(km) };
      }
      return { point: queryPoint, source, nearest: best?.props, distanceKm: best?.km };
    },
  },
];

function round(n: number, dp = 2): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}
