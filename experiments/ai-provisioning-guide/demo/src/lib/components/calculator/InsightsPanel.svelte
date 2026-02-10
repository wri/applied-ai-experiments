<script lang="ts">
	import { Alert } from '@wri-datalab/ui';
	import { appStore } from '$lib/stores/app.svelte.js';
</script>

{#if appStore.insights.length > 0}
	<div class="insights-panel">
		{#each appStore.insights as insight}
			<Alert variant="info">
				{@html insight}
			</Alert>
		{/each}
	</div>
{/if}

<style>
	.insights-panel {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
</style>
