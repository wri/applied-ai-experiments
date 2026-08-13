export interface SchemaTemplate {
	id: string;
	name: string;
	description: string;
	schema: Record<string, unknown>;
}

export const TEMPLATES: SchemaTemplate[] = [
	{
		id: 'risks',
		name: 'Risks',
		description: 'Risks with severity and supporting evidence',
		schema: {
			type: 'object',
			required: ['title', 'risks'],
			properties: {
				title: { type: 'string', description: 'Short title for the source document' },
				deadline: {
					type: ['string', 'null'],
					description: 'Most important deadline mentioned, ISO date if possible',
				},
				risks: {
					type: 'array',
					items: {
						type: 'object',
						required: ['risk', 'severity', 'evidence'],
						properties: {
							risk: { type: 'string' },
							severity: { type: 'string', enum: ['low', 'medium', 'high'] },
							evidence: { type: 'string', description: 'Verbatim quote from the source' },
						},
					},
				},
			},
		},
	},
	{
		id: 'action-items',
		name: 'Action items',
		description: 'Tasks with owners, deadlines, and priority',
		schema: {
			type: 'object',
			required: ['action_items'],
			properties: {
				action_items: {
					type: 'array',
					items: {
						type: 'object',
						required: ['task', 'owner', 'deadline', 'priority'],
						properties: {
							task: { type: 'string' },
							owner: { type: ['string', 'null'] },
							deadline: { type: ['string', 'null'], description: 'ISO date if possible' },
							priority: { type: 'string', enum: ['low', 'medium', 'high'] },
						},
					},
				},
			},
		},
	},
	{
		id: 'stakeholders',
		name: 'Stakeholders',
		description: 'Actors, their roles, and influence',
		schema: {
			type: 'object',
			required: ['stakeholders'],
			properties: {
				stakeholders: {
					type: 'array',
					items: {
						type: 'object',
						required: ['name', 'role', 'influence'],
						properties: {
							name: { type: 'string' },
							organization: { type: ['string', 'null'] },
							role: { type: 'string' },
							interest: { type: ['string', 'null'] },
							influence: { type: 'string', enum: ['low', 'medium', 'high'] },
						},
					},
				},
			},
		},
	},
	{
		id: 'budget-lines',
		name: 'Budget lines',
		description: 'Monetary amounts with categories',
		schema: {
			type: 'object',
			required: ['budget_lines'],
			properties: {
				currency: { type: ['string', 'null'] },
				budget_lines: {
					type: 'array',
					items: {
						type: 'object',
						required: ['item', 'amount'],
						properties: {
							item: { type: 'string' },
							amount: { type: ['number', 'string'] },
							category: { type: ['string', 'null'] },
							note: { type: ['string', 'null'] },
						},
					},
				},
			},
		},
	},
	{
		id: 'entities',
		name: 'Entities',
		description: 'Named entities with types and context',
		schema: {
			type: 'object',
			required: ['entities'],
			properties: {
				entities: {
					type: 'array',
					items: {
						type: 'object',
						required: ['text', 'type'],
						properties: {
							text: { type: 'string' },
							type: {
								type: 'string',
								enum: ['person', 'organization', 'location', 'date', 'money', 'other'],
							},
							context: { type: ['string', 'null'] },
						},
					},
				},
			},
		},
	},
	{
		id: 'claim-evidence',
		name: 'Claim / evidence pairs',
		description: 'Claims with verbatim evidence and confidence',
		schema: {
			type: 'object',
			required: ['claims'],
			properties: {
				claims: {
					type: 'array',
					items: {
						type: 'object',
						required: ['claim', 'evidence', 'confidence'],
						properties: {
							claim: { type: 'string' },
							evidence: { type: 'string', description: 'Verbatim quote from the source' },
							confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
						},
					},
				},
			},
		},
	},
];

export function getTemplate(id: string): SchemaTemplate {
	return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0];
}
