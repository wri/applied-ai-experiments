import type { ToolEntry } from '../types';
import { mapStore, type GeoJSONFeatureCollection } from '../../stores/map.svelte';
import { bbox } from '@turf/bbox';

type LngLat = [number, number];

// Infer the MapLibre layer kind + the paint key used for fills/colors
function inferKind(data: GeoJSONFeatureCollection): 'fill' | 'line' | 'circle' {
  const t = data.features.find((f) => f.geometry)?.geometry?.type ?? '';
  if (t.includes('Polygon')) return 'fill';
  if (t.includes('LineString')) return 'line';
  return 'circle';
}

function colorKey(kind: 'fill' | 'line' | 'circle'): string {
  return kind === 'fill' ? 'fill-color' : kind === 'line' ? 'line-color' : 'circle-color';
}

function fitToData(data: GeoJSONFeatureCollection) {
  try {
    const [w, s, e, n] = bbox(data as never);
    if ([w, s, e, n].every((v) => Number.isFinite(v))) {
      mapStore.fitBounds([[w, s], [e, n]], { padding: 40 });
    }
  } catch {
    /* non-fatal: leave the view where it is */
  }
}

export const dataTools: ToolEntry[] = [
  {
    definition: {
      name: 'add_markers',
      description:
        'Drop one or more labeled markers on the map. Each marker can have a label and description shown in a popup on click. Useful for plotting a set of places you have geocoded or generated.',
      parameters: {
        type: 'object',
        properties: {
          markers: {
            type: 'array',
            description:
              'List of markers, each { lng, lat, label?, description? }. lng/lat are required numbers.',
            items: { type: 'object' },
          },
          fit: {
            type: 'boolean',
            description: 'Whether to zoom the map to fit all current markers',
            default: true,
          },
        },
        required: ['markers'],
      },
    },
    handler: async (args) => {
      const input = args.markers as Array<Record<string, unknown>>;
      if (!Array.isArray(input) || input.length === 0) {
        throw new Error('markers must be a non-empty array');
      }
      const markers = input.map((m, i) => {
        const lng = Number(m.lng);
        const lat = Number(m.lat);
        if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
          throw new Error(`markers[${i}] needs numeric lng and lat`);
        }
        return {
          lng,
          lat,
          label: m.label != null ? String(m.label) : undefined,
          description: m.description != null ? String(m.description) : undefined,
        };
      });

      const total = mapStore.addMarkers(markers);

      if (args.fit !== false && markers.length > 0) {
        const lngs = markers.map((m) => m.lng);
        const lats = markers.map((m) => m.lat);
        mapStore.fitBounds(
          [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
          { padding: 60 }
        );
      }

      return { added: markers.length, totalMarkers: total };
    },
  },

  {
    definition: {
      name: 'clear_markers',
      description: 'Remove all markers currently on the map.',
      parameters: { type: 'object', properties: {} },
    },
    handler: async () => {
      const removed = mapStore.clearMarkers();
      return { success: true, removed, message: `Removed ${removed} marker(s)` };
    },
  },

  {
    definition: {
      name: 'add_data_layer',
      description:
        'Add a GeoJSON data layer to the map, either from a bundled dataset or from inline GeoJSON. Bundled dataset keys: "countries" (world boundaries with name, iso_a3, continent, region, pop_est, gdp_md). The layer can then be styled (style_data_layer), filtered (filter_data_layer), or queried (query_at_point).',
      parameters: {
        type: 'object',
        properties: {
          dataset: {
            type: 'string',
            description: 'A bundled dataset key to load, e.g. "countries".',
          },
          geojson: {
            type: 'object',
            description: 'Inline GeoJSON FeatureCollection to add instead of a bundled dataset.',
          },
          id: {
            type: 'string',
            description: 'Layer id (defaults to the dataset key or "custom-layer"). Reusing an id replaces the layer.',
          },
          label: { type: 'string', description: 'Human-readable label for the layer list.' },
          fit: {
            type: 'boolean',
            description: 'Whether to zoom the map to the layer extent',
            default: true,
          },
        },
        required: [],
      },
    },
    handler: async (args) => {
      let data: GeoJSONFeatureCollection;
      let datasetKey: string | undefined;

      if (args.dataset) {
        datasetKey = String(args.dataset);
        data = await mapStore.loadDataset(datasetKey);
      } else if (args.geojson) {
        data = args.geojson as GeoJSONFeatureCollection;
        if (data?.type !== 'FeatureCollection' || !Array.isArray(data.features)) {
          throw new Error('geojson must be a FeatureCollection');
        }
      } else {
        throw new Error('Provide either a dataset key or inline geojson');
      }

      const id = String(args.id ?? datasetKey ?? 'custom-layer');
      const kind = inferKind(data);
      const meta = mapStore.addGeoJSONLayer({
        id,
        data,
        kind,
        datasetKey,
        label: args.label ? String(args.label) : datasetKey ?? id,
      });

      if (args.fit !== false) fitToData(data);

      // Surface available numeric/string properties to help the model style/filter
      const sample = data.features[0]?.properties ?? {};
      const properties = Object.keys(sample);

      return {
        layerId: meta.id,
        kind: meta.kind,
        featureCount: meta.featureCount,
        properties,
      };
    },
  },

  {
    definition: {
      name: 'style_data_layer',
      description:
        'Color a data layer as a choropleth by a numeric property (e.g. pop_est, gdp_md). Computes quantile breaks and applies a graduated color ramp. Returns the legend (breaks + colors).',
      parameters: {
        type: 'object',
        properties: {
          layerId: { type: 'string', description: 'The id of a layer added with add_data_layer.' },
          property: { type: 'string', description: 'Numeric feature property to color by.' },
          classes: {
            type: 'number',
            description: 'Number of color classes (3-5).',
            minimum: 3,
            maximum: 5,
            default: 5,
          },
        },
        required: ['layerId', 'property'],
      },
    },
    handler: async (args) => {
      const layerId = String(args.layerId);
      const property = String(args.property);
      const layer = mapStore.getManagedLayer(layerId);
      const data = mapStore.getManagedData(layerId);
      if (!layer || !data) throw new Error(`Data layer "${layerId}" not found`);

      const values = data.features
        .map((f) => Number((f.properties ?? {})[property]))
        .filter((v) => Number.isFinite(v))
        .sort((a, b) => a - b);
      if (values.length === 0) {
        throw new Error(`Property "${property}" has no numeric values on layer "${layerId}"`);
      }

      const ramp = mapStore.choroplethRamp;
      const classes = Math.min(Math.max(Number(args.classes ?? 5), 3), ramp.length);
      const colors = ramp.slice(0, classes);

      // Quantile breaks (the values that separate the classes)
      const breaks: number[] = [];
      for (let i = 1; i < classes; i++) {
        const q = values[Math.floor((i / classes) * (values.length - 1))];
        breaks.push(round(q));
      }

      // MapLibre step expression: step(input, color0, break1, color1, break2, color2, ...)
      const expr: unknown[] = ['step', ['to-number', ['get', property], 0], colors[0]];
      for (let i = 0; i < breaks.length; i++) {
        expr.push(breaks[i], colors[i + 1]);
      }

      mapStore.setPaint(layerId, colorKey(layer.kind), expr);
      if (layer.kind === 'fill') mapStore.setPaint(layerId, 'fill-opacity', 0.7);

      const legend = colors.map((color, i) => ({
        color,
        min: i === 0 ? round(values[0]) : breaks[i - 1],
        max: i < breaks.length ? breaks[i] : round(values[values.length - 1]),
      }));

      return { layerId, property, classes, legend };
    },
  },

  {
    definition: {
      name: 'filter_data_layer',
      description:
        'Show only the features of a data layer that match a condition on a property. Pass value=null (or omit op) to clear the filter and show everything.',
      parameters: {
        type: 'object',
        properties: {
          layerId: { type: 'string', description: 'The id of a layer added with add_data_layer.' },
          property: { type: 'string', description: 'Feature property to filter on.' },
          op: {
            type: 'string',
            description: 'Comparison operator',
            enum: ['==', '!=', '>', '>=', '<', '<=', 'in'],
          },
          value: {
            type: 'string',
            description:
              'Value to compare against (number or string). For op "in", pass an array of allowed values.',
          },
        },
        required: ['layerId'],
      },
    },
    handler: async (args) => {
      const layerId = String(args.layerId);
      if (!mapStore.getManagedLayer(layerId)) throw new Error(`Data layer "${layerId}" not found`);

      // Clear filter
      if (args.value === null || args.value === undefined || !args.op) {
        mapStore.setFilter(layerId, null);
        return { layerId, filter: null, message: 'Filter cleared' };
      }

      const property = String(args.property);
      const op = String(args.op);
      let filter: unknown[];

      if (op === 'in') {
        const list = Array.isArray(args.value) ? args.value : [args.value];
        filter = ['in', ['get', property], ['literal', list]];
      } else {
        filter = [op, ['get', property], args.value];
      }

      mapStore.setFilter(layerId, filter as never);
      return { layerId, filter, message: `Filtered ${layerId} where ${property} ${op} ${JSON.stringify(args.value)}` };
    },
  },
];

function round(n: number, dp = 2): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

export type { LngLat };
