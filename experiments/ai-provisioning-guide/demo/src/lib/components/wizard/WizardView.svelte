<script lang="ts">
	import { StepIndicator, Button } from '@wri-datalab/ui';
	import { appStore } from '$lib/stores/app.svelte.js';
	import { constraintQuestions } from '$lib/data/constraints.js';
	import { ALL_CONSTRAINT_IDS } from '$lib/types.js';
	import ConstraintQuestion from './ConstraintQuestion.svelte';
	import ResultsSummary from './ResultsSummary.svelte';

	const totalSteps = constraintQuestions.length;
	const stepLabels = [...constraintQuestions.map((q) => q.title.split('?')[0].split(' ').slice(0, 3).join(' ')), 'Results'];

	const isResultsStep = $derived(appStore.wizardStep >= totalSteps);
	const currentQuestion = $derived(
		isResultsStep ? null : constraintQuestions[appStore.wizardStep],
	);
	const currentAnswer = $derived(
		currentQuestion ? appStore.constraintAnswers[currentQuestion.id] : undefined,
	);
	const canAdvance = $derived(isResultsStep || currentAnswer != null);

	function next() {
		if (appStore.wizardStep < totalSteps) {
			appStore.setWizardStep(appStore.wizardStep + 1);
		}
	}

	function back() {
		if (appStore.wizardStep > 0) {
			appStore.setWizardStep(appStore.wizardStep - 1);
		}
	}

	function handleAnswer(optionId: string) {
		if (currentQuestion) {
			appStore.answerConstraint(currentQuestion.id, optionId);
		}
	}
</script>

<div class="wizard-view">
	<div class="wizard-progress">
		<StepIndicator steps={stepLabels} current={appStore.wizardStep} />
	</div>

	<div class="wizard-content">
		{#if isResultsStep}
			<ResultsSummary />
		{:else if currentQuestion}
			<ConstraintQuestion
				question={currentQuestion}
				value={currentAnswer}
				onchange={handleAnswer}
			/>
		{/if}
	</div>

	<div class="wizard-nav">
		<Button
			variant="ghost"
			size="sm"
			disabled={appStore.wizardStep === 0}
			onclick={back}
		>
			Back
		</Button>

		<div class="wizard-nav-right">
			{#if !isResultsStep}
				<Button
					variant="ghost"
					size="sm"
					onclick={() => appStore.setWizardStep(totalSteps)}
				>
					Skip to results
				</Button>
			{/if}
			{#if !isResultsStep}
				<Button
					variant="primary"
					size="sm"
					disabled={!canAdvance}
					onclick={next}
				>
					{appStore.wizardStep === totalSteps - 1 ? 'See results' : 'Next'}
				</Button>
			{/if}
		</div>
	</div>
</div>

<style>
	.wizard-view {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		max-width: 48rem;
		width: 100%;
		margin: 0 auto;
		min-width: 0;
	}

	.wizard-progress {
		overflow-x: auto;
		padding-bottom: 0.5rem;
		-webkit-overflow-scrolling: touch;
	}

	.wizard-content {
		min-height: 20rem;
	}

	.wizard-nav {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding-top: 1rem;
		border-top: 1px solid var(--ui);
	}

	.wizard-nav-right {
		display: flex;
		gap: 0.5rem;
	}

	@media (max-width: 640px) {
		.wizard-view {
			gap: 1rem;
		}

		.wizard-content {
			min-height: 0;
		}
	}
</style>
