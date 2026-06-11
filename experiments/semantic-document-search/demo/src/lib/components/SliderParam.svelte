<script lang="ts">
	import { untrack } from 'svelte';
	import { Slider } from '@wri-datalab/ui';

	// Self-contained slider that owns its drag value (seeded once from `initial`)
	// and emits user changes. Parents key it per (strategy, param) so it remounts
	// with a fresh value when the active strategy changes — this avoids ever
	// binding the UI-lib Slider to `undefined`.
	interface Props {
		initial: number;
		min: number;
		max: number;
		step: number;
		label: string;
		unitLabel?: string;
		disabled?: boolean;
		onChange?: (value: number) => void;
	}

	let { initial, min, max, step, label, unitLabel, disabled = false, onChange }: Props = $props();

	let value = $state(untrack(() => initial));
	let mounted = false;

	$effect(() => {
		const v = value;
		if (!mounted) {
			mounted = true; // skip the emit on initial mount
			return;
		}
		onChange?.(v);
	});
</script>

<Slider
	bind:value
	{min}
	{max}
	{step}
	{label}
	{disabled}
	formatValue={(v) => `${v}${unitLabel ? ' ' + unitLabel : ''}`}
/>
