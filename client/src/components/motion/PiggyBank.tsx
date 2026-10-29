import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSequence, withTiming,
} from 'react-native-reanimated';
import { art } from '../../theme';

type Props = {
  /** fill fraction 0-1 */
  progress: number;
  /** starting fill when it first mounts (defaults to `progress`, i.e. no animation) */
  from?: number;
  size?: number;
  /** drop a coin into the slot before the fill rises */
  dropCoin?: boolean;
};

const clamp = (n: number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));

/** Piggy bank drawn from Views; the green fill level is the savings progress. */
export function PiggyBank({ progress, from, size = 160, dropCoin = false }: Props) {
  const reduced = useReducedMotion();
  const target = clamp(progress);
  const fill = useSharedValue(reduced ? target : clamp(from ?? progress));
  const coinY = useSharedValue(dropCoin && !reduced ? -size * 0.7 : 0);
  const coinOpacity = useSharedValue(dropCoin && !reduced ? 1 : 0);
  const wobble = useSharedValue(0);
  const coinDelay = dropCoin && !reduced ? 550 : 0;

  useEffect(() => {
    if (reduced) {
      fill.value = target;
      return;
    }
    if (dropCoin) {
      coinY.value = withTiming(0, { duration: 500, easing: Easing.in(Easing.quad) });
      coinOpacity.value = withDelay(480, withTiming(0, { duration: 80 }));
      wobble.value = withDelay(500, withSequence(
        withTiming(-2, { duration: 90 }), withTiming(1.5, { duration: 120 }), withTiming(0, { duration: 160, easing: Easing.out(Easing.quad) }),
      ));
    }
    fill.value = withDelay(coinDelay, withTiming(target, { duration: 1000, easing: Easing.out(Easing.cubic) }));
  }, [target, dropCoin, reduced, coinDelay, fill, coinY, coinOpacity, wobble]);

  const bodyW = size;
  const bodyH = size * 0.74;

  const fillStyle = useAnimatedStyle(() => ({ height: `${fill.value * 100}%` }));
  const wobbleStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${wobble.value}deg` }] }));
  const coinStyle = useAnimatedStyle(() => ({
    opacity: coinOpacity.value,
    transform: [{ translateY: coinY.value }],
  }));

  const s = size / 160; // scale factor for the small parts

  return (
    <View style={{ width: size * 1.15, height: size * 0.98, alignItems: 'center', justifyContent: 'flex-end' }}>
      <Animated.View style={[{ width: bodyW, height: bodyH + 14 * s }, wobbleStyle]}>
        {/* ear */}
        <View style={[styles.ear, { left: bodyW * 0.2, top: -8 * s, width: 30 * s, height: 30 * s, borderRadius: 6 * s }]} />
        {/* tail */}
        <View style={[styles.tail, { left: -14 * s, top: bodyH * 0.35, width: 20 * s, height: 20 * s, borderRadius: 10 * s, borderWidth: 4 * s }]} />
        {/* legs */}
        <View style={[styles.leg, { left: bodyW * 0.2, top: bodyH - 6 * s, width: 22 * s, height: 20 * s, borderRadius: 6 * s }]} />
        <View style={[styles.leg, { left: bodyW * 0.62, top: bodyH - 6 * s, width: 22 * s, height: 20 * s, borderRadius: 6 * s }]} />

        {/* body with the savings fill */}
        <View style={[styles.body, { width: bodyW, height: bodyH, borderRadius: bodyH / 2, borderWidth: 4 * s }]}>
          <Animated.View style={[styles.fill, fillStyle]}>
            <View style={[styles.fillShine, { height: 6 * s }]} />
          </Animated.View>
          {/* glossy highlight for a rounded, 3D feel */}
          <View style={[styles.gloss, { left: bodyW * 0.18, top: bodyH * 0.12, width: bodyW * 0.32, height: bodyH * 0.16, borderRadius: bodyH * 0.1 }]} />
        </View>

        {/* coin slot */}
        <View style={[styles.slot, { left: bodyW * 0.42, top: 2 * s, width: 34 * s, height: 7 * s, borderRadius: 4 * s }]} />
        {/* eye */}
        <View style={[styles.eye, { left: bodyW * 0.7, top: bodyH * 0.3, width: 9 * s, height: 9 * s, borderRadius: 5 * s }]} />
        {/* snout */}
        <View style={[styles.snout, { left: bodyW - 18 * s, top: bodyH * 0.42, width: 30 * s, height: 26 * s, borderRadius: 10 * s, borderWidth: 3 * s }]}>
          <View style={[styles.nostril, { width: 5 * s, height: 7 * s, borderRadius: 3 * s }]} />
          <View style={[styles.nostril, { width: 5 * s, height: 7 * s, borderRadius: 3 * s }]} />
        </View>

        {/* falling coin */}
        {dropCoin && (
          <Animated.View style={[styles.coin, { left: bodyW * 0.42 + 4 * s, top: -24 * s, width: 26 * s, height: 26 * s, borderRadius: 13 * s }, coinStyle]}>
            <Text style={{ fontSize: 13 * s, fontWeight: '900', color: art.goldDark }}>₹</Text>
          </Animated.View>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    position: 'absolute', left: 0, top: 0,
    backgroundColor: art.purpleLight, borderColor: art.purple, overflow: 'hidden',
  },
  fill: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: art.green },
  fillShine: { backgroundColor: 'rgba(255,255,255,0.35)' },
  gloss: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.7)', transform: [{ rotate: '-12deg' }] },
  ear: { position: 'absolute', backgroundColor: art.purple, transform: [{ rotate: '45deg' }] },
  tail: { position: 'absolute', borderColor: art.purple, borderLeftColor: 'transparent', borderBottomColor: 'transparent' },
  leg: { position: 'absolute', backgroundColor: art.purple },
  slot: { position: 'absolute', backgroundColor: art.ink },
  eye: { position: 'absolute', backgroundColor: art.ink },
  snout: {
    position: 'absolute', backgroundColor: art.lilac, borderColor: art.purple,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-evenly',
  },
  nostril: { backgroundColor: art.purple },
  coin: {
    position: 'absolute', backgroundColor: art.gold, borderWidth: 2, borderColor: art.amber,
    alignItems: 'center', justifyContent: 'center',
  },
});
