<script lang="ts">
	import { estimateTokens } from '$lib/context/snapshot';

	interface Props {
		title: string;
		data?: unknown;
		text?: string;
		open?: boolean;
	}

	let { title, data, text, open = false }: Props = $props();

	const body = $derived(text ?? JSON.stringify(data, null, 2));
	let copied = $state(false);

	async function copy(e: MouseEvent) {
		e.preventDefault();
		e.stopPropagation();
		await navigator.clipboard.writeText(body);
		copied = true;
		setTimeout(() => (copied = false), 1200);
	}
</script>

<details {open}>
	<summary>
		<span class="name">{title}</span>
		<span class="meta">
			<button class="copy" onclick={copy}>{copied ? 'copied' : 'copy'}</button>
			<span class="tok">~{estimateTokens(body)} tok</span>
		</span>
	</summary>
	<pre>{body}</pre>
</details>

<style>
	details {
		border-bottom: 1px solid var(--ui);
	}
	details:last-child {
		border-bottom: none;
	}
	summary {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.45rem var(--space-3);
		cursor: pointer;
		font-family: var(--font-mono);
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--tx-2);
		user-select: none;
	}
	summary::-webkit-details-marker {
		display: none;
	}
	summary::before {
		content: '▸';
		margin-right: 0.4rem;
		color: var(--tx-3);
	}
	details[open] summary::before {
		content: '▾';
	}
	.name {
		flex: 1;
	}
	.meta {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}
	.copy {
		background: none;
		border: none;
		color: var(--tx-3);
		font-family: var(--font-mono);
		font-size: 0.6rem;
		cursor: pointer;
		padding: 0;
		text-transform: none;
	}
	.copy:hover {
		color: var(--primary);
	}
	.tok {
		font-size: 0.6rem;
		color: var(--tx-3);
		text-transform: none;
	}
	pre {
		margin: 0;
		padding: var(--space-2) var(--space-3) var(--space-3);
		font-family: var(--font-mono);
		font-size: 0.65rem;
		line-height: 1.5;
		color: var(--tx);
		overflow-x: auto;
		max-height: 16rem;
		overflow-y: auto;
		background: var(--bg);
	}
</style>
