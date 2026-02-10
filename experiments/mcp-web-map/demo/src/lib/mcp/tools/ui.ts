import type { ToolEntry } from '../types';
import { mapStore } from '../../stores/map.svelte';
import { copyShareableUrl } from '../../stores/url.svelte';
import maplibregl from 'maplibre-gl';

// Keep track of current popup for cleanup
let currentPopup: maplibregl.Popup | null = null;

export const uiTools: ToolEntry[] = [
  {
    definition: {
      name: 'show_popup',
      description: 'Display a popup on the map at a specific location',
      parameters: {
        type: 'object',
        properties: {
          lngLat: {
            type: 'array',
            description: 'Coordinates as [longitude, latitude]',
            items: { type: 'number' },
          },
          content: {
            type: 'string',
            description: 'HTML content to display in the popup',
          },
          closeButton: {
            type: 'boolean',
            description: 'Whether to show a close button',
            default: true,
          },
        },
        required: ['lngLat', 'content'],
      },
    },
    handler: async (args) => {
      const lngLat = args.lngLat as [number, number];
      const content = args.content as string;
      const closeButton = args.closeButton !== false;

      const map = mapStore.getMap();
      if (!map) {
        throw new Error('Map not initialized');
      }

      // Close existing popup
      if (currentPopup) {
        currentPopup.remove();
      }

      // Create new popup
      currentPopup = new maplibregl.Popup({
        closeButton,
        closeOnClick: true,
      })
        .setLngLat(lngLat)
        .setHTML(content)
        .addTo(map);

      return {
        success: true,
        message: `Popup displayed at [${lngLat[0].toFixed(4)}, ${lngLat[1].toFixed(4)}]`,
      };
    },
  },

  {
    definition: {
      name: 'close_popup',
      description: 'Close the current popup',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
    handler: async () => {
      if (currentPopup) {
        currentPopup.remove();
        currentPopup = null;
        return { success: true, message: 'Popup closed' };
      }
      return { success: true, message: 'No popup to close' };
    },
  },

  {
    definition: {
      name: 'highlight',
      description: 'Highlight features on the map by their IDs',
      parameters: {
        type: 'object',
        properties: {
          featureIds: {
            type: 'array',
            description: 'Array of feature IDs to highlight',
            items: { type: 'string' },
          },
          sourceId: {
            type: 'string',
            description: 'The source layer containing the features',
          },
        },
        required: ['featureIds', 'sourceId'],
      },
    },
    handler: async (args) => {
      const featureIds = args.featureIds as string[];
      const sourceId = args.sourceId as string;

      mapStore.setHighlight(featureIds, sourceId);

      return {
        success: true,
        message: `Highlighting ${featureIds.length} feature(s) from source "${sourceId}"`,
      };
    },
  },

  {
    definition: {
      name: 'clear_highlight',
      description: 'Remove all feature highlights from the map',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
    handler: async () => {
      mapStore.clearHighlight();
      return { success: true, message: 'Highlights cleared' };
    },
  },

  {
    definition: {
      name: 'copy_link',
      description: 'Copy a shareable URL to the clipboard that captures the current map view',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
    handler: async () => {
      const success = await copyShareableUrl();

      if (success) {
        return {
          success: true,
          message: 'Shareable link copied to clipboard!',
        };
      } else {
        throw new Error('Failed to copy link to clipboard');
      }
    },
  },
];
