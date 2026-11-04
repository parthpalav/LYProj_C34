import { create } from 'zustand';
import { secureStorage } from '../utils/secureStorage';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeState {
  mode: ThemeMode;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setMode: (mode: ThemeMode) => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  mode: 'system',
  hydrated: false,
  hydrate: async () => {
    const saved = await secureStorage.getThemeMode();
    set({ mode: saved === 'light' || saved === 'dark' ? saved : 'system', hydrated: true });
  },
  setMode: (mode) => {
    set({ mode });
    secureStorage.setThemeMode(mode).catch(() => {});
  },
}));
