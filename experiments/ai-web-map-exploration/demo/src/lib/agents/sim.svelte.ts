/**
 * Tick engine: plays a scripted timeline of store mutations (status changes,
 * log lines, asset attachments, arbitrary hooks) with start/pause/reset.
 * Entirely deterministic — the agentic demos are honest simulations.
 */

export interface SimEvent {
	/** ms from timeline start */
	at: number;
	run: () => void;
}

export class Sim {
	playing = $state(false);
	finished = $state(false);
	/** index of next event to fire */
	progress = $state(0);

	private events: SimEvent[] = [];
	private generation = 0;
	private onReset: () => void;

	constructor(events: SimEvent[], onReset: () => void) {
		this.events = [...events].sort((a, b) => a.at - b.at);
		this.onReset = onReset;
	}

	get total(): number {
		return this.events.length;
	}

	async play() {
		if (this.playing) return;
		if (this.finished) this.reset();
		const gen = ++this.generation;
		this.playing = true;
		const startIndex = this.progress;
		const startAt = startIndex > 0 ? this.events[startIndex - 1].at : 0;
		const t0 = performance.now() - startAt;

		for (let i = startIndex; i < this.events.length; i++) {
			const ev = this.events[i];
			const wait = ev.at - (performance.now() - t0);
			if (wait > 0) await new Promise((r) => setTimeout(r, wait));
			if (this.generation !== gen) return; // paused or reset
			ev.run();
			this.progress = i + 1;
		}
		if (this.generation !== gen) return;
		this.playing = false;
		this.finished = true;
	}

	pause() {
		this.generation++;
		this.playing = false;
	}

	reset() {
		this.generation++;
		this.playing = false;
		this.finished = false;
		this.progress = 0;
		this.onReset();
	}
}
