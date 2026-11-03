import { useSyncExternalStore } from 'react';

// Web port of mobile's useCelebrationStore: one celebration on screen at a time, newest wins.
export type CelebrationKind = 'fireworks' | 'piggy' | 'coins' | 'trophy' | 'confetti' | 'toast';

export interface CelebrationInput {
  kind: CelebrationKind;
  title: string;
  subtitle?: string;
  /** toast only. Defaults to success. */
  tone?: 'success' | 'warning' | 'error' | 'info';
  /** piggy only: fill fraction (0-1) before and after the contribution */
  from?: number;
  to?: number;
}

export interface Celebration extends CelebrationInput {
  id: number;
}

let current: Celebration | null = null;
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function celebrate(input: CelebrationInput) {
  current = { ...input, id: nextId++ };
  emit();
}

export const toast = (title: string, opts: Omit<CelebrationInput, 'kind' | 'title'> = {}) =>
  celebrate({ kind: 'toast', title, ...opts });

export function dismissCelebration(id?: number) {
  if (id === undefined || current?.id === id) {
    current = null;
    emit();
  }
}

export const useCelebration = () =>
  useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    () => current,
  );
