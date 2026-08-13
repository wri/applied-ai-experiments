<script lang="ts">
	import { Modal, ApiKeyManager, Select, Toggle } from '@wri-datalab/ui';
	import { stores } from '$lib/stores';
	import { llm } from '$lib/llm/provider.svelte';
	import { MODELS, type ModelId } from '$lib/llm/types';

	let { open = $bindable(false) }: { open?: boolean } = $props();

	// Mode toggle mirrors the provider; the effect pushes changes back.
	let forceMock = $state(llm.forceMock);
	$effect(() => {
		llm.setForceMock(forceMock);
	});
</script>

<Modal bind:open title="Settings" size="md">
	<div class="section">
		<div class="label">Anthropic API key (BYOK)</div>
		<p class="hint">
			Stored only in this browser; calls go directly to the provider. Without a key, every demo
			runs in deterministic mock mode.
		</p>
		<ApiKeyManager {stores} providers={['anthropic']} />
	</div>

	<div class="section">
		<div class="label">Model</div>
		<Select
			value={llm.model}
			options={MODELS.map((m) => ({ value: m.id, label: `${m.label} (${m.tier})` }))}
			onchange={(v) => llm.setModel(v as ModelId)}
		/>
	</div>

	<div class="section">
		<div class="label">Mode</div>
		<Toggle bind:checked={forceMock} label="Force mock mode (deterministic, free — even with a key)" />
		<p class="hint">
			Current mode: <strong>{llm.mode}</strong>
		</p>
	</div>
</Modal>

<style>
	.section {
		margin-bottom: var(--space-5);
	}
	.section:last-child {
		margin-bottom: 0;
	}
	.hint {
		font-family: var(--font-mono);
		font-size: 0.68rem;
		color: var(--tx-3);
		margin: 0.3rem 0 0.5rem;
		line-height: 1.45;
	}
</style>
