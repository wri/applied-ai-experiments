export interface SampleQuestion {
	id: string;
	name: string;
	text: string;
}

// Questions where the answer is a judgement call — those diverge across runs and make an
// interesting heatmap. Factual questions converge and make a boring one. Two trade-off
// shapes, two "what are the risks of…" shapes.
//
// [0] is load-bearing twice over: it is the demo's default question (see trials.svelte.ts)
// and it must stay character-identical to config.question in replay/session.json, so a
// keyless visitor who never touches the dropdown sees a question the recording answers.
export const SAMPLE_QUESTIONS: SampleQuestion[] = [
	{
		id: 'urban-flooding',
		name: 'Street trees vs wetlands',
		text: 'Should a mid-sized city prioritize planting street trees or restoring nearby wetlands to reduce urban flooding? Give a recommendation with the key tradeoffs.',
	},
	{
		id: 'deforestation-alerts',
		name: 'Deforestation alert risks',
		text: 'What are the biggest risks in relying on satellite-derived deforestation alerts for enforcement decisions? Give a short, prioritized answer.',
	},
	{
		id: 'grid-storage-vs-transmission',
		name: 'Storage vs transmission',
		text: 'A country adding large amounts of solar has to choose where to spend first: battery storage or long-distance transmission. Which should it prioritize, and what are the key tradeoffs?',
	},
	{
		id: 'smallholder-mrv',
		name: 'Smallholder carbon MRV risks',
		text: 'What are the biggest risks in using remote-sensing MRV to verify carbon removals from smallholder agroforestry? Give a short, prioritized answer.',
	},
];
