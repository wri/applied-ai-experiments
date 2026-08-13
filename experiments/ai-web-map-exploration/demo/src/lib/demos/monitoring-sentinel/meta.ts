import type { DemoDefinition } from '../types';

export const meta: DemoDefinition = {
	slug: 'monitoring-sentinel',
	title: 'Monitoring Sentinel',
	category: 'ambitious',
	order: 3,
	blurb: 'A standing watch, and the design of being interrupted',
	description:
		'Write a watch condition in plain language; it becomes a machine-checkable rule. A scrubbable clock plays a time-compressed flood scenario against the (modelled) Zambezi data, and when the rule trips, the alert escalates through levels you can feel and compare — ambient dot, toast, briefing card, tap-to-verify flyover — with a per-watch interruption budget you control. Includes a scripted near-miss, because false alarms are the real design problem.',
	usesLlm: true,
	map: {
		camera: {
			center: [35.35, -17.9],
			zoom: 8
		},
		basemap: 'streets'
	},
	status: 'ready'
};
