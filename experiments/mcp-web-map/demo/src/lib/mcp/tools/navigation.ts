import type { ToolEntry } from '../types';
import { mapStore } from '../../stores/map.svelte';

export const navigationTools: ToolEntry[] = [
  {
    definition: {
      name: 'fly_to',
      description: 'Animate the map to a specific location with optional zoom, bearing, and pitch',
      parameters: {
        type: 'object',
        properties: {
          center: {
            type: 'array',
            description: 'Target coordinates as [longitude, latitude]',
            items: { type: 'number' },
          },
          zoom: {
            type: 'number',
            description: 'Target zoom level (0-22)',
            minimum: 0,
            maximum: 22,
          },
          bearing: {
            type: 'number',
            description: 'Target bearing in degrees (0-360)',
            minimum: 0,
            maximum: 360,
          },
          pitch: {
            type: 'number',
            description: 'Target pitch in degrees (0-85)',
            minimum: 0,
            maximum: 85,
          },
          duration: {
            type: 'number',
            description: 'Animation duration in milliseconds',
            default: 2000,
          },
        },
        required: ['center'],
      },
    },
    handler: async (args) => {
      const center = args.center as [number, number];
      const zoom = args.zoom as number | undefined;
      const bearing = args.bearing as number | undefined;
      const pitch = args.pitch as number | undefined;
      const duration = args.duration as number | undefined;

      // Validate center coordinates
      if (!Array.isArray(center) || center.length !== 2) {
        throw new Error('center must be an array of [longitude, latitude]');
      }
      if (typeof center[0] !== 'number' || typeof center[1] !== 'number') {
        throw new Error('center coordinates must be numbers');
      }
      if (center[0] < -180 || center[0] > 180 || center[1] < -90 || center[1] > 90) {
        throw new Error('center coordinates out of range');
      }

      mapStore.flyTo({ center, zoom, bearing, pitch, duration });

      return {
        success: true,
        message: `Flying to [${center[0].toFixed(4)}, ${center[1].toFixed(4)}]${zoom ? ` at zoom ${zoom}` : ''}`,
      };
    },
  },

  {
    definition: {
      name: 'fit_bounds',
      description: 'Fit the map view to contain a bounding box',
      parameters: {
        type: 'object',
        properties: {
          bounds: {
            type: 'array',
            description: 'Bounding box as [west, south, east, north]',
            items: { type: 'number' },
          },
          padding: {
            type: 'number',
            description: 'Padding in pixels around the bounds',
            default: 50,
          },
        },
        required: ['bounds'],
      },
    },
    handler: async (args) => {
      const bounds = args.bounds as [number, number, number, number];
      const padding = args.padding as number | undefined;

      mapStore.fitBounds(
        [[bounds[0], bounds[1]], [bounds[2], bounds[3]]],
        { padding }
      );

      return {
        success: true,
        message: `Fitting bounds: [${bounds.map((b) => b.toFixed(4)).join(', ')}]`,
      };
    },
  },

  {
    definition: {
      name: 'get_view',
      description: 'Get the current map view state including center, zoom, bearing, and pitch',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
    handler: async () => {
      const view = mapStore.view;
      return {
        center: view.center,
        zoom: view.zoom,
        bearing: view.bearing,
        pitch: view.pitch,
      };
    },
  },
];
