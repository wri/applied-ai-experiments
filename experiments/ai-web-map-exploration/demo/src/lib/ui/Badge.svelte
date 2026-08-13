<script lang="ts">
	// Thin adapter over @wri-datalab/ui's Badge: preserves this app's original
	// `tone` API (6 values incl. neutral/primary) on top of the shared Badge's
	// `variant` set, so the ~40 call sites (many with dynamic/helper-returned
	// tones) need no change. Same adapter pattern as $lib/llm.
	import { Badge as UiBadge } from '@wri-datalab/ui';
	import type { Snippet } from 'svelte';

	type Tone = 'neutral' | 'primary' | 'success' | 'warning' | 'error' | 'info';

	let { tone = 'neutral', title, children }: { tone?: Tone; title?: string; children: Snippet } =
		$props();

	const VARIANT: Record<Tone, 'default' | 'success' | 'warning' | 'error' | 'info'> = {
		neutral: 'default',
		primary: 'info',
		success: 'success',
		warning: 'warning',
		error: 'error',
		info: 'info'
	};
</script>

<UiBadge variant={VARIANT[tone]} {title}>{@render children()}</UiBadge>
