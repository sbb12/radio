import { writable } from 'svelte/store';

export type ToastType = 'success' | 'error' | 'info';

export interface Toast {
    id: number;
    message: string;
    type: ToastType;
}

function createToastStore() {
    const { subscribe, update } = writable<Toast[]>([]);

    return {
        subscribe,
        add: (message: string, type: ToastType = 'info', duration = 3000) => {
            const id = Date.now();
            update((toasts) => [...toasts, { id, message, type }]);
            setTimeout(() => {
                update((toasts) => toasts.filter((t) => t.id !== id));
            }, duration);
        },
        remove: (id: number) => {
            update((toasts) => toasts.filter((t) => t.id !== id));
        }
    };
}

export const toasts = createToastStore();
