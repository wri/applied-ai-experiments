<script lang="ts">
	import { Slider } from '@wri-datalab/ui';

	interface Props {
		label: string;
		value: number;
		min: number;
		max: number;
		step: number;
		formatValue: (v: number) => string;
		onchange: (v: number) => void;
	}

	let { label, value: externalValue, min, max, step, formatValue, onchange }: Props = $props();

	let localValue = $state(0);

	// Sync external → local when parent changes
	$effect(() => {
		localValue = externalValue;
	});

	// Sync local → callback
	$effect(() => {
		if (localValue !== externalValue) {
			onchange(localValue);
		}
	});
</script>

<Slider
	{label}
	bind:value={localValue}
	{min}
	{max}
	{step}
	{formatValue}
/>
