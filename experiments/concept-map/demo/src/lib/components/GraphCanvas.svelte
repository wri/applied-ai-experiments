<script lang="ts">
	import { Badge } from '@wri-datalab/ui';
	import type { PositionedNode, ConceptEdge } from '../graph/types';

	interface Props {
		nodes: PositionedNode[];
		edges: ConceptEdge[];
		selectedId: string | null;
		onselect: (id: string | null) => void;
	}

	let { nodes, edges, selectedId, onselect }: Props = $props();

	// All SVG styling is via attributes/inline styles (with var() fallbacks)
	// so exported SVG/PNG keeps its appearance outside the page stylesheet.
	const WIDTH = 1200;
	const HEIGHT = 800;
	const NODE_W = 140;
	const NODE_H = 36;
	const PALETTE = [
		'#bfdbfe', // blue
		'#bbf7d0', // green
		'#fde68a', // amber
		'#fbcfe8', // pink
		'#ddd6fe', // violet
		'#fed7aa', // orange
		'#99f6e4', // teal
		'#e5e7eb', // gray
	];

	let svgEl: SVGSVGElement | null = $state(null);
	let viewBox = $state({ x: 0, y: 0, w: WIDTH, h: HEIGHT });
	let hoveredId = $state<string | null>(null);
	let panning = $state(false);
	let last = { x: 0, y: 0 };

	export function getSvg(): SVGSVGElement | null {
		return svgEl;
	}

	const nodeById = $derived(new Map(nodes.map((node) => [node.id, node])));

	/** type → color, assigned in type-first-seen order so it's deterministic */
	const typeColors = $derived.by(() => {
		const colors = new Map<string, string>();
		for (const node of nodes) {
			if (!colors.has(node.type)) {
				colors.set(node.type, PALETTE[colors.size % PALETTE.length]);
			}
		}
		return colors;
	});

	const activeId = $derived(hoveredId ?? selectedId);

	function isConnected(edge: ConceptEdge): boolean {
		return activeId !== null && (edge.source === activeId || edge.target === activeId);
	}

	function truncate(label: string, max = 19): string {
		return label.length > max ? `${label.slice(0, max - 1).trimEnd()}…` : label;
	}

	/** Refit the viewBox whenever the node set / layout changes. */
	$effect(() => {
		fitToContent();
	});

	function fitToContent() {
		if (nodes.length === 0) {
			viewBox = { x: 0, y: 0, w: WIDTH, h: HEIGHT };
			return;
		}
		const pad = 110;
		const xs = nodes.map((node) => node.x);
		const ys = nodes.map((node) => node.y);
		const minX = Math.min(...xs) - pad;
		const maxX = Math.max(...xs) + pad;
		const minY = Math.min(...ys) - pad;
		const maxY = Math.max(...ys) + pad;
		viewBox = { x: minX, y: minY, w: Math.max(maxX - minX, 200), h: Math.max(maxY - minY, 150) };
	}

	// Svelte 5 marks `onwheel` handlers passive, so attach manually to preventDefault.
	$effect(() => {
		const el = svgEl;
		if (!el) return;
		el.addEventListener('wheel', handleWheel, { passive: false });
		return () => el.removeEventListener('wheel', handleWheel);
	});

	function handleWheel(event: WheelEvent) {
		event.preventDefault();
		if (!svgEl) return;
		const factor = event.deltaY > 0 ? 1.1 : 1 / 1.1;
		const w = Math.min(Math.max(viewBox.w * factor, 200), 12000);
		const h = viewBox.h * (w / viewBox.w);
		const rect = svgEl.getBoundingClientRect();
		const px = viewBox.x + ((event.clientX - rect.left) / rect.width) * viewBox.w;
		const py = viewBox.y + ((event.clientY - rect.top) / rect.height) * viewBox.h;
		viewBox = {
			x: px - ((px - viewBox.x) / viewBox.w) * w,
			y: py - ((py - viewBox.y) / viewBox.h) * h,
			w,
			h,
		};
	}

	let travel = 0;

	function handlePointerDown(event: PointerEvent) {
		if (event.button !== 0) return;
		panning = true;
		travel = 0;
		last = { x: event.clientX, y: event.clientY };
		(event.currentTarget as SVGSVGElement).setPointerCapture(event.pointerId);
	}

	function handlePointerMove(event: PointerEvent) {
		if (!panning || !svgEl) return;
		const dx = event.clientX - last.x;
		const dy = event.clientY - last.y;
		travel += Math.abs(dx) + Math.abs(dy);
		const scale = viewBox.w / svgEl.getBoundingClientRect().width;
		viewBox = { ...viewBox, x: viewBox.x - dx * scale, y: viewBox.y - dy * scale };
		last = { x: event.clientX, y: event.clientY };
	}

	function handlePointerUp() {
		if (!panning) return;
		panning = false;
		if (travel < 4) onselect(null); // a background click, not a pan
	}

	function selectNode(event: Event, id: string) {
		event.stopPropagation();
		onselect(id);
	}

	function handleNodeKey(event: KeyboardEvent, id: string) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			onselect(id);
		}
	}
</script>

<div class="canvas-wrap">
	<svg
		bind:this={svgEl}
		viewBox="{viewBox.x} {viewBox.y} {viewBox.w} {viewBox.h}"
		role="application"
		aria-label="Concept map — drag to pan, scroll to zoom, click a node for details"
		style="width: 100%; height: 100%; display: block; cursor: {panning ? 'grabbing' : 'grab'}; touch-action: none;"
		onpointerdown={handlePointerDown}
		onpointermove={handlePointerMove}
		onpointerup={handlePointerUp}
		onpointercancel={handlePointerUp}
	>
		<g>
			{#each edges as edge (`${edge.source}|${edge.target}|${edge.relationship}`)}
				{@const source = nodeById.get(edge.source)}
				{@const target = nodeById.get(edge.target)}
				{#if source && target}
					{@const highlighted = isConnected(edge)}
					<line
						x1={source.x}
						y1={source.y}
						x2={target.x}
						y2={target.y}
						stroke={highlighted ? 'var(--accent, #d97706)' : '#9ca3af'}
						stroke-width={highlighted ? 2.5 : 1.5}
						stroke-opacity={activeId !== null && !highlighted ? 0.35 : 0.8}
					/>
					<text
						x={(source.x + target.x) / 2}
						y={(source.y + target.y) / 2}
						text-anchor="middle"
						dominant-baseline="central"
						font-size="10"
						style="font-family: var(--font-mono, monospace); paint-order: stroke; stroke: var(--bg, #ffffff); stroke-width: 4px; stroke-linejoin: round; fill: {highlighted
							? 'var(--accent, #d97706)'
							: '#6b7280'};"
					>{edge.relationship}</text>
				{/if}
			{/each}
		</g>
		<g>
			{#each nodes as node (node.id)}
				{@const selected = node.id === selectedId}
				{@const hovered = node.id === hoveredId}
				<g
					transform="translate({node.x}, {node.y})"
					role="button"
					tabindex="0"
					aria-label="{node.label} ({node.type})"
					style="cursor: pointer; outline: none;"
					onclick={(event) => selectNode(event, node.id)}
					onkeydown={(event) => handleNodeKey(event, node.id)}
					onpointerdown={(event) => event.stopPropagation()}
					onpointerenter={() => (hoveredId = node.id)}
					onpointerleave={() => (hoveredId = null)}
					onfocus={() => (hoveredId = node.id)}
					onblur={() => (hoveredId = null)}
				>
					<rect
						x={-NODE_W / 2}
						y={-NODE_H / 2}
						width={NODE_W}
						height={NODE_H}
						rx="10"
						fill={typeColors.get(node.type) ?? '#e5e7eb'}
						stroke-width={selected ? 2.5 : hovered ? 2 : 1}
						style="stroke: {selected
							? 'var(--accent, #d97706)'
							: hovered
								? '#374151'
								: 'rgba(0, 0, 0, 0.25)'};"
					/>
					<text
						text-anchor="middle"
						dominant-baseline="central"
						font-size="12"
						fill="#1f2937"
						style="font-family: var(--font-mono, monospace); pointer-events: none;"
					>{truncate(node.label)}</text>
				</g>
			{/each}
		</g>
	</svg>
</div>

{#if typeColors.size > 0}
	<div class="legend">
		{#each [...typeColors] as [type, color] (type)}
			<Badge>
				<span class="legend-dot" style="background: {color};"></span>
				{type}
			</Badge>
		{/each}
	</div>
{/if}

<style>
	.canvas-wrap {
		width: 100%;
		height: clamp(24rem, 62vh, 42rem);
		border: 1px solid var(--ui, #333);
		border-radius: var(--radius-md, 0.375rem);
		background-color: var(--bg, #fff);
		overflow: hidden;
	}

	.legend {
		display: flex;
		align-items: center;
		gap: var(--space-2, 0.5rem);
		flex-wrap: wrap;
		margin-top: var(--space-2, 0.5rem);
	}

	.legend-dot {
		display: inline-block;
		width: 0.55rem;
		height: 0.55rem;
		border-radius: 50%;
		border: 1px solid rgba(0, 0, 0, 0.25);
		margin-right: 0.3rem;
	}
</style>
