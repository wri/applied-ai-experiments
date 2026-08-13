<script lang="ts">
	// Thin adapter over @wri-datalab/ui's Spinner: this app sizes spinners in px
	// (default 14); the shared Spinner takes sm|md|lg. Bucket the px value so the
	// ~25 call sites need no change. Same adapter pattern as $lib/llm.
	import { Spinner as UiSpinner } from '@wri-datalab/ui';

	let { size = 14 }: { size?: number } = $props();

	const bucket = $derived<'sm' | 'md' | 'lg'>(size <= 12 ? 'sm' : size <= 18 ? 'md' : 'lg');
</script>

<UiSpinner size={bucket} />
