<script lang="ts">
	import maplibregl from 'maplibre-gl';
	import { untrack } from 'svelte';
	import { loadData } from '$lib/data/load';
	import { llm } from '$lib/llm/provider.svelte';
	import { StructuredOutputError } from '$lib/llm/structured';
	import { mapStore } from '$lib/map/MapStore.svelte';
	import GeoJSONSource from '$lib/map/GeoJSONSource.svelte';
	import HoverPopup from '$lib/map/HoverPopup.svelte';
	import MapLayer from '$lib/map/MapLayer.svelte';
	import OverlayPanel from '$lib/shell/OverlayPanel.svelte';
	import Badge from '$lib/ui/Badge.svelte';
	import { Button } from '@wri-datalab/ui';
	import Panel from '$lib/ui/Panel.svelte';
	import { Select } from '@wri-datalab/ui';
	import { Slider } from '@wri-datalab/ui';
	import Spinner from '$lib/ui/Spinner.svelte';
	import { Input as TextInput } from '@wri-datalab/ui';
	import { Toggle } from '@wri-datalab/ui';
	import { toasts } from '$lib/ui/toast.svelte';
	import { farmHoverConfig } from '../shared/zambezi';
	import { SUGGESTED_WATCHES, watchMock } from './mocks';
	import {
		computeMetrics,
		describeRule,
		METRIC_LABELS,
		ruleFires,
		ruleNear,
		ruleValue,
		SIM_DAYS,
		WATCH_SCHEMA,
		type FarmSite,
		type WatchRule
	} from './rules';

	// ---------- data (modelled Zambezi overlay — real data stays in Can Tho) ----------

	let zambezi = $state.raw<GeoJSON.FeatureCollection | null>(null);
	let farmsFc = $state.raw<GeoJSON.FeatureCollection | null>(null);
	let farms = $state.raw<FarmSite[]>([]);
	let sortedDistances = $state.raw<number[]>([]);

	$effect(() => {
		loadData('zambezi.geojson').then((d) => (zambezi = d));
		loadData('zambezi-farms.geojson').then((fc) => {
			farmsFc = fc;
			const sites = fc.features.map((f) => {
				const p = f.properties as Record<string, unknown>;
				return {
					id: String(p.id),
					name: String(p.name),
					lngLat: (f.geometry as GeoJSON.Point).coordinates as [number, number],
					dist_river_m: Number(p.dist_river_m),
					flood_exposure: String(p.flood_exposure),
					households: Number(p.households)
				} satisfies FarmSite;
			});
			farms = sites;
			sortedDistances = sites.map((s) => s.dist_river_m).sort((a, b) => a - b);
		});
	});

	// ---------- the clock ----------

	let day = $state(0);
	let playing = $state(false);
	let lastEvaluatedDay = 0;

	function togglePlay() {
		if (!playing && day >= SIM_DAYS) day = 0;
		playing = !playing;
	}

	$effect(() => {
		if (!playing) return;
		const interval = setInterval(() => {
			if (untrack(() => day) >= SIM_DAYS) {
				playing = false;
				return;
			}
			day = Math.min(SIM_DAYS, untrack(() => day) + 0.5);
		}, 550);
		return () => clearInterval(interval);
	});

	const metrics = $derived(
		farms.length ? computeMetrics(day, farms, sortedDistances) : null
	);

	// ---------- watches ----------

	type EscalationCap = 'ambient' | 'toast' | 'briefing' | 'flyover';
	const CAP_OPTIONS = [
		{ value: 'ambient', label: 'ambient only' },
		{ value: 'toast', label: 'up to toast' },
		{ value: 'briefing', label: 'up to briefing' },
		{ value: 'flyover', label: 'straight to flyover' }
	];

	interface HistoryEntry {
		day: number;
		kind: 'fired' | 'receded' | 'near-miss';
		message: string;
	}

	interface Watch {
		id: number;
		sentence: string;
		rule: WatchRule;
		cap: EscalationCap;
		muted: boolean;
		firing: boolean;
		near: boolean;
		nearPeak: { value: number; day: number } | null;
		history: HistoryEntry[];
	}

	let watches = $state<Watch[]>([]);
	let nextWatchId = 1;
	let parsing = $state(false);
	let parseError = $state<string | null>(null);
	let sentence = $state('');

	let quietHours = $state(false);
	let quietQueue = $state<{ title: string; body: string }[]>([]);

	interface Briefing {
		watchId: number;
		day: number;
		title: string;
		what: string;
		evidence: number;
	}
	let briefing = $state<Briefing | null>(null);

	async function addWatch(text?: string) {
		const q = (text ?? sentence).trim();
		if (!q || parsing) return;
		sentence = q;
		parsing = true;
		parseError = null;
		try {
			const result = await llm.structured<WatchRule>(
				{
					system:
						'You parse a monitoring watch sentence into a machine-checkable rule over a simulated ' +
						'flood scenario. Metrics: farms_touched (count of farm sites inside the modelled extent), ' +
						'sites_high_exposure (count of high-exposure sites inside it), extent_area_km2 ' +
						'(modelled extent area). Give a short label.',
					messages: [{ role: 'user', content: `Watch: ${q}` }],
					maxTokens: 300,
					mock: watchMock()
				},
				WATCH_SCHEMA
			);
			watches = [
				...watches,
				{
					id: nextWatchId++,
					sentence: q,
					rule: result.value,
					cap: 'briefing',
					muted: false,
					firing: metrics ? ruleFires(result.value, ruleValue(result.value, metrics)) : false,
					near: false,
					nearPeak: null,
					history: []
				}
			];
			sentence = '';
		} catch (e) {
			parseError =
				e instanceof StructuredOutputError
					? `Could not parse the watch: ${e.validationErrors.join('; ')}`
					: (e as Error).message;
		} finally {
			parsing = false;
		}
	}

	// ---------- escalation ----------

	function fireMessage(w: Watch, value: number): string {
		return (
			`${METRIC_LABELS[w.rule.metric]} reached ${value} (rule: ${w.rule.op} ${w.rule.threshold}) ` +
			`on day ${Math.floor(day)} of the simulated scenario.`
		);
	}

	function escalate(w: Watch, value: number) {
		if (w.muted) return;
		const message = fireMessage(w, value);
		// level 1 (ambient dot on the row) is w.firing — already set by the caller
		if (w.cap === 'ambient') return;
		if (quietHours) {
			quietQueue = [...quietQueue, { title: w.rule.label, body: message }];
			return;
		}
		toasts.push({
			title: `⚠ ${w.rule.label}`,
			body: message,
			tone: 'warning',
			actions: [{ label: 'show me', run: () => openBriefing(w, value) }]
		});
		if (w.cap === 'toast') return;
		openBriefing(w, value);
		if (w.cap === 'briefing') return;
		runFlyover();
	}

	function openBriefing(w: Watch, value: number) {
		briefing = {
			watchId: w.id,
			day,
			title: w.rule.label,
			what: fireMessage(w, value),
			evidence: metrics?.touched.length ?? 0
		};
	}

	// Evaluate on forward movement only; scrubbing backward resyncs silently
	// (replaying history when the user drags the clock around would be noise).
	// The watch mutations happen inside untrack — the clock (via `metrics`) is
	// the only dependency, per the read-and-write rune rule.
	$effect(() => {
		const m = metrics;
		if (!m) return;
		untrack(() => evaluateWatches(m));
	});

	function evaluateWatches(m: NonNullable<typeof metrics>) {
		const forward = m.day >= lastEvaluatedDay;
		lastEvaluatedDay = m.day;
		for (const w of watches) {
			const value = ruleValue(w.rule, m);
			const fires = ruleFires(w.rule, value);
			const near = ruleNear(w.rule, value);
			if (!forward) {
				w.firing = fires;
				w.near = near;
				w.nearPeak = null;
				continue;
			}
			if (fires && !w.firing) {
				w.firing = true;
				w.near = false;
				w.nearPeak = null;
				w.history = [...w.history, { day: m.day, kind: 'fired', message: fireMessage(w, value) }];
				escalate(w, value);
			} else if (!fires && w.firing) {
				w.firing = false;
				w.history = [
					...w.history,
					{
						day: m.day,
						kind: 'receded',
						message: `${METRIC_LABELS[w.rule.metric]} back to ${value} — below the threshold.`
					}
				];
			} else if (!fires) {
				if (near) {
					w.near = true;
					if (!w.nearPeak || Math.abs(value - w.rule.threshold) < Math.abs(w.nearPeak.value - w.rule.threshold)) {
						w.nearPeak = { value, day: m.day };
					}
				} else if (w.near) {
					// left the near zone without firing: the near-miss, made visible
					w.near = false;
					if (w.nearPeak) {
						w.history = [
							...w.history,
							{
								day: m.day,
								kind: 'near-miss',
								message: `peaked at ${w.nearPeak.value} / ${w.rule.threshold} on day ${Math.floor(w.nearPeak.day)}, then receded — not fired.`
							}
						];
						w.nearPeak = null;
					}
				}
			}
		}
	}

	// Releasing quiet hours delivers ONE batched toast, not a backlog of pings.
	$effect(() => {
		if (quietHours) return;
		untrack(() => {
			if (!quietQueue.length) return;
			const queued = quietQueue;
			quietQueue = [];
			toasts.push({
				title: `${queued.length} alert${queued.length > 1 ? 's' : ''} held during quiet hours`,
				body: queued.map((q) => q.title).join(' · '),
				tone: 'warning'
			});
		});
	});

	// ---------- flyover chain (level 4) ----------

	let flying = $state(false);
	let flyGeneration = 0;
	let pulseMarkers: maplibregl.Marker[] = [];

	function clearPulses() {
		for (const m of pulseMarkers) mapStore.scene.removeMarker(m);
		pulseMarkers = [];
	}

	async function runFlyover() {
		const m = metrics;
		if (!m || flying) return;
		// the evidence: the 3 most recently touched sites (nearest the new edge)
		const stops = [...m.touched].sort((a, b) => b.dist_river_m - a.dist_river_m).slice(0, 3);
		if (!stops.length) return;
		const gen = ++flyGeneration;
		flying = true;
		clearPulses();
		for (const stop of stops) {
			if (gen !== flyGeneration) return;
			const el = document.createElement('div');
			el.className = 'pulse-marker';
			pulseMarkers.push(
				mapStore.scene.addMarker(new maplibregl.Marker({ element: el }).setLngLat(stop.lngLat))
			);
			await mapStore.flyTo({ center: stop.lngLat, zoom: 11.5 }, 2000);
			await new Promise((r) => setTimeout(r, 1400));
		}
		if (gen !== flyGeneration) return;
		await mapStore.flyTo({ center: [35.35, -17.9], zoom: 8 }, 2000);
		flying = false;
	}

	function stopFlyover() {
		flyGeneration++;
		flying = false;
	}

	// demo unmount: no orphaned toasts/markers
	$effect(() => {
		return () => {
			toasts.clear();
			stopFlyover();
		};
	});

	// ---------- map paint (reactive to the clock) ----------

	const farmPaint = $derived.by(() => {
		const t = metrics?.thresholdM ?? 0;
		return {
			'circle-color': ['case', ['<=', ['get', 'dist_river_m'], t], '#dc2626', '#8a8378'],
			'circle-radius': ['case', ['<=', ['get', 'dist_river_m'], t], 5, 3],
			'circle-opacity': 0.85
		} as Record<string, unknown>;
	});

	const projectedOpacity = $derived(0.05 + 0.25 * (day / SIM_DAYS));

	const anyFiring = $derived(watches.some((w) => w.firing && !w.muted));
	const anyNear = $derived(watches.some((w) => w.near && !w.muted));
</script>

{#if zambezi}
	<GeoJSONSource id="zambezi" data={zambezi}>
		<MapLayer
			spec={{
				id: 'zambezi-flood-projected',
				type: 'fill',
				source: 'zambezi',
				filter: ['==', ['get', 'scenario'], 'projected'],
				paint: { 'fill-color': '#7dd3fc', 'fill-opacity': 0.1 }
			}}
			paint={{ 'fill-opacity': projectedOpacity }}
		/>
		<MapLayer
			spec={{
				id: 'zambezi-flood-current',
				type: 'fill',
				source: 'zambezi',
				filter: ['==', ['get', 'scenario'], 'current'],
				paint: { 'fill-color': '#38bdf8', 'fill-opacity': 0.3 }
			}}
		/>
		<MapLayer
			spec={{
				id: 'zambezi-river',
				type: 'line',
				source: 'zambezi',
				filter: ['==', ['get', 'kind'], 'river'],
				paint: { 'line-color': '#38bdf8', 'line-width': 2, 'line-opacity': 0.8 }
			}}
		/>
	</GeoJSONSource>
{/if}

{#if farmsFc}
	<GeoJSONSource id="zambezi-farms" data={farmsFc}>
		<MapLayer
			spec={{
				id: 'sentinel-farms',
				type: 'circle',
				source: 'zambezi-farms',
				paint: {
					'circle-color': '#8a8378',
					'circle-radius': 3,
					'circle-opacity': 0.85,
					'circle-stroke-width': 0.5,
					'circle-stroke-color': '#1c1a18'
				}
			}}
			paint={farmPaint}
		/>
	</GeoJSONSource>
	<HoverPopup layers={farmHoverConfig('sentinel-farms')} />
{/if}

<OverlayPanel side="right" width="27rem" fill>
	<Panel title="Monitoring sentinel">
		{#snippet actions()}
			{#if anyFiring}
				<span class="dot firing" title="a watch is firing"></span>
			{:else if anyNear}
				<span class="dot near" title="a watch is near its threshold"></span>
			{/if}
			<Badge tone={llm.mode === 'mock' ? 'neutral' : 'primary'}>{llm.mode}</Badge>
		{/snippet}
		<p class="lead">
			A standing agent needs two designs, not one: <strong>what to check</strong> (a sentence,
			parsed into a machine-checkable rule) and <strong>how to interrupt you</strong>. The clock
			plays a time-compressed flood scenario over the modelled Zambezi data; rules are evaluated
			in code every tick, and each watch carries its own interruption budget.
		</p>
		<form
			onsubmit={(e) => {
				e.preventDefault();
				addWatch();
			}}
		>
			<TextInput bind:value={sentence} placeholder="Alert me if the flood touches more than…" />
			<div class="row">
				<Button variant="primary" type="submit" disabled={parsing || !sentence.trim()}>
					{#if parsing}<Spinner size={12} />{/if}
					add watch
				</Button>
			</div>
		</form>
		<div class="chips">
			{#each SUGGESTED_WATCHES as s (s)}
				<button class="chip" onclick={() => addWatch(s)} disabled={parsing}>{s}</button>
			{/each}
		</div>
		{#if parseError}<p class="error">{parseError}</p>{/if}
	</Panel>

	<Panel title="Scenario clock — day {Math.floor(day)} of {SIM_DAYS}">
		{#snippet actions()}
			<Button size="sm" onclick={togglePlay}>
				{playing ? 'pause' : day >= SIM_DAYS ? 'replay' : 'play'}
			</Button>
		{/snippet}
		<Slider min={0} max={SIM_DAYS} step={0.5} bind:value={day} />
		{#if metrics}
			<div class="metrics">
				<div>
					<span class="k">farm sites in extent</span>
					<span class="v">{metrics.farms_touched} / {farms.length}</span>
				</div>
				<div>
					<span class="k">high-exposure sites</span>
					<span class="v">{metrics.sites_high_exposure}</span>
				</div>
				<div>
					<span class="k">modelled extent</span>
					<span class="v">{metrics.extent_area_km2.toLocaleString()} km²</span>
				</div>
			</div>
		{/if}
		<p class="note">
			scrub freely — alerts only fire on forward playback; day ~16 is a scripted near-miss
		</p>
	</Panel>

	{#if watches.length}
		<Panel title="Watches" padded={false}>
			{#snippet actions()}
				<label class="quiet">
					<Toggle bind:checked={quietHours} />
					<span>quiet hours{quietQueue.length ? ` (${quietQueue.length} held)` : ''}</span>
				</label>
			{/snippet}
			{#each watches as w (w.id)}
				{@const value = metrics ? ruleValue(w.rule, metrics) : 0}
				<div class="watch" class:muted={w.muted}>
					<div class="watch-head">
						<span
							class="dot"
							class:firing={w.firing && !w.muted}
							class:near={w.near && !w.muted}
						></span>
						<span class="watch-label">{w.rule.label}</span>
						<span class="watch-value" class:hot={w.firing}>
							{value} / {w.rule.threshold}
						</span>
					</div>
					<div class="watch-rule">“{w.sentence}” → <code>{describeRule(w.rule)}</code></div>
					<div class="watch-controls">
						<Select
							value={w.cap}
							options={CAP_OPTIONS}
							onchange={(v: string) => (w.cap = v as EscalationCap)}
						/>
						<label class="mute">
							<input type="checkbox" bind:checked={w.muted} />
							mute
						</label>
						<span class="thresh">
							threshold
							<input
								class="thresh-input"
								type="number"
								bind:value={w.rule.threshold}
							/>
						</span>
					</div>
					{#if w.history.length}
						<details class="hist">
							<summary>{w.history.length} event{w.history.length > 1 ? 's' : ''}</summary>
							<ul>
								{#each w.history as h, i (i)}
									<li class={h.kind}>
										<span class="h-day">d{Math.floor(h.day)}</span>
										<span class="h-kind">{h.kind}</span>
										{h.message}
									</li>
								{/each}
							</ul>
						</details>
					{/if}
				</div>
			{/each}
			<p class="ladder-note">
				escalation ladder: ambient dot → toast → briefing card → flyover. The per-watch policy
				is the probe: an interruption budget you set, not the agent.
			</p>
		</Panel>
	{/if}

	{#if briefing}
		{@const b = briefing}
		<Panel title="⚠ {b.title}">
			{#snippet actions()}
				<Badge tone="warning">day {Math.floor(b.day)}</Badge>
			{/snippet}
			<p class="brief-what">{briefing.what}</p>
			<p class="brief-ev">
				evidence: {briefing.evidence} sites currently inside the modelled extent · alert prose
				templated from the rule + counts (no LLM in the loop at alert time)
			</p>
			<div class="row">
				<Button variant="primary" onclick={() => runFlyover()} disabled={flying}>
					{flying ? 'flying…' : 'verify — fly the evidence'}
				</Button>
				{#if flying}
					<Button onclick={stopFlyover}>stop</Button>
				{/if}
				<Button
					variant="ghost"
					onclick={() => {
						const w = watches.find((x) => x.id === briefing?.watchId);
						if (w) w.muted = true;
						briefing = null;
					}}
				>
					mute watch
				</Button>
				<Button variant="ghost" onclick={() => (briefing = null)}>dismiss</Button>
			</div>
		</Panel>
	{/if}
</OverlayPanel>

<style>
	.lead {
		margin: 0 0 var(--space-3);
		font-size: 0.78rem;
		line-height: 1.55;
		color: var(--tx-2);
	}
	.lead strong {
		color: var(--tx);
	}
	.row {
		display: flex;
		gap: var(--space-2);
		margin-top: var(--space-2);
		flex-wrap: wrap;
	}
	.chips {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		margin-top: var(--space-3);
	}
	.chip {
		text-align: left;
		font-family: var(--font-mono);
		font-size: 0.68rem;
		color: var(--tx-2);
		background: var(--bg);
		border: 1px solid var(--ui);
		border-radius: var(--radius-sm);
		padding: 0.35rem 0.5rem;
		cursor: pointer;
	}
	.chip:hover:not(:disabled) {
		border-color: var(--primary);
		color: var(--tx);
	}
	.error {
		margin: var(--space-2) 0 0;
		font-family: var(--font-mono);
		font-size: var(--text-ui);
		color: var(--error-text);
	}
	.note {
		margin: var(--space-2) 0 0;
		font-family: var(--font-mono);
		font-size: 0.6rem;
		color: var(--tx-3);
	}
	.metrics {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		margin-top: var(--space-2);
	}
	.metrics > div {
		display: flex;
		justify-content: space-between;
		font-family: var(--font-mono);
		font-size: 0.68rem;
	}
	.metrics .k {
		color: var(--tx-3);
	}
	.metrics .v {
		color: var(--tx);
	}

	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--ui-3);
		flex: none;
		display: inline-block;
	}
	.dot.near {
		background: var(--warning, #f59e0b);
		animation: throb 1.6s ease-in-out infinite;
	}
	.dot.firing {
		background: var(--error, #dc2626);
		animation: throb 0.9s ease-in-out infinite;
	}
	@keyframes throb {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.35;
		}
	}

	.quiet {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		font-family: var(--font-mono);
		font-size: 0.6rem;
		color: var(--tx-3);
	}
	.watch {
		padding: var(--space-2) var(--space-3);
		border-bottom: 1px solid var(--ui);
	}
	.watch.muted {
		opacity: 0.5;
	}
	.watch-head {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}
	.watch-label {
		flex: 1;
		font-family: var(--font-mono);
		font-size: 0.72rem;
		color: var(--tx);
	}
	.watch-value {
		font-family: var(--font-mono);
		font-size: 0.72rem;
		color: var(--tx-2);
	}
	.watch-value.hot {
		color: var(--error-text);
	}
	.watch-rule {
		margin-top: 0.2rem;
		font-family: var(--font-mono);
		font-size: 0.62rem;
		color: var(--tx-3);
	}
	.watch-rule code {
		color: var(--tx-2);
	}
	.watch-controls {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		margin-top: var(--space-2);
		flex-wrap: wrap;
	}
	.mute {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		font-family: var(--font-mono);
		font-size: 0.62rem;
		color: var(--tx-2);
	}
	.thresh {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		font-family: var(--font-mono);
		font-size: 0.62rem;
		color: var(--tx-3);
	}
	.thresh-input {
		width: 4.5rem;
		background: var(--bg);
		border: 1px solid var(--ui);
		border-radius: var(--radius-sm);
		color: var(--tx);
		font-family: var(--font-mono);
		font-size: 0.65rem;
		padding: 0.15rem 0.3rem;
	}
	.hist {
		margin-top: var(--space-2);
	}
	.hist summary {
		font-family: var(--font-mono);
		font-size: 0.6rem;
		color: var(--tx-3);
		cursor: pointer;
	}
	.hist ul {
		list-style: none;
		margin: 0.3rem 0 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	.hist li {
		font-family: var(--font-mono);
		font-size: 0.62rem;
		line-height: 1.45;
		color: var(--tx-2);
	}
	.h-day {
		color: var(--tx-3);
		margin-right: 0.3rem;
	}
	.h-kind {
		margin-right: 0.3rem;
	}
	.hist li.fired .h-kind {
		color: var(--error-text);
	}
	.hist li.near-miss .h-kind {
		color: var(--warning-text);
	}
	.hist li.receded .h-kind {
		color: var(--success-text);
	}
	.ladder-note {
		padding: var(--space-2) var(--space-3);
		margin: 0;
		font-family: var(--font-mono);
		font-size: 0.6rem;
		line-height: 1.5;
		color: var(--tx-3);
	}
	.brief-what {
		margin: 0 0 var(--space-2);
		font-size: 0.78rem;
		line-height: 1.5;
		color: var(--tx);
	}
	.brief-ev {
		margin: 0 0 var(--space-2);
		font-family: var(--font-mono);
		font-size: 0.62rem;
		line-height: 1.5;
		color: var(--tx-3);
	}

	:global(.pulse-marker) {
		width: 18px;
		height: 18px;
		border-radius: 50%;
		background: color-mix(in srgb, var(--primary) 35%, transparent);
		border: 2px solid var(--primary);
		animation: pulse 1.4s ease-out infinite;
	}
	@keyframes pulse {
		0% {
			box-shadow: 0 0 0 0 color-mix(in srgb, var(--primary) 55%, transparent);
		}
		100% {
			box-shadow: 0 0 0 22px transparent;
		}
	}
</style>
