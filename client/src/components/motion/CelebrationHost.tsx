import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, FadeInUp, FadeOut, FadeOutUp, ZoomIn, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Celebration, useCelebrationStore } from '../../store/useCelebrationStore';
import { createStyles, radius, shadow, useTheme } from '../../theme';
import { AnimatedNumber } from './AnimatedNumber';
import { CoinRain, Confetti, Fireworks, Trophy } from './Effects';
import { PiggyBank } from './PiggyBank';

const BIG_MS = 2200;
const PIGGY_MS = 2600; // coin drop + fill need a little longer to read
const TOAST_MS = 2000;
const ACTION_TOAST_MS = 4500; // long enough to reach an Undo button

const HAPTIC = {
  success: Haptics.NotificationFeedbackType.Success,
  warning: Haptics.NotificationFeedbackType.Warning,
  error: Haptics.NotificationFeedbackType.Error,
} as const;

/** Mounted once at the app root. Plays whatever `celebrate()` last asked for, then dismisses itself. */
export function CelebrationHost() {
  const current = useCelebrationStore((s) => s.current);
  const dismiss = useCelebrationStore((s) => s.dismiss);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (!current) return;
    const tone = current.tone ?? 'success';
    if (tone === 'info') Haptics.selectionAsync().catch(() => {});
    else Haptics.notificationAsync(HAPTIC[tone]).catch(() => {});
    const asToast = current.kind === 'toast' || reduced;
    const ms = current.action ? ACTION_TOAST_MS : asToast ? TOAST_MS : current.kind === 'piggy' ? PIGGY_MS : BIG_MS;
    const timer = setTimeout(() => dismiss(current.id), ms);
    return () => clearTimeout(timer);
  }, [current, reduced, dismiss]);

  if (!current) return null;
  // Reduce Motion: every celebration becomes a plain toast (text + haptic only).
  if (current.kind === 'toast' || reduced) return <Toast key={current.id} c={current} onDismiss={() => dismiss(current.id)} />;
  return <BigCelebration key={current.id} c={current} onDismiss={() => dismiss(current.id)} />;
}

const TOAST_ICON = { success: 'checkmark', warning: 'alert', error: 'close', info: 'information' } as const;

function Toast({ c, onDismiss }: { c: Celebration; onDismiss: () => void }) {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { c: t } = useTheme();
  const tone = c.tone ?? 'success';
  const tint = { success: t.success, warning: t.warning, error: t.danger, info: t.primary }[tone];
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View entering={FadeInUp.springify().damping(16)} exiting={FadeOutUp} style={[styles.toastWrap, { top: insets.top + 8 }]}>
        <Pressable onPress={onDismiss} style={styles.toast} accessibilityRole="alert" accessibilityLabel={`${c.title}. ${c.subtitle ?? ''}`}>
          <View style={[styles.toastIcon, { backgroundColor: tint }]}>
            <Ionicons name={TOAST_ICON[tone]} size={17} color="#FFFFFF" />
          </View>
          <View style={styles.flex}>
            <Text style={styles.toastTitle} numberOfLines={1}>{c.title}</Text>
            {!!c.subtitle && <Text style={styles.toastSub} numberOfLines={2}>{c.subtitle}</Text>}
          </View>
          {c.action && (
            <Pressable
              onPress={() => { c.action?.onPress(); onDismiss(); }}
              hitSlop={10}
              style={styles.toastAction}
              accessibilityRole="button"
              accessibilityLabel={c.action.label}
            >
              <Text style={styles.toastActionText}>{c.action.label}</Text>
            </Pressable>
          )}
        </Pressable>
      </Animated.View>
    </View>
  );
}

function BigCelebration({ c, onDismiss }: { c: Celebration; onDismiss: () => void }) {
  const styles = useStyles();
  return (
    <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(220)} style={StyleSheet.absoluteFill}>
      <Pressable style={[StyleSheet.absoluteFill, styles.backdrop]} onPress={onDismiss} accessibilityRole="button" accessibilityLabel={`${c.title}. Tap to continue`}>
        {c.kind === 'fireworks' && <Fireworks />}
        {(c.kind === 'confetti' || c.kind === 'trophy') && <Confetti />}
        {c.kind === 'trophy' && <Fireworks />}
        {c.kind === 'coins' && <CoinRain />}

        <View style={styles.center} pointerEvents="none">
          <Animated.View entering={ZoomIn.springify().damping(12)} style={styles.card}>
            <Visual c={c} />
            <Text style={styles.title}>{c.title}</Text>
            {!!c.subtitle && <Text style={styles.subtitle}>{c.subtitle}</Text>}
            <Text style={styles.hint}>Tap anywhere to continue</Text>
          </Animated.View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

function Visual({ c }: { c: Celebration }) {
  const styles = useStyles();
  switch (c.kind) {
    case 'piggy':
      return (
        <View style={styles.piggy}>
          <PiggyBank progress={c.to ?? 0} from={c.from ?? 0} size={150} dropCoin />
          <AnimatedNumber
            value={Math.round((c.to ?? 0) * 100)}
            from={Math.round((c.from ?? 0) * 100)}
            duration={1500}
            format={(n) => `${n}% saved`}
            style={styles.pct}
          />
        </View>
      );
    case 'trophy':
      return <Trophy />;
    case 'coins':
      return <Text style={styles.emoji}>💰</Text>;
    case 'fireworks':
      return <Text style={styles.emoji}>📈</Text>;
    default:
      return <Text style={styles.emoji}>🎉</Text>;
  }
}

const useStyles = createStyles((c) => ({
  flex: { flex: 1 },
  backdrop: { backgroundColor: c.overlay },
  center: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', padding: 32 },
  card: {
    width: '100%', maxWidth: 340, backgroundColor: c.elevated, borderRadius: radius.xl, paddingVertical: 26, paddingHorizontal: 22,
    alignItems: 'center', ...shadow(c, 3),
  },
  piggy: { alignItems: 'center', marginBottom: 6 },
  emoji: { fontSize: 64, marginBottom: 10 },
  pct: { fontSize: 15, fontWeight: '800', color: c.success, marginTop: 6 },
  title: { fontSize: 22, fontWeight: '800', color: c.text, textAlign: 'center' },
  subtitle: { fontSize: 15, color: c.textMuted, textAlign: 'center', marginTop: 6, lineHeight: 21 },
  hint: { fontSize: 12, color: c.textSubtle, marginTop: 16 },
  toastWrap: { position: 'absolute', left: 16, right: 16 },
  // Inverted surface: ink in light mode, near-white in dark mode, so it pops on either background.
  toast: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.text, borderRadius: radius.lg, paddingVertical: 14, paddingHorizontal: 16,
    ...shadow(c, 3),
  },
  toastIcon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  toastTitle: { color: c.bg, fontSize: 15, fontWeight: '700' },
  toastSub: { color: c.textSubtle, fontSize: 13, marginTop: 2 },
  toastAction: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: c.primary },
  toastActionText: { color: c.onPrimary, fontSize: 13, fontWeight: '700' },
}));
