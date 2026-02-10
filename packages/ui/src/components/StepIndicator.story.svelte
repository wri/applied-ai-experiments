<script lang="ts" module>
  export const meta = {
    title: 'StepIndicator',
    description: 'Progress indicator for multi-step processes',
    category: 'Core UI',
  };
</script>

<script lang="ts">
  import StepIndicator from './StepIndicator.svelte';
  import Button from './Button.svelte';

  let currentStep = $state(1);
  const steps = ['Setup', 'Configure', 'Review', 'Deploy'];

  function nextStep() {
    if (currentStep < steps.length - 1) {
      currentStep++;
    }
  }

  function prevStep() {
    if (currentStep > 0) {
      currentStep--;
    }
  }
</script>

<section>
  <h3>Interactive</h3>
  <div style="display: flex; flex-direction: column; gap: 1.5rem;">
    <StepIndicator {steps} current={currentStep} />
    <div style="display: flex; gap: 0.5rem;">
      <Button variant="secondary" onclick={prevStep} disabled={currentStep === 0}>
        Previous
      </Button>
      <Button variant="primary" onclick={nextStep} disabled={currentStep === steps.length - 1}>
        Next
      </Button>
    </div>
    <p style="margin: 0; font-size: 0.875rem; color: var(--tx-2);">
      Current step: {steps[currentStep]} ({currentStep + 1} of {steps.length})
    </p>
  </div>
</section>

<section>
  <h3>Different States</h3>
  <div style="display: flex; flex-direction: column; gap: 2rem;">
    <div>
      <p style="margin: 0 0 0.5rem 0; font-size: 0.75rem; color: var(--tx-3); text-transform: uppercase;">First Step</p>
      <StepIndicator steps={['Upload', 'Process', 'Complete']} current={0} />
    </div>
    <div>
      <p style="margin: 0 0 0.5rem 0; font-size: 0.75rem; color: var(--tx-3); text-transform: uppercase;">Middle Step</p>
      <StepIndicator steps={['Upload', 'Process', 'Complete']} current={1} />
    </div>
    <div>
      <p style="margin: 0 0 0.5rem 0; font-size: 0.75rem; color: var(--tx-3); text-transform: uppercase;">Last Step</p>
      <StepIndicator steps={['Upload', 'Process', 'Complete']} current={2} />
    </div>
  </div>
</section>

<section>
  <h3>More Steps</h3>
  <StepIndicator
    steps={['Connect', 'Auth', 'Select', 'Configure', 'Test', 'Deploy']}
    current={3}
  />
</section>

<section>
  <h3>Two Steps</h3>
  <StepIndicator steps={['Choose Model', 'Start Chat']} current={0} />
</section>
