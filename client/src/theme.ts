import { useMemo } from 'react';
import { ImageStyle, StyleSheet, TextStyle, useColorScheme, ViewStyle } from 'react-native';
import { DarkTheme, DefaultTheme, Theme as NavTheme } from '@react-navigation/native';
import { useThemeStore } from './store/useThemeStore';

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
};

// Legacy light palette kept for the celebration effects (Effects.tsx), which stay identical in both schemes.
export const colors = {
  blue: '#2563EB',
  blueLight: '#EFF6FF',
  brand: '#3B3BDE',
  green: '#10B981',
  greenLight: '#ECFDF5',
  amber: '#F59E0B',
  amberLight: '#FFFBEB',
  red: '#EF4444',
  redLight: '#FEF2F2',
  purple: '#7C3AED',
  purpleLight: '#F3E8FF',
  dark: '#0F172A',
  gray600: '#475569',
  gray400: '#94A3B8',
  border: '#E2E8F0',
  bg: '#F8FAFC',
  white: '#FFFFFF',
  gold: '#FBBF24',
  goldDark: '#B45309',
};

export const celebrationPalette = [colors.blue, colors.green, colors.amber, colors.purple, colors.red, colors.brand];

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
