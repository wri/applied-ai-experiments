/**
 * Command registry: global commands plus per-demo contributions, consumed by
 * the app-wide ⌘K palette. Demos register commands in an $effect and clean up
 * on unmount. An action log records what ran (surfaced by the palette demo).
 */

import { untrack } from 'svelte';

export interface CommandContext {
	/** free text following the command, for parameterized commands */
	input: string;
	closePalette: () => void;
}

export interface Command {
	id: string;
	title: string;
	/** shown dimmed after the title */
	hint?: string;
	section: 'Navigate' | 'Map' | 'App' | 'AI' | 'Demo';
	/** extra match terms */
	keywords?: string;
	/** if true, the command consumes the rest of the query as input */
	parameterized?: boolean;
	run: (ctx: CommandContext) => void | Promise<void>;
}

export interface ActionLogEntry {
	at: string;
	commandId: string;
	title: string;
	input?: string;
}

class CommandRegistry {
	private globalCommands = $state<Command[]>([]);
	private demoCommands = $state<Command[]>([]);
	log = $state<ActionLogEntry[]>([]);
	paletteOpen = $state(false);

	readonly all = $derived([...this.demoCommands, ...this.globalCommands]);

	registerGlobal(commands: Command[]) {
		this.globalCommands = commands;
	}

	/**
	 * Register demo-scoped commands; returns an unregister fn for $effect
	 * cleanup. Reads go through untrack so calling this inside an $effect never
	 * makes the effect depend on the command list it is writing.
	 */
	registerDemo(commands: Command[]): () => void {
		this.demoCommands = [...untrack(() => this.demoCommands), ...commands];
		return () => {
			const ids = new Set(commands.map((c) => c.id));
			this.demoCommands = untrack(() => this.demoCommands).filter((c) => !ids.has(c.id));
		};
	}

	record(command: Command, input?: string) {
		this.log = [
			{ at: new Date().toLocaleTimeString(), commandId: command.id, title: command.title, input },
			...untrack(() => this.log)
		].slice(0, 30);
	}
}

export const commands = new CommandRegistry();

/**
 * Subsequence fuzzy scorer (no dependency): higher is better, null = no match.
 */
export function fuzzyScore(query: string, target: string): number | null {
	const q = query.toLowerCase();
	const t = target.toLowerCase();
	if (!q) return 0;
	let qi = 0;
	let score = 0;
	let streak = 0;
	for (let ti = 0; ti < t.length && qi < q.length; ti++) {
		if (t[ti] === q[qi]) {
			qi++;
			streak++;
			score += 1 + streak * 2 + (ti === 0 || t[ti - 1] === ' ' ? 4 : 0);
		} else {
			streak = 0;
		}
	}
	if (qi < q.length) return null;
	return score - t.length * 0.05;
}
