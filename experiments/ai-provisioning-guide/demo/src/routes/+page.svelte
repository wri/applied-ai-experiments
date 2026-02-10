<script lang="ts">
	import { browser } from '$app/environment';
	import { DemoLayout, Tabs, Button, CopyButton } from '@wri-datalab/ui';
	import { ToastContainer, toast } from '@wri-datalab/ui';
	import { appStore } from '$lib/stores/app.svelte.js';
	import { encodeStateToParams, decodeStateFromParams } from '$lib/utils/url.js';
	import { exportToMarkdown, exportToCSV } from '$lib/utils/export.js';
	import WizardView from '$lib/components/wizard/WizardView.svelte';
	import CalculatorView from '$lib/components/calculator/CalculatorView.svelte';
	import CompareView from '$lib/components/compare/CompareView.svelte';
	import GuideView from '$lib/components/guide/GuideView.svelte';

	const tabs = [
		{ id: 'wizard', label: 'Wizard' },
		{ id: 'calculator', label: 'Calculator' },
		{ id: 'compare', label: 'Compare' },
		{ id: 'guide', label: 'Guide' },
	];

	let activeTab = $derived(appStore.activeTab);

	// Restore state from URL on mount
	if (browser) {
		const params = new URLSearchParams(window.location.search);
		const restored = decodeStateFromParams(params);
		if (restored.activeTab) appStore.setTab(restored.activeTab);
		if (restored.constraintAnswers) {
			for (const [key, val] of Object.entries(restored.constraintAnswers)) {
				if (val) appStore.answerConstraint(key as any, val);
			}
		}
		if (restored.tcoInputs) appStore.updateTCOInputs(restored.tcoInputs);
		if (restored.selectedMethods) appStore.setSelectedMethods(restored.selectedMethods);
		if (restored.timeHorizonMonths) appStore.setTimeHorizon(restored.timeHorizonMonths);
	}

	// Sync state → URL
	$effect(() => {
		if (!browser) return;
		const params = encodeStateToParams({
			activeTab: appStore.activeTab,
			constraintAnswers: appStore.constraintAnswers,
			tcoInputs: appStore.tcoInputs,
			selectedMethods: appStore.selectedMethods,
			timeHorizonMonths: appStore.timeHorizonMonths,
		});
		const url = new URL(window.location.href);
		url.search = params.toString();
		history.replaceState(null, '', url.toString());
	});

	function getShareUrl(): string {
		const params = encodeStateToParams({
			activeTab: appStore.activeTab,
			constraintAnswers: appStore.constraintAnswers,
			tcoInputs: appStore.tcoInputs,
			selectedMethods: appStore.selectedMethods,
			timeHorizonMonths: appStore.timeHorizonMonths,
		});
		const url = new URL(window.location.href);
		url.search = params.toString();
		return url.toString();
	}

	function handleExportMarkdown() {
		const md = exportToMarkdown(appStore);
		downloadFile(md, 'ai-provisioning-decision.md', 'text/markdown');
		toast.success('Exported decision summary as Markdown');
	}

	function handleExportCSV() {
		const csv = exportToCSV(appStore);
		downloadFile(csv, 'tco-comparison.csv', 'text/csv');
		toast.success('Exported TCO comparison as CSV');
	}

	function downloadFile(content: string, filename: string, type: string) {
		const blob = new Blob([content], { type });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = filename;
		a.click();
		URL.revokeObjectURL(url);
	}
</script>

<DemoLayout
	title="AI Provisioning Guide"
	subtitle="Navigate AI delivery decisions"
	maxWidth="xl"
	showApiKeys={false}
>
	<div class="page-content">
		<div class="page-toolbar">
			<Tabs
				items={tabs}
				active={activeTab}
				size="sm"
				onchange={(id: any) => appStore.setTab(id as any)}
			/>
			<div class="toolbar-actions">
				<CopyButton text={getShareUrl()} label="Share" />
				<Button variant="ghost" size="sm" onclick={handleExportMarkdown}>Export MD</Button>
				<Button variant="ghost" size="sm" onclick={handleExportCSV}>Export CSV</Button>
			</div>
		</div>

		{#if appStore.activeTab === 'wizard'}
			<WizardView />
		{:else if appStore.activeTab === 'calculator'}
			<CalculatorView />
		{:else if appStore.activeTab === 'compare'}
			<CompareView />
		{:else if appStore.activeTab === 'guide'}
			<GuideView />
		{/if}
	</div>
</DemoLayout>

<ToastContainer />

<style>
	.page-content {
		max-width: 80rem;
		width: 100%;
		margin: 0 auto;
		padding: 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
		min-width: 0;
		overflow-x: hidden;
	}

	.page-toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.toolbar-actions {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}

	@media (max-width: 640px) {
		.page-content {
			padding: 0.75rem;
			min-width: 0;
		overflow-x: visible;

		}

		.page-toolbar {
			flex-direction: column;
			align-items: stretch;
		}

		.toolbar-actions {
			justify-content: flex-end;
		}
	}
</style>
