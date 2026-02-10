<script lang="ts">
	import { Badge } from '@wri-datalab/ui';
	import type { Viability } from '$lib/types.js';

	interface Props {
		viability: Viability;
	}

	let { viability }: Props = $props();

	const config = $derived({
		viable: { label: 'Viable', variant: 'success' as const },
		caution: { label: 'Caution', variant: 'warning' as const },
		eliminated: { label: 'Eliminated', variant: 'error' as const },
	}[viability]);
</script>

<Badge variant={config.variant}>
	{config.label}
</Badge>
