import { useMemo } from 'react';
import { ImageStyle, StyleSheet, TextStyle, useColorScheme, ViewStyle } from 'react-native';
import { DarkTheme, DefaultTheme, Theme as NavTheme } from '@react-navigation/native';
import { useThemeStore } from './store/useThemeStore';

type Gradient = readonly [string, string, string];

// Semantic color tokens. Screens read these through useTheme()/createStyles so light and dark stay in sync.
export const lightColors = {
  bg: '#F6F7FB',
  surface: '#FFFFFF',
  surfaceAlt: '#F1F3F8',
  elevated: '#FFFFFF',
  text: '#0F172A',
  textMuted: '#475569',
  textSubtle: '#94A3B8',
  border: '#E5E8EF',
  borderStrong: '#CBD2DE',
  primary: '#3B3BDE',
  primarySoft: '#EEF0FF',
  onPrimary: '#FFFFFF',
  success: '#10B981',
  successStrong: '#059669',
  successSoft: '#ECFDF5',
  warning: '#F59E0B',
  warningStrong: '#D97706',
  warningSoft: '#FFFBEB',
  danger: '#EF4444',
  dangerStrong: '#DC2626',
  dangerSoft: '#FEF2F2',
  info: '#2563EB',
  infoSoft: '#EFF6FF',
  purple: '#7C3AED',
  purpleSoft: '#F3E8FF',
  gold: '#FBBF24',
  goldDark: '#B45309',
  overlay: 'rgba(15, 23, 42, 0.45)',
  shadow: '#0F172A',
  skeleton: '#E7EAF0',
  glass: 'rgba(255, 255, 255, 0.82)',
  glassBorder: 'rgba(255, 255, 255, 0.9)',
  /** Deep indigo mesh behind hero surfaces (auth, Home hero, recap). Text on it uses onAurora. */
  aurora: ['#12105A', '#2A2AB8', '#5B3BDE'] as Gradient,
  onAurora: '#FFFFFF',
  onAuroraMuted: 'rgba(255, 255, 255, 0.72)',
  /** Primary call-to-action gradient. */
  accent: ['#4F46E5', '#3B3BDE', '#6D28D9'] as Gradient,
  /** Categorical series colors for charts, in display order. */
  chart: ['#3B3BDE', '#10B981', '#F59E0B', '#EC4899', '#06B6D4', '#8B5CF6', '#EF4444', '#84CC16'] as readonly string[],
};

export type Palette = typeof lightColors;

export const darkColors: Palette = {
  bg: '#0B0D12',
  surface: '#14171F',
  surfaceAlt: '#1B1F29',
  elevated: '#1E2230',
  text: '#F1F5F9',
  textMuted: '#A3ADBF',
  textSubtle: '#6B7588',
  border: '#252A36',
  borderStrong: '#363C4B',
  primary: '#6E6EF5',
  primarySoft: 'rgba(110, 110, 245, 0.16)',
  onPrimary: '#FFFFFF',
  success: '#34D399',
  successStrong: '#34D399',
  successSoft: 'rgba(52, 211, 153, 0.14)',
  warning: '#FBBF24',
  warningStrong: '#FBBF24',
  warningSoft: 'rgba(251, 191, 36, 0.14)',
  danger: '#F87171',
  dangerStrong: '#F87171',
  dangerSoft: 'rgba(248, 113, 113, 0.14)',
  info: '#60A5FA',
  infoSoft: 'rgba(96, 165, 250, 0.14)',
  purple: '#A78BFA',
  purpleSoft: 'rgba(167, 139, 250, 0.16)',
  gold: '#FBBF24',
  goldDark: '#F59E0B',
  overlay: 'rgba(0, 0, 0, 0.6)',
  shadow: '#000000',
  skeleton: '#1F2430',
  glass: 'rgba(20, 23, 31, 0.72)',
  glassBorder: 'rgba(255, 255, 255, 0.10)',
  aurora: ['#05050C', '#0D0E2E', '#1A1450'],
  onAurora: '#FFFFFF',
  onAuroraMuted: 'rgba(255, 255, 255, 0.68)',
  accent: ['#5B5BF0', '#4F46E5', '#7C3AED'],
  chart: ['#818CF8', '#34D399', '#FBBF24', '#F472B6', '#22D3EE', '#A78BFA', '#F87171', '#A3E635'],
};

// Fixed illustration colors (piggy bank, coins, confetti): the artwork reads the same in both schemes.
export const art = {
  purple: '#7C3AED',
  purpleLight: '#F3E8FF',
  lilac: '#E9D5FF',
  green: '#10B981',
  amber: '#F59E0B',
  gold: '#FBBF24',
  goldDark: '#B45309',
  ink: '#0F172A',
};

export const celebrationPalette = ['#2563EB', '#10B981', '#F59E0B', '#7C3AED', '#EF4444', '#3B3BDE'];

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 } as const;

export const radius = { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 } as const;

/** Type scale. Spread into createStyles entries; fontWeight is mapped to the Inter family there. */
export const typeScale = {
  display: { fontSize: 34, fontWeight: '800', letterSpacing: -1, lineHeight: 40 },
  title: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5, lineHeight: 30 },
  headline: { fontSize: 17, fontWeight: '700', letterSpacing: -0.2, lineHeight: 22 },
  body: { fontSize: 15, fontWeight: '400', lineHeight: 21 },
  label: { fontSize: 13, fontWeight: '600', lineHeight: 18 },
  caption: { fontSize: 12, fontWeight: '500', lineHeight: 16 },
  overline: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2, lineHeight: 14, textTransform: 'uppercase' },
} as const satisfies Record<string, TextStyle>;

/** Digits keep a fixed width so animated amounts don't jitter. */
export const tabular: TextStyle = { fontVariant: ['tabular-nums'] };

/** Soft, tinted elevation. Level 1 = resting card, 2 = raised, 3 = floating (tab bar, toasts). */
export function shadow(c: Palette, level: 1 | 2 | 3 = 1): ViewStyle {
  const [opacity, radius, y, elevation] = level === 1 ? [0.06, 12, 4, 2] : level === 2 ? [0.1, 18, 8, 5] : [0.18, 28, 14, 10];
  return { shadowColor: c.shadow, shadowOpacity: opacity, shadowRadius: radius, shadowOffset: { width: 0, height: y }, elevation };
}

export function useTheme() {
  const system = useColorScheme();
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);
  const isDark = mode === 'dark' || (mode === 'system' && system === 'dark');
  return useMemo(
    () => ({ c: isDark ? darkColors : lightColors, isDark, mode, toggle: () => setMode(isDark ? 'light' : 'dark') }),
    [isDark, mode, setMode],
  );
}

// Inter is loaded as one static family per weight, so fontWeight must become a fontFamily.
const INTER: Record<string, string> = {
  '300': 'Inter_300Light',
  '400': 'Inter_400Regular',
  normal: 'Inter_400Regular',
  '500': 'Inter_500Medium',
  '600': 'Inter_600SemiBold',
  '700': 'Inter_700Bold',
  bold: 'Inter_700Bold',
  '800': 'Inter_800ExtraBold',
  '900': 'Inter_900Black',
};

export function font(weight: TextStyle['fontWeight'] = '400'): TextStyle {
  return { fontFamily: INTER[String(weight)] ?? INTER['400'] };
}

function withInter<T extends Record<string, any>>(styles: T): T {
  const out: Record<string, any> = {};
  for (const [key, style] of Object.entries(styles)) {
    if (style && (style.fontSize !== undefined || style.fontWeight !== undefined) && !style.fontFamily) {
      const { fontWeight, ...rest } = style;
      out[key] = { ...rest, ...font(fontWeight) };
    } else {
      out[key] = style;
    }
  }
  return out as T;
}

/** Themed StyleSheet: `const useStyles = createStyles((c) => ({...}))`, then `const styles = useStyles()` in the component. */
type Styles = Record<string, ViewStyle | TextStyle | ImageStyle>;

export function createStyles<T extends Styles>(factory: (c: Palette) => T & Styles) {
  const cache = new Map<Palette, Readonly<T>>();
  return function useStyles(): Readonly<T> {
    const { c } = useTheme();
    let styles = cache.get(c);
    if (!styles) {
      styles = StyleSheet.create(withInter(factory(c)));
      cache.set(c, styles);
    }
    return styles;
  };
}

export function navigationTheme(c: Palette, isDark: boolean): NavTheme {
  const base = isDark ? DarkTheme : DefaultTheme;
  return {
    ...base,
    colors: { ...base.colors, primary: c.primary, background: c.bg, card: c.surface, text: c.text, border: c.border, notification: c.danger },
  };
}
