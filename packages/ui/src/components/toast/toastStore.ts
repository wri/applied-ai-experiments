import { writable, type Readable } from 'svelte/store';

export interface ToastAction {
  label: string;
  onclick: () => void;
}

export interface Toast {
  id: string;
  message: string;
  variant: 'info' | 'success' | 'warning' | 'error';
  duration: number;
  dismissible: boolean;
  action?: ToastAction;
}

export interface ToastOptions {
  message: string;
  variant?: 'info' | 'success' | 'warning' | 'error';
  duration?: number;
  dismissible?: boolean;
  action?: ToastAction;
}

export interface ToastStore extends Readable<Toast[]> {
  add: (options: ToastOptions) => string;
  remove: (id: string) => void;
  clear: () => void;
}

function createToastStore(): ToastStore {
  const { subscribe, update, set } = writable<Toast[]>([]);

  function generateId(): string {
    return `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  function add(options: ToastOptions): string {
    const id = generateId();
    const toastItem: Toast = {
      id,
      message: options.message,
      variant: options.variant || 'info',
      duration: options.duration ?? 5000,
      dismissible: options.dismissible ?? true,
      action: options.action,
    };

    update((toasts) => [...toasts, toastItem]);

    // Auto-dismiss if duration > 0
    if (toastItem.duration > 0) {
      setTimeout(() => {
        remove(id);
      }, toastItem.duration);
    }

    return id;
  }

  function remove(id: string): void {
    update((toasts) => toasts.filter((t) => t.id !== id));
  }

  function clear(): void {
    set([]);
  }

  return {
    subscribe,
    add,
    remove,
    clear,
  };
}

export const toastStore = createToastStore();

// Convenience methods
export const toast = {
  info: (message: string, options?: Partial<ToastOptions>) =>
    toastStore.add({ message, variant: 'info', ...options }),
  success: (message: string, options?: Partial<ToastOptions>) =>
    toastStore.add({ message, variant: 'success', ...options }),
  warning: (message: string, options?: Partial<ToastOptions>) =>
    toastStore.add({ message, variant: 'warning', ...options }),
  error: (message: string, options?: Partial<ToastOptions>) =>
    toastStore.add({ message, variant: 'error', ...options }),
  dismiss: (id: string) => toastStore.remove(id),
  clear: () => toastStore.clear(),
};
