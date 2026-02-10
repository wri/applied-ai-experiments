<script lang="ts">
	import { browser } from '$app/environment';
	import '@wri-datalab/ui/styles';
	import './+layout.css';

	let { children } = $props();

	if (browser) {
		const stored = localStorage.getItem('theme');
		const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
		const theme = stored || (prefersDark ? 'dark' : 'light');
		document.documentElement.setAttribute('data-theme', theme);
		document.documentElement.setAttribute('data-variant', 'prototype');
	}
</script>

<div data-variant="prototype">
	{@render children()}
</div>
