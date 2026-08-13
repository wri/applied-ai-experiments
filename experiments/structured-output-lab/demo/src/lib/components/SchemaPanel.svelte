<script lang="ts">
	import { Tabs, Textarea, Alert } from '@wri-datalab/ui';
	import { TEMPLATES } from '../schemas/templates';
	import type { Lab } from '../state/lab.svelte';

	interface Props {
		lab: Lab;
	}

	let { lab }: Props = $props();

	const activeTab = $derived(lab.schemaMode === 'raw' ? 'raw' : 'templates');

	function handleTabChange(id: string) {
		if (id === 'raw' && lab.schemaMode === 'template') {
			// Seed the editor with the selected template so users edit, not start blank
			lab.syncRawFromTemplate();
		}
		lab.schemaMode = id === 'raw' ? 'raw' : 'template';
	}
</script>

<Tabs
	items={[
		{ id: 'templates', label: 'Templates' },
		{ id: 'raw', label: 'Raw JSON Schema' },
	]}
	active={activeTab}
	size="sm"
	onchange={handleTabChange}
/>

{#if activeTab === 'templates'}
	<div class="template-grid">
		{#each TEMPLATES as template (template.id)}
			<button
				type="button"
				class="template-card"
				class:selected={lab.templateId === template.id}
				onclick={() => (lab.templateId = template.id)}
			>
				<span class="template-name">{template.name}</span>
				<span class="template-desc">{template.description}</span>
			</button>
		{/each}
	</div>
{:else}
	<Textarea
		bind:value={lab.rawSchemaText}
		label="JSON Schema"
		minRows={16}
		spellcheck={false}
		class="schema-editor"
	/>
	{#if lab.schemaState.error}
		<Alert variant="error">{lab.schemaState.error}</Alert>
	{:else}
		<Alert variant="success">Schema is valid.</Alert>
	{/if}
{/if}

<style>
	.template-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(10rem, 1fr));
		gap: var(--space-2, 0.5rem);
		margin-top: var(--space-3, 0.75rem);
	}

	.template-card {
		display: flex;
		flex-direction: column;
		gap: var(--space-1, 0.25rem);
		padding: var(--space-3, 0.75rem);
		border: 1px solid var(--ui, #333);
		border-radius: var(--radius-md, 6px);
		background: var(--bg-2);
		color: var(--tx);
		text-align: left;
		cursor: pointer;
		transition: border-color 120ms ease;
	}

	.template-card:hover {
		border-color: var(--tx-2);
	}

	.template-card.selected {
		border-color: var(--accent, #d97706);
		outline: 1px solid var(--accent, #d97706);
	}

	.template-name {
		font-weight: 600;
		font-size: 0.85rem;
	}

	.template-desc {
		font-size: 0.75rem;
		color: var(--tx-2);
	}

	:global(.schema-editor textarea) {
		font-family: var(--font-mono);
		font-size: 0.8rem;
	}
</style>
