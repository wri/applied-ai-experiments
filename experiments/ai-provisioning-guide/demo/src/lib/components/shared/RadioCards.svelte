<script lang="ts">
	interface Option {
		id: string;
		label: string;
		description: string;
	}

	interface Props {
		options: Option[];
		value?: string | undefined;
		name: string;
		onchange?: (id: string) => void;
	}

	let { options, value = $bindable(undefined), name, onchange }: Props = $props();

	function select(id: string) {
		value = id;
		onchange?.(id);
	}

	function handleKeydown(event: KeyboardEvent, index: number) {
		let newIndex = -1;
		if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
			newIndex = (index + 1) % options.length;
			event.preventDefault();
		} else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
			newIndex = (index - 1 + options.length) % options.length;
			event.preventDefault();
		}
		if (newIndex >= 0) {
			select(options[newIndex].id);
			const el = document.querySelector(`[data-radio-id="${name}-${options[newIndex].id}"]`) as HTMLElement;
			el?.focus();
		}
	}
</script>

<div class="radio-cards" role="radiogroup" aria-label={name}>
	{#each options as option, index}
		{@const isSelected = value === option.id}
		<button
			type="button"
			role="radio"
			aria-checked={isSelected}
			tabindex={isSelected || (!value && index === 0) ? 0 : -1}
			data-radio-id="{name}-{option.id}"
			onclick={() => select(option.id)}
			onkeydown={(e) => handleKeydown(e, index)}
			class="radio-card"
			class:selected={isSelected}
		>
			<div class="radio-indicator">
				{#if isSelected}
					<div class="radio-dot"></div>
				{/if}
			</div>
			<div class="radio-content">
				<div class="radio-label">{option.label}</div>
				<div class="radio-description">{option.description}</div>
			</div>
		</button>
	{/each}
</div>

<style>
	.radio-cards {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.radio-card {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		padding: 0.75rem 1rem;
		background: var(--bg-2);
		border: 1px solid var(--ui);
		border-radius: var(--radius-md);
		cursor: pointer;
		text-align: left;
		transition: all 150ms ease;
		width: 100%;
	}

	.radio-card:hover {
		border-color: var(--ui-2);
		background: var(--bg-3);
	}

	.radio-card.selected {
		border-color: var(--primary);
		background: oklch(from var(--primary) l c h / 0.08);
	}

	.radio-card:focus-visible {
		outline: 2px solid var(--focus-ring-color);
		outline-offset: 2px;
	}

	.radio-indicator {
		width: 1.25rem;
		height: 1.25rem;
		border-radius: 50%;
		border: 2px solid var(--ui);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		margin-top: 0.125rem;
		transition: border-color 150ms ease;
	}

	.selected .radio-indicator {
		border-color: var(--primary);
	}

	.radio-dot {
		width: 0.5rem;
		height: 0.5rem;
		border-radius: 50%;
		background: var(--primary);
	}

	.radio-content {
		flex: 1;
		min-width: 0;
	}

	.radio-label {
		font-family: var(--font-mono);
		font-size: 0.8125rem;
		font-weight: 500;
		color: var(--tx);
		line-height: 1.3;
	}

	.radio-description {
		font-size: 0.75rem;
		color: var(--tx-2);
		margin-top: 0.125rem;
		line-height: 1.4;
	}
</style>
