import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, FadeInUp, FadeOut, FadeOutUp, ZoomIn, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Celebration, useCelebrationStore } from '../../store/useCelebrationStore';
import { colors } from '../../theme';
import { AnimatedNumber } from './AnimatedNumber';
import { CoinRain, Confetti, Fireworks, Trophy } from './Effects';
import { PiggyBank } from './PiggyBank';

const BIG_MS = 2200;
const PIGGY_MS = 2600; // coin drop + fill need a little longer to read
const TOAST_MS = 2000;

/** Mounted once at the app root. Plays whatever `celebrate()` last asked for, then dismisses itself. */
export function CelebrationHost() {
  const current = useCelebrationStore((s) => s.current);
  const dismiss = useCelebrationStore((s) => s.dismiss);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (!current) return;
    Haptics.notificationAsync(
      current.tone === 'warning' ? Haptics.NotificationFeedbackType.Warning : Haptics.NotificationFeedbackType.Success,
    ).catch(() => {});
    const asToast = current.kind === 'toast' || reduced;
    const ms = asToast ? TOAST_MS : current.kind === 'piggy' ? PIGGY_MS : BIG_MS;
    const timer = setTimeout(() => dismiss(current.id), ms);
    return () => clearTimeout(timer);
  }, [current, reduced, dismiss]);

  if (!current) return null;
  // Reduce Motion: every celebration becomes a plain toast (text + haptic only).
  if (current.kind === 'toast' || reduced) return <Toast key={current.id} c={current} onDismiss={() => dismiss(current.id)} />;
  return <BigCelebration key={current.id} c={current} onDismiss={() => dismiss(current.id)} />;
}

function Toast({ c, onDismiss }: { c: Celebration; onDismiss: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View entering={FadeInUp.springify().damping(16)} exiting={FadeOutUp} style={[styles.toastWrap, { top: insets.top + 8 }]}>
        <Pressable onPress={onDismiss} style={styles.toast} accessibilityRole="alert" accessibilityLabel={`${c.title}. ${c.subtitle ?? ''}`}>
          <View style={[styles.toastIcon, c.tone === 'warning' && { backgroundColor: colors.amber }]}>
            <Text style={styles.toastCheck}>{c.tone === 'warning' ? '!' : '✓'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.toastTitle} numberOfLines={1}>{c.title}</Text>
            {!!c.subtitle && <Text style={styles.toastSub} numberOfLines={2}>{c.subtitle}</Text>}
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

function BigCelebration({ c, onDismiss }: { c: Celebration; onDismiss: () => void }) {
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
  switch (c.kind) {
    case 'piggy':
      return (
        <View style={{ alignItems: 'center', marginBottom: 6 }}>
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

const styles = StyleSheet.create({
  backdrop: { backgroundColor: 'rgba(15,23,42,0.45)' },
  center: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', padding: 32 },
  card: {
    width: '100%', maxWidth: 340, backgroundColor: colors.white, borderRadius: 28, paddingVertical: 26, paddingHorizontal: 22,
    alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 12,
  },
  emoji: { fontSize: 64, marginBottom: 10 },
  pct: { fontSize: 15, fontWeight: '800', color: colors.green, marginTop: 6 },
  title: { fontSize: 22, fontWeight: '800', color: colors.dark, textAlign: 'center' },
  subtitle: { fontSize: 15, color: colors.gray600, textAlign: 'center', marginTop: 6, lineHeight: 21 },
  hint: { fontSize: 12, color: colors.gray400, marginTop: 16 },
  toastWrap: { position: 'absolute', left: 16, right: 16 },
  toast: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.dark, borderRadius: 18, paddingVertical: 14, paddingHorizontal: 16,
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 10,
  },
  toastIcon: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' },
  toastCheck: { color: colors.white, fontSize: 16, fontWeight: '900' },
  toastTitle: { color: colors.white, fontSize: 15, fontWeight: '700' },
  toastSub: { color: '#CBD5E1', fontSize: 13, marginTop: 2 },
});
