export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastConfig {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

export interface ToastState {
  toasts: ToastConfig[];
  show: (config: Omit<ToastConfig, 'id'>) => void;
  hide: (id: string) => void;
  hideAll: () => void;
}

let toastCounter = 0;

export function createToastId(): string {
  return `toast-${++toastCounter}-${Date.now()}`;
}

export function useToastStub(): ToastState {
  return {
    toasts: [],
    show: (config) => {
      console.log('[Toast]', config.type, config.title, config.message);
    },
    hide: (id) => {
      console.log('[Toast] Hide:', id);
    },
    hideAll: () => {
      console.log('[Toast] Hide all');
    },
  };
}
