<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';
	import { base } from '$app/paths';
	import { demosByCategory } from '$lib/demos/registry';
	import { CATEGORY_LABELS, CATEGORY_ORDER } from '$lib/demos/types';
	import { goto } from '$app/navigation';
	import { themeStore } from '$lib/state/theme.svelte';
	import MapShell from '$lib/map/MapShell.svelte';
	import { mapStore } from '$lib/map/MapStore.svelte';
	import { geocode } from '$lib/map/geocode';
	import SettingsDialog from '$lib/shell/SettingsDialog.svelte';
	import CommandPalette from '$lib/commands/CommandPalette.svelte';
	import { commands } from '$lib/commands/registry.svelte';
	import { demos } from '$lib/demos/registry';
	import { llm } from '$lib/llm/provider.svelte';
	import { modelLabel } from '$lib/llm/types';
	import {
		ToastContainer,
		ThemeSwitcher,
		UserSettingsTrigger,
		HeaderModeBadge,
		DemoInfoButton,
		hubHomeHref
	} from '@wri-datalab/ui';
	import Badge from '$lib/ui/Badge.svelte';
	import { SessionTelemetry, SessionTelemetryTrigger } from '@wri-datalab/llm-lab';
	import { initStores } from '$lib/stores';
	import { SLUG } from '$lib/slug';
	import { onMount, type Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();

	let settingsOpen = $state(false);

	$effect(() => {
		commands.registerGlobal([
			...demos.map((d) => ({
				id: `nav:${d.slug}`,
				title: `Go to ${d.title}`,
				hint: d.blurb,
				section: 'Navigate' as const,
				keywords: `demo ${d.slug}`,
				run: ({ closePalette }: { closePalette: () => void }) => {
					closePalette();
					goto(`${base}/${d.slug}`);
				}
			})),
			{
				id: 'map:fly-to',
				title: 'Fly to',
				hint: 'geocode a place name',
				section: 'Map',
				parameterized: true,
				keywords: 'go place search location',
				run: async ({ input, closePalette }) => {
					if (!input) return;
					const result = await geocode(input);
					if (result) {
						closePalette();
						mapStore.flyTo({ center: result.center, zoom: result.zoom });
					}
				}
			},
			{
				id: 'map:basemap',
				title: 'Toggle basemap',
				hint: 'streets ↔ satellite',
				section: 'Map',
				keywords: 'satellite imagery streets',
				run: ({ closePalette }) => {
					closePalette();
					mapStore.setBasemap(mapStore.basemap === 'streets' ? 'satellite' : 'streets');
				}
			},
			{
				id: 'app:settings',
				title: 'Open settings',
				hint: 'API key, model, mock mode',
				section: 'App',
				keywords: 'key byok model mock',
				run: ({ closePalette }) => {
					closePalette();
					settingsOpen = true;
				}
			}
		]);
	});

	onMount(() => {
		initStores();
	});

	$effect(() => {
		themeStore.init();
	});

	const activeSlug = $derived(page.params.demo ?? '');
</script>

<div class="app">
	<header class="header">
		<div class="brand">
			<a class="prefix home" href={hubHomeHref(base)}>Applied AI Experiments</a>
			<span class="sep">/</span>
			<span class="name">AI Web Map Exploration</span>
		</div>
		<div class="header-actions">
			<HeaderModeBadge
				mode={llm.mode === 'mock' ? 'mock' : 'live'}
				label={llm.mode === 'mock' ? 'mock' : modelLabel(llm.model)}
				onclick={() => (settingsOpen = true)}
			/>
			<DemoInfoButton title="AI Web Map Exploration" />
			<SessionTelemetryTrigger />
			<ThemeSwitcher />
			<UserSettingsTrigger onclick={() => (settingsOpen = true)} active={settingsOpen} />
		</div>
	</header>

	<div class="body">
		<nav class="sidebar" aria-label="Demos">
			{#each CATEGORY_ORDER as cat (cat)}
				<div class="group">
					<div class="group-label label">{CATEGORY_LABELS[cat]}</div>
					{#each demosByCategory.get(cat) ?? [] as demo (demo.slug)}
						<a
							class="demo-link"
							class:active={demo.slug === activeSlug}
							href="{base}/{demo.slug}"
						>
							<span class="demo-title">{demo.title}</span>
							<span class="demo-blurb">{demo.blurb}</span>
							{#if demo.status !== 'ready'}
								<span class="status">
									<Badge tone={demo.status === 'stub' ? 'neutral' : 'warning'}>{demo.status}</Badge>
								</span>
							{/if}
						</a>
					{/each}
				</div>
			{/each}
		</nav>

		<main class="main">
			<MapShell />
			{@render children()}
		</main>
	</div>
</div>

<SettingsDialog bind:open={settingsOpen} />
<CommandPalette />
<ToastContainer />
<SessionTelemetry slug={SLUG} trigger="none" />

<style>
	.app {
		display: flex;
		flex-direction: column;
		height: 100vh;
		background: var(--bg);
	}
	.header {
		height: var(--header-height);
		flex: none;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 var(--space-4);
		border-bottom: 1px solid var(--ui);
		background: var(--bg);
		z-index: var(--z-sticky);
	}
	/* Standard demo header title treatment (DESIGN.md §4) */
	.brand {
		font-family: var(--font-mono);
		font-size: var(--text-title-md);
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		display: flex;
		gap: 0.5rem;
		align-items: baseline;
		min-width: 0;
		white-space: nowrap;
		overflow: hidden;
	}
	.prefix {
		color: var(--tx-2);
	}
	/* Reads as breadcrumb, not as a styled link — matches ui's DemoHeader. */
	.home {
		text-decoration: none;
		color: inherit;
		border-radius: var(--radius-sm);
	}
	.home:hover {
		color: var(--tx);
		text-decoration: underline;
		text-underline-offset: 0.2em;
	}
	.home:focus-visible {
		outline: 2px solid var(--primary);
		outline-offset: 2px;
	}
	.sep {
		color: var(--tx-3);
	}
	.name {
		color: var(--tx);
	}
	.header-actions {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}
	.body {
		display: flex;
		flex: 1;
		min-height: 0;
	}
	.sidebar {
		width: 15.5rem;
		flex: none;
		overflow-y: auto;
		border-right: 1px solid var(--ui);
		padding: var(--space-3) 0 var(--space-6);
		background: var(--bg);
	}
	.group {
		margin-top: var(--space-3);
	}
	.group-label {
		padding: 0 var(--space-4);
		margin-bottom: var(--space-2);
	}
	.demo-link {
		display: block;
		position: relative;
		padding: 0.45rem var(--space-4);
		text-decoration: none;
		border-left: 2px solid transparent;
	}
	.demo-link:hover {
		background: var(--bg-2);
	}
	.demo-link.active {
		background: var(--bg-2);
		border-left-color: var(--primary);
	}
	.demo-title {
		display: block;
		font-family: var(--font-mono);
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--tx);
	}
	.demo-link.active .demo-title {
		color: var(--primary);
	}
	.demo-blurb {
		display: block;
		font-family: var(--font-mono);
		font-size: 0.65rem;
		color: var(--tx-3);
		margin-top: 0.1rem;
		line-height: 1.35;
	}
	.status {
		position: absolute;
		top: 0.45rem;
		right: var(--space-3);
	}

	.main {
		position: relative;
		flex: 1;
		min-width: 0;
		overflow: hidden;
		background: var(--bg);
	}
</style>
