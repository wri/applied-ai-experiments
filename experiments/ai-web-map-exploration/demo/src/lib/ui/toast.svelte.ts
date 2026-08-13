/**
 * Toast adapter: preserves this app's original `toasts` store API
 * (push/dismiss/clear with title/body/tone/actions) on top of the shared
 * `@wri-datalab/ui` toast store, which backs the <ToastContainer/> mounted in
 * the layout. Same adapter pattern as $lib/llm and the Badge wrapper.
 */

import { toast } from '@wri-datalab/ui';

export interface ToastAction {
	label: string;
	run: () => void;
}

export interface ToastItem {
	title: string;
	body?: string;
	tone: 'info' | 'warning' | 'error';
	actions?: ToastAction[];
}

const AUTO_DISMISS_MS = 8000;

class ToastAdapter {
	push(t: ToastItem): string {
		const message = t.body ? `${t.title} — ${t.body}` : t.title;
		// Action toasts wait for the user (duration 0 = no auto-dismiss); plain
		// ones self-dismiss. The shared toast supports a single action.
		const first = t.actions?.[0];
		return toast[t.tone](message, {
			duration: t.actions?.length ? 0 : AUTO_DISMISS_MS,
			action: first ? { label: first.label, onclick: first.run } : undefined
		});
	}

	dismiss(id: string): void {
		toast.dismiss(id);
	}

	clear(): void {
		toast.clear();
	}
}

export const toasts = new ToastAdapter();
