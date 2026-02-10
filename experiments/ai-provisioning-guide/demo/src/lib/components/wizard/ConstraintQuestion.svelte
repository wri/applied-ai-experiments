<script lang="ts">
	import type { ConstraintQuestion as QuestionType } from '$lib/types.js';
	import RadioCards from '../shared/RadioCards.svelte';

	interface Props {
		question: QuestionType;
		value?: string;
		onchange?: (optionId: string) => void;
	}

	let { question, value = undefined, onchange }: Props = $props();
</script>

<div class="constraint-question">
	<div class="question-header">
		<h2>{question.title}</h2>
		<p>{question.description}</p>
	</div>

	<RadioCards
		options={question.options}
		{value}
		name={question.id}
		{onchange}
	/>
</div>

<style>
	.constraint-question {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.question-header h2 {
		font-size: 1rem;
		font-family: var(--font-mono);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--tx);
		margin: 0;
	}

	.question-header p {
		font-size: 0.8125rem;
		color: var(--tx-2);
		margin: 0.25rem 0 0;
		line-height: 1.5;
	}
</style>
