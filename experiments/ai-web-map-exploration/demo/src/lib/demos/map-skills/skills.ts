import { loadText } from '$lib/data/load';

export interface Skill {
	file: string;
	name: string;
	description: string;
	triggers: string[];
	tools: string[];
	body: string;
	raw: string;
}

export const SKILL_FILES = [
	'flood-exposure-assessment.md',
	'change-detection-triage.md',
	'viewport-storytelling.md'
];

/** Minimal frontmatter parser: `key: value` and `- item` lists (quoted or not). */
function parseFrontmatter(fm: string): Record<string, string | string[]> {
	const out: Record<string, string | string[]> = {};
	let currentKey: string | null = null;
	for (const line of fm.split('\n')) {
		const listMatch = line.match(/^\s+-\s+(.*)$/);
		if (listMatch && currentKey) {
			const arr = (out[currentKey] as string[]) ?? [];
			arr.push(listMatch[1].replace(/^["']|["']$/g, ''));
			out[currentKey] = arr;
			continue;
		}
		const kv = line.match(/^(\w[\w-]*):\s*(.*)$/);
		if (kv) {
			currentKey = kv[1];
			if (kv[2]) out[currentKey] = kv[2].replace(/^["']|["']$/g, '');
			else out[currentKey] = [];
		}
	}
	return out;
}

export function parseSkill(file: string, raw: string): Skill {
	const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
	const fm = m ? parseFrontmatter(m[1]) : {};
	return {
		file,
		name: String(fm.name ?? file.replace('.md', '')),
		description: String(fm.description ?? ''),
		triggers: Array.isArray(fm.triggers) ? fm.triggers : [],
		tools: Array.isArray(fm.tools) ? fm.tools : [],
		body: m ? m[2].trim() : raw,
		raw
	};
}

export async function loadSkills(): Promise<Skill[]> {
	return Promise.all(
		SKILL_FILES.map(async (f) => parseSkill(f, await loadText(`skills/${f}`)))
	);
}
