import { create } from 'zustand';

export type CelebrationKind = 'fireworks' | 'piggy' | 'coins' | 'trophy' | 'confetti' | 'toast';

export interface CelebrationInput {
  kind: CelebrationKind;
  title: string;
  subtitle?: string;
  /** toast only: 'warning' shows an amber "!" instead of the green check */
  tone?: 'success' | 'warning';
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
