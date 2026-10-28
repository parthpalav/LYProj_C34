import { create } from 'zustand';

export type CelebrationKind = 'fireworks' | 'piggy' | 'coins' | 'trophy' | 'confetti' | 'toast';

export interface CelebrationInput {
  kind: CelebrationKind;
  title: string;
  subtitle?: string;
  /** toast only: icon and haptic. Defaults to success. */
  tone?: 'success' | 'warning' | 'error' | 'info';
  /** toast only: inline action such as Undo; keeps the toast up longer */
  action?: { label: string; onPress: () => void };
  /** piggy only: fill fraction (0-1) before and after the contribution */
  from?: number;
  to?: number;
}

export interface Celebration extends CelebrationInput {
  id: number;
}

interface CelebrationState {
  current: Celebration | null;
  celebrate: (input: CelebrationInput) => void;
  dismiss: (id?: number) => void;
}

let nextId = 1;

export const useCelebrationStore = create<CelebrationState>((set, get) => ({
  current: null,
  // A new celebration replaces the one on screen, so rapid actions never queue up.
  celebrate: (input) => set({ current: { ...input, id: nextId++ } }),
  dismiss: (id) => {
    if (id === undefined || get().current?.id === id) set({ current: null });
  },
}));

/** Call from anywhere (screens, handlers) without subscribing to the store. */
export const celebrate = (input: CelebrationInput) => useCelebrationStore.getState().celebrate(input);

/** Short status message at the top of the screen. Use instead of Alert.alert for non-blocking feedback. */
export const toast = (title: string, opts: Omit<CelebrationInput, 'kind' | 'title'> = {}) =>
  useCelebrationStore.getState().celebrate({ kind: 'toast', title, ...opts });
