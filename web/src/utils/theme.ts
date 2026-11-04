import { useSyncExternalStore } from 'react';

// Light / dark / system, like mobile's useThemeStore. index.html applies the saved choice before first paint.
export type ThemeMode = 'light' | 'dark' | 'system';

const KEY = 'finaura_web_theme';
const media = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null;
const listeners = new Set<() => void>();

function readMode(): ThemeMode {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

let mode: ThemeMode = readMode();

const resolved = () => (mode === 'system' ? (media?.matches ? 'dark' : 'light') : mode);

function apply(animate: boolean) {
  const root = document.documentElement;
  if (animate) {
    root.classList.add('theme-anim');
    window.setTimeout(() => root.classList.remove('theme-anim'), 320);
  }
  root.dataset.theme = resolved();
  listeners.forEach((l) => l());
}

media?.addEventListener('change', () => mode === 'system' && apply(true));

export function setThemeMode(next: ThemeMode) {
  mode = next;
  try {
    if (next === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, next);
  } catch { /* private mode: still switch for this tab */ }
  apply(true);
}

export function useTheme() {
  const isDark = useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    () => resolved() === 'dark',
  );
  const current = useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    () => mode,
  );
  return { mode: current, isDark, setMode: setThemeMode, toggle: () => setThemeMode(isDark ? 'light' : 'dark') };
}
