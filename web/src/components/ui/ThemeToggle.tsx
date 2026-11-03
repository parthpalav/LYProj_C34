import React from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme, type ThemeMode } from '../../utils/theme';

/** Sun/moon button that flips light and dark. Profile still offers "System". */
export const ThemeToggle: React.FC = () => {
  const { isDark, toggle } = useTheme();
  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggle}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Light mode' : 'Dark mode'}
    >
      {/* keyed so the new icon pops in instead of swapping hard */}
      {isDark ? <Sun key="sun" size={17} /> : <Moon key="moon" size={17} />}
    </button>
  );
};

const OPTIONS: { mode: ThemeMode; label: string; icon: React.ReactNode }[] = [
  { mode: 'light', label: 'Light', icon: <Sun size={14} /> },
  { mode: 'dark', label: 'Dark', icon: <Moon size={14} /> },
  { mode: 'system', label: 'System', icon: <Monitor size={14} /> },
];

export const ThemeSegment: React.FC = () => {
  const { mode, setMode } = useTheme();
  return (
    <div className="theme-segment" role="group" aria-label="Appearance">
      {OPTIONS.map((o) => (
        <button key={o.mode} type="button" aria-pressed={mode === o.mode} onClick={() => setMode(o.mode)}>
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
};
