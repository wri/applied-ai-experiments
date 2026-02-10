<script lang="ts">
	import { Slider } from '@wri-datalab/ui';
	import { appStore } from '$lib/stores/app.svelte.js';
	import { volumePresets, tokenSizePresets } from '$lib/data/defaults.js';
	import { formatVolume } from '$lib/utils/format.js';

	// Local values bound to sliders, synced to store via $effect
	const defaults = {
		volume: appStore.tcoInputs.monthlyVolume,
		inputTokens: appStore.tcoInputs.avgInputTokens,
		outputTokens: appStore.tcoInputs.avgOutputTokens,
	};
	let volume = $state(defaults.volume);
	let inputTokens = $state(defaults.inputTokens);
	let outputTokens = $state(defaults.outputTokens);

	// Track the last values we wrote to store to avoid loops
	let lastWritten = { ...defaults };

	$effect(() => {
		// Only write if local value actually changed
		if (volume !== lastWritten.volume || inputTokens !== lastWritten.inputTokens || outputTokens !== lastWritten.outputTokens) {
			lastWritten = { volume, inputTokens, outputTokens };
			appStore.updateTCOInputs({
				monthlyVolume: volume,
				avgInputTokens: inputTokens,
				avgOutputTokens: outputTokens,
			});
		}
	});

	function setTokenPreset(preset: (typeof tokenSizePresets)[number]) {
		inputTokens = preset.input;
		outputTokens = preset.output;
	}
</script>

<div class="volume-inputs">
	<Slider
		label="Monthly requests"
		bind:value={volume}
		min={100}
		max={1_000_000}
		step={100}
		formatValue={formatVolume}
		presets={volumePresets}
	/>

	<Slider
		label="Avg input tokens"
		bind:value={inputTokens}
		min={50}
		max={16_000}
		step={50}
		formatValue={(v) => v.toLocaleString()}
	/>

	<Slider
		label="Avg output tokens"
		bind:value={outputTokens}
		min={25}
		max={8_000}
		step={25}
		formatValue={(v) => v.toLocaleString()}
	/>

	<div class="token-presets">
		<span class="preset-label">Task type:</span>
		{#each tokenSizePresets as preset}
			<button
				class="preset-btn"
				class:active={inputTokens === preset.input && outputTokens === preset.output}
				onclick={() => setTokenPreset(preset)}
				title={preset.description}
			>
				{preset.label}
			</button>
		{/each}
	</div>
</div>

<style>
	.volume-inputs {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.token-presets {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.preset-label {
		font-family: var(--font-mono);
		font-size: 0.6875rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--tx-3);
	}

	.preset-btn {
		padding: 0.375rem 0.75rem;
		font-family: var(--font-mono);
		font-size: 0.75rem;
		background: var(--bg-3);
		color: var(--tx);
		border: 1px solid var(--ui);
		border-radius: var(--radius-full);
		cursor: pointer;
		transition: all 150ms ease;
	}

	.preset-btn:hover {
		border-color: var(--ui-2);
	}

	.preset-btn.active {
		background: var(--primary);
		color: var(--primary-content);
		border-color: var(--primary);
	}
</style>
