import React, { useEffect, useMemo } from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing, SharedValue, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming,
} from 'react-native-reanimated';
import { celebrationPalette, colors } from '../../theme';

const { width: W, height: H } = Dimensions.get('window');
const rand = (min: number, max: number) => min + Math.random() * (max - min);

// ── Fireworks: bursts of particles that fly out, fall a little and fade ──────

function Burst({ x, y, delay, color }: { x: number; y: number; delay: number; color: string }) {
  const p = useSharedValue(0);
  const particles = useMemo(
    () => Array.from({ length: 16 }, (_, i) => ({ angle: (i / 16) * Math.PI * 2, dist: rand(60, 110), size: rand(5, 9) })),
    [],
  );
  useEffect(() => {
    p.value = withDelay(delay, withTiming(1, { duration: 1100, easing: Easing.out(Easing.quad) }));
  }, [delay, p]);

  return (
    <View style={{ position: 'absolute', left: x, top: y }}>
      {particles.map((pt, i) => (
        <Spark key={i} p={p} {...pt} color={i % 3 === 0 ? colors.gold : color} />
      ))}
    </View>
  );
}

function Spark({ p, angle, dist, size, color }: { p: SharedValue<number>; angle: number; dist: number; size: number; color: string }) {
  const style = useAnimatedStyle(() => {
    const t = p.value;
    return {
      opacity: t === 0 ? 0 : 1 - t * t,
      transform: [
        { translateX: Math.cos(angle) * dist * t },
        { translateY: Math.sin(angle) * dist * t + 40 * t * t }, // gravity
        { scale: 1.3 - t * 0.8 },
      ],
    };
  });
  return <Animated.View style={[{ position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: color }, style]} />;
}

export function Fireworks() {
  const bursts = useMemo(
    () => [
      { x: W * 0.25, y: H * 0.22, delay: 0 },
      { x: W * 0.75, y: H * 0.18, delay: 260 },
      { x: W * 0.5, y: H * 0.3, delay: 520 },
      { x: W * 0.2, y: H * 0.68, delay: 700 },
      { x: W * 0.8, y: H * 0.64, delay: 880 },
    ].map((b, i) => ({ ...b, color: celebrationPalette[i % celebrationPalette.length] })),
    [],
  );
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {bursts.map((b, i) => <Burst key={i} {...b} />)}
    </View>
  );
}

// ── Confetti: paper pieces tumbling down from the top ─────────────────────────

function ConfettiPiece({ color }: { color: string }) {
  const cfg = useMemo(() => ({ x: rand(0, W), drift: rand(-60, 60), delay: rand(0, 500), spin: rand(360, 900), w: rand(6, 10), h: rand(10, 16) }), []);
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(cfg.delay, withTiming(1, { duration: rand(1600, 2100), easing: Easing.in(Easing.quad) }));
  }, [cfg.delay, t]);
  const style = useAnimatedStyle(() => ({
    opacity: t.value > 0.9 ? (1 - t.value) * 10 : 1,
    transform: [
      { translateX: cfg.x + cfg.drift * t.value },
      { translateY: -30 + (H + 60) * t.value },
      { rotate: `${cfg.spin * t.value}deg` },
      { rotateX: `${cfg.spin * 1.5 * t.value}deg` }, // flips the paper for depth
    ],
  }));
  return <Animated.View style={[{ position: 'absolute', width: cfg.w, height: cfg.h, borderRadius: 2, backgroundColor: color }, style]} />;
}

export function Confetti({ count = 40 }: { count?: number }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {Array.from({ length: count }, (_, i) => <ConfettiPiece key={i} color={celebrationPalette[i % celebrationPalette.length]} />)}
    </View>
  );
}

// ── Coin rain: gold coins that spin on their Y axis as they fall ──────────────

function Coin() {
  const cfg = useMemo(() => ({ x: rand(10, W - 40), delay: rand(0, 700), size: rand(24, 34), duration: rand(1300, 1800) }), []);
  const t = useSharedValue(0);
  const spin = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(cfg.delay, withTiming(1, { duration: cfg.duration, easing: Easing.in(Easing.quad) }));
    spin.value = withRepeat(withTiming(1, { duration: 600, easing: Easing.linear }), -1);
  }, [cfg, t, spin]);
  const style = useAnimatedStyle(() => ({
    opacity: t.value === 0 ? 0 : 1,
    transform: [
      { translateX: cfg.x },
      { translateY: -40 + (H + 80) * t.value },
      { perspective: 400 },
      { rotateY: `${spin.value * 360}deg` },
    ],
  }));
  return (
    <Animated.View style={[styles.coin, { width: cfg.size, height: cfg.size, borderRadius: cfg.size / 2 }, style]}>
      <Text style={{ fontSize: cfg.size * 0.5, fontWeight: '900', color: colors.goldDark }}>₹</Text>
    </Animated.View>
  );
}

export function CoinRain({ count = 22 }: { count?: number }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {Array.from({ length: count }, (_, i) => <Coin key={i} />)}
    </View>
  );
}

// ── Trophy: pops in with rotating rays behind it ──────────────────────────────

export function Trophy() {
  const scale = useSharedValue(0);
  const rot = useSharedValue(0);
  useEffect(() => {
    scale.value = withSequence(withSpring(1.15, { damping: 8 }), withSpring(1));
    rot.value = withRepeat(withTiming(1, { duration: 6000, easing: Easing.linear }), -1);
  }, [scale, rot]);
  const trophyStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const raysStyle = useAnimatedStyle(() => ({ opacity: scale.value * 0.9, transform: [{ rotate: `${rot.value * 360}deg` }] }));
  return (
    <View style={styles.trophyWrap}>
      <Animated.View style={[styles.rays, raysStyle]}>
        {Array.from({ length: 12 }, (_, i) => (
          <View key={i} style={[styles.ray, { transform: [{ rotate: `${i * 30}deg` }] }]} />
        ))}
      </Animated.View>
      <Animated.Text style={[styles.trophy, trophyStyle]}>🏆</Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  coin: {
    position: 'absolute', backgroundColor: colors.gold, borderWidth: 2, borderColor: colors.amber,
    alignItems: 'center', justifyContent: 'center',
  },
  trophyWrap: { width: 160, height: 160, alignItems: 'center', justifyContent: 'center' },
  rays: { position: 'absolute', width: 160, height: 160, alignItems: 'center', justifyContent: 'center' },
  ray: { position: 'absolute', width: 10, height: 160, borderRadius: 5, backgroundColor: 'rgba(251,191,36,0.35)' },
  trophy: { fontSize: 84 },
});
