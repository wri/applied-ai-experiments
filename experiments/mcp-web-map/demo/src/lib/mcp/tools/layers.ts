import type { ToolEntry } from '../types';
import { mapStore } from '../../stores/map.svelte';

export const layerTools: ToolEntry[] = [
  {
    definition: {
      name: 'list_layers',
      description: 'List all available map layers with their visibility status',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
    handler: async () => {
      const layers = mapStore.layers;
      return {
        layers: layers.map((l) => ({
          id: l.id,
          type: l.type,
          visible: l.visible,
        })),
        count: layers.length,
      };
    },
  },

  {
    definition: {
      name: 'set_visibility',
      description: 'Set the visibility of a map layer',
      parameters: {
        type: 'object',
        properties: {
          layerId: {
            type: 'string',
            description: 'The ID of the layer to modify',
          },
          visible: {
            type: 'boolean',
            description: 'Whether the layer should be visible',
          },
        },
        required: ['layerId', 'visible'],
      },
    },
    handler: async (args) => {
      const layerId = args.layerId as string;
      const visible = args.visible as boolean;

      // Check if layer exists
      const layer = mapStore.layers.find((l) => l.id === layerId);
      if (!layer) {
        throw new Error(`Layer "${layerId}" not found`);
      }

      mapStore.setLayerVisibility(layerId, visible);

      return {
        success: true,
        message: `Layer "${layerId}" is now ${visible ? 'visible' : 'hidden'}`,
      };
    },
  },

  {
    definition: {
      name: 'get_layer_info',
      description: 'Get detailed information about a specific layer',
      parameters: {
        type: 'object',
        properties: {
          layerId: {
            type: 'string',
            description: 'The ID of the layer to query',
          },
        },
        required: ['layerId'],
      },
    },
    handler: async (args) => {
      const layerId = args.layerId as string;
      const layer = mapStore.layers.find((l) => l.id === layerId);

      if (!layer) {
        throw new Error(`Layer "${layerId}" not found`);
      }

      return {
        id: layer.id,
        type: layer.type,
        visible: layer.visible,
        source: layer.source,
      };
    },
  },
];
