/**
 * Semantic validation + reversible application of StylePatches.
 */

import type { Scene } from '$lib/map/MapStore.svelte';
import type { FilterSpecification } from 'maplibre-gl';
import {
	LAYOUT_PROPERTIES,
	PAINT_PROPERTIES,
	type StyleOp,
	type StylePatch
} from './schema';

const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

function isColorValue(v: unknown): boolean {
	if (typeof v === 'string') return HEX_RE.test(v) || v.startsWith('rgb') || v.startsWith('hsl');
	// allow expressions (match/case/interpolate/step) — validated shallowly
	return Array.isArray(v) && typeof v[0] === 'string';
}

/** Beyond-schema checks: value types per property. Returns error strings. */
export function semanticErrors(patch: StylePatch): string[] {
	const errors: string[] = [];
	patch.ops.forEach((op, i) => {
		const at = `ops[${i}]`;
		if (op.op === 'setPaint') {
			if (!op.property || !(PAINT_PROPERTIES as readonly string[]).includes(op.property)) {
				errors.push(`${at}: setPaint requires a whitelisted paint property`);
				return;
			}
			if (op.property.endsWith('color') && !isColorValue(op.value)) {
				errors.push(`${at}: ${op.property} needs a CSS color or expression`);
			}
			if (
				(op.property.endsWith('opacity') || op.property.endsWith('width')) &&
				typeof op.value !== 'number' &&
				!Array.isArray(op.value)
			) {
				errors.push(`${at}: ${op.property} needs a number or expression`);
			}
			if (op.property.endsWith('opacity') && typeof op.value === 'number') {
				if (op.value < 0 || op.value > 1) errors.push(`${at}: opacity must be 0-1`);
			}
		} else if (op.op === 'setLayout') {
			if (!op.property || !(LAYOUT_PROPERTIES as readonly string[]).includes(op.property)) {
				errors.push(`${at}: setLayout requires a whitelisted layout property`);
			} else if (op.property === 'visibility' && op.value !== 'visible' && op.value !== 'none') {
				errors.push(`${at}: visibility must be "visible" or "none"`);
			}
		} else if (op.op === 'setFilter') {
			if (op.value !== null && !Array.isArray(op.value)) {
				errors.push(`${at}: setFilter value must be a filter expression array or null`);
			}
		}
	});
	return errors;
}

export interface AppliedPatch {
	patch: StylePatch;
	revert: () => void;
}

/** Apply a validated patch, capturing previous values for revert. */
export function applyPatch(scene: Scene, patch: StylePatch): AppliedPatch {
	const undos: (() => void)[] = [];
	const map = scene.map;
	for (const op of patch.ops) {
		if (!scene.hasLayer(op.layer)) continue;
		if (op.op === 'setPaint' && op.property) {
			const prev = map.getPaintProperty(op.layer, op.property as never);
			scene.setPaint(op.layer, op.property, op.value);
			undos.push(() => scene.setPaint(op.layer, op.property!, prev));
		} else if (op.op === 'setLayout' && op.property) {
			const prev = map.getLayoutProperty(op.layer, op.property as never);
			scene.setLayout(op.layer, op.property, op.value ?? 'visible');
			undos.push(() => scene.setLayout(op.layer, op.property!, prev ?? 'visible'));
		} else if (op.op === 'setFilter') {
			const prev = map.getFilter(op.layer) ?? null;
			scene.setFilter(op.layer, op.value as FilterSpecification | null);
			undos.push(() => scene.setFilter(op.layer, prev));
		}
	}
	return {
		patch,
		revert: () => {
			for (const undo of [...undos].reverse()) undo();
		}
	};
}

export function describeOp(op: StyleOp): string {
	if (op.op === 'setFilter') {
		return `${op.layer} · filter ${op.value === null ? 'cleared' : JSON.stringify(op.value)}`;
	}
	return `${op.layer} · ${op.property} → ${JSON.stringify(op.value)}`;
}
