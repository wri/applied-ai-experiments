<script>
	import { Button, Panel, Card, ThemeSwitcher } from '@wri-datalab/ui';

	// CHANGEME: Add your component logic here
	let message = $state('Hello from the prototype!');
</script>

<main>
	<header>
		<h1>CHANGEME: Prototype Title</h1>
		<ThemeSwitcher />
	</header>

	<Panel title="About">
		<p>CHANGEME: Describe what this prototype demonstrates.</p>
	</Panel>

	<Panel title="Try It Out">
		<!-- CHANGEME: Add your interactive demo here -->
		<p>{message}</p>
		<Button variant="primary" onclick={() => (message = 'Button clicked!')}>
			Click Me
		</Button>
	</Panel>
</main>

<style>
	main {
		max-width: 800px;
		margin: 0 auto;
		padding: var(--space-8, 2rem);
		display: flex;
		flex-direction: column;
		gap: var(--space-6, 1.5rem);
	}

	header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		border-bottom: 2px solid var(--ui);
		padding-bottom: var(--space-2, 0.5rem);
	}

	h1 {
		color: var(--tx);
		margin: 0;
	}
</style>
