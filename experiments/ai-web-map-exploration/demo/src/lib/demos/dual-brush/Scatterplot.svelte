<script lang="ts">
	import { CATEGORY_COLORS, type EmbPoint } from './points';

	interface Props {
		points: EmbPoint[];
		/** ids selected by a map-side selection (highlight ring) */
		selected: Set<string>;
		/** ids currently inside the map viewport (others dim) */
		inView: Set<string> | null;
		onbrush: (ids: string[] | null) => void;
	}

	let { points, selected, inView, onbrush }: Props = $props();

	const W = 320;
	const H = 260;
	const PAD = 10;

	function sx(ex: number): number {
		return PAD + ex * (W - 2 * PAD);
	}
	function sy(ey: number): number {
		return H - PAD - ey * (H - 2 * PAD);
	}

	let svg = $state<SVGSVGElement | null>(null);
	let brushing = $state(false);
	let start = $state<[number, number] | null>(null);
	let end = $state<[number, number] | null>(null);

	const rect = $derived.by(() => {
		if (!start || !end) return null;
		return {
			x: Math.min(start[0], end[0]),
			y: Math.min(start[1], end[1]),
			w: Math.abs(start[0] - end[0]),
			h: Math.abs(start[1] - end[1])
		};
	});

	function localPoint(e: PointerEvent): [number, number] {
		const r = svg!.getBoundingClientRect();
		return [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H];
	}

	function emit() {
		const r = rect;
		if (!r || r.w < 3 || r.h < 3) {
			onbrush(null);
			return;
		}
		const ids = points
			.filter((p) => {
				const x = sx(p.ex);
				const y = sy(p.ey);
				return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
			})
			.map((p) => p.id);
		onbrush(ids);
	}

	function onDown(e: PointerEvent) {
		brushing = true;
		start = localPoint(e);
		end = start;
		(e.target as Element).setPointerCapture(e.pointerId);
	}
	function onMove(e: PointerEvent) {
		if (!brushing) return;
		end = localPoint(e);
		emit();
	}
	function onUp() {
		brushing = false;
		if (rect && (rect.w < 3 || rect.h < 3)) {
			start = null;
			end = null;
			onbrush(null);
		}
	}
</script>

<svg
	bind:this={svg}
	viewBox="0 0 {W} {H}"
	onpointerdown={onDown}
	onpointermove={onMove}
	onpointerup={onUp}
	role="application"
	aria-label="Embedding scatterplot — drag to brush"
>
	<rect class="bg" width={W} height={H} rx="4" />
	{#each points as p (p.id)}
		<circle
			cx={sx(p.ex)}
			cy={sy(p.ey)}
			r={selected.has(p.id) ? 3.4 : 2.2}
			fill={CATEGORY_COLORS[p.category] ?? '#888'}
			class:dim={inView !== null && !inView.has(p.id)}
			class:sel={selected.has(p.id)}
		/>
	{/each}
	{#if rect}
		<rect class="brush" x={rect.x} y={rect.y} width={rect.w} height={rect.h} />
	{/if}
</svg>

<style>
	svg {
		width: 100%;
		display: block;
		cursor: crosshair;
		touch-action: none;
	}
	.bg {
		fill: var(--bg);
		stroke: var(--ui);
	}
	circle {
		opacity: 0.85;
		transition: opacity 120ms;
	}
	circle.dim {
		opacity: 0.12;
	}
	circle.sel {
		stroke: var(--tx);
		stroke-width: 1;
	}
	.brush {
		fill: color-mix(in srgb, var(--primary) 15%, transparent);
		stroke: var(--primary);
		stroke-width: 1;
		stroke-dasharray: 4 3;
	}
</style>
