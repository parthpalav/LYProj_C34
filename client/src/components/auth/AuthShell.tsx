import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, LayoutChangeEvent, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { createStyles, useTheme } from '../../theme';
import { duration, timing } from '../../motion';
import { PressableScale } from '../motion/PressableScale';
import { AuroraBackground } from '../ui/AuroraBackground';

const finauraLogo = require('../../assets/finaura_logo.png');

export type AuthMode = 'login' | 'register';

type Props = {
  title: string;
  subtitle: string;
  /** Shows the Sign in / Create account switch above the form. */
  mode?: AuthMode;
  onModeChange?: (mode: AuthMode) => void;
  children: React.ReactNode;
};

function Segmented({ value, onChange }: { value: AuthMode; onChange: (m: AuthMode) => void }) {
  const styles = useStyles();
  const [width, setWidth] = useState(0);
  const x = useSharedValue(value === 'login' ? 0 : 1);
  useEffect(() => {
    x.value = withTiming(value === 'login' ? 0 : 1, timing(duration.base));
  }, [value, x]);
  const indicator = useAnimatedStyle(() => ({ transform: [{ translateX: x.value * (width / 2) }] }));
  const select = (m: AuthMode) => {
    if (m === value) return;
    Haptics.selectionAsync().catch(() => {});
    onChange(m);
  };
  return (
    <View style={styles.segment} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width - 8)} accessibilityRole="tablist">
      {width > 0 && <Animated.View style={[styles.segmentIndicator, { width: width / 2 }, indicator]} />}
      {(['login', 'register'] as const).map((m) => (
        <Pressable key={m} style={styles.segmentItem} onPress={() => select(m)} accessibilityRole="tab" accessibilityState={{ selected: value === m }}>
          <Text style={[styles.segmentText, value === m && styles.segmentTextActive]}>{m === 'login' ? 'Sign in' : 'Create account'}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/** Primary gradient call-to-action with a spinner while busy. */
export function AuthButton({ label, onPress, loading, disabled }: { label: string; onPress: () => void; loading?: boolean; disabled?: boolean }) {
  const styles = useStyles();
  const { c } = useTheme();
  const inactive = disabled || loading;
  return (
    <PressableScale onPress={onPress} disabled={inactive} style={[styles.buttonWrap, disabled && !loading && styles.buttonDisabled]} accessibilityRole="button" accessibilityLabel={label}>
      <LinearGradient colors={c.accent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.button}>
        {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>{label}</Text>}
      </LinearGradient>
    </PressableScale>
  );
}

export function AuthShell({ title, subtitle, mode, onModeChange, children }: Props) {
  const { isDark } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <AuroraBackground />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.brandRow}>
            <View style={styles.logoWrap}>
              <Image source={finauraLogo} style={styles.logo} resizeMode="cover" />
            </View>
            <Text style={styles.wordmark}>FINAURA</Text>
          </View>

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>

          <BlurView intensity={isDark ? 40 : 70} tint={isDark ? 'dark' : 'light'} style={styles.card}>
            {mode && onModeChange ? <Segmented value={mode} onChange={onModeChange} /> : null}
            {children}
          </BlurView>

          <Text style={styles.footer}>Your Autonomous Financial Digital Twin</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const useStyles = createStyles((c) => ({
  root: {
    flex: 1,
    backgroundColor: c.aurora[0],
  },
  flex: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 28,
    paddingHorizontal: 4,
  },
  logoWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.28)',
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  wordmark: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 3,
    color: 'rgba(255, 255, 255, 0.85)',
  },
  title: {
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -1,
    lineHeight: 40,
    color: '#FFFFFF',
    paddingHorizontal: 4,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: 'rgba(255, 255, 255, 0.72)',
    marginTop: 8,
    marginBottom: 28,
    paddingHorizontal: 4,
  },
  card: {
    borderRadius: 28,
    overflow: 'hidden',
    padding: 20,
    backgroundColor: c.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.glassBorder,
  },
  segment: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 14,
    backgroundColor: c.bg,
    marginBottom: 20,
  },
  segmentIndicator: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 4,
    borderRadius: 10,
    backgroundColor: c.elevated,
    shadowColor: c.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  segmentItem: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '600',
    color: c.textSubtle,
  },
  segmentTextActive: {
    fontSize: 14,
    fontWeight: '600',
    color: c.text,
  },
  buttonWrap: {
    marginTop: 8,
    borderRadius: 14,
    backgroundColor: '#3B3BDE',
    shadowColor: '#3B3BDE',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 6,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  button: {
    height: 54,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
    color: '#FFFFFF',
  },
  footer: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.55)',
    textAlign: 'center',
    marginTop: 24,
  },
}));
