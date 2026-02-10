<script lang="ts">
	import { Panel, Markdown } from '@wri-datalab/ui';
	import guideContent from '$lib/data/guide.md?raw';
</script>

<div class="guide-view">
	<Panel title="AI Provisioning Decision Guide">
		<Markdown content={guideContent} />
	</Panel>
</div>

<style>
	.guide-view {
		max-width: 56rem;
		width: 100%;
		margin: 0 auto;
		min-width: 0;
		overflow: hidden;
	}

	.guide-view :global(img) {
		max-width: 100%;
		height: auto;
	}

	.guide-view :global(pre) {
		overflow-x: auto;
	}

	.guide-view :global(table) {
		display: block;
		overflow-x: auto;
		-webkit-overflow-scrolling: touch;
	}
</style>
