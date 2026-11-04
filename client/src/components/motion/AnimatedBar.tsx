import React, { useEffect } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import { useTheme } from '../../theme';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming, Easing } from 'react-native-reanimated';

type Props = {
  /** 0-1; values outside are clamped */
  progress: number;
  color: string;
  trackColor?: string;
  height?: number;
  delay?: number;
  style?: StyleProp<ViewStyle>;
};

/** Progress bar that grows from its previous value (0 on mount) to the new one. */
export function AnimatedBar({ progress, color, trackColor, height = 8, delay = 0, style }: Props) {
  const { c } = useTheme();
  const reduced = useReducedMotion();
  const target = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  const width = useSharedValue(reduced ? target : 0);

  useEffect(() => {
    width.value = reduced
      ? target
      : withDelay(delay, withTiming(target, { duration: 900, easing: Easing.out(Easing.cubic) }));
  }, [target, delay, reduced, width]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${width.value * 100}%` }));

  return (
    <View style={[{ height, borderRadius: height / 2, backgroundColor: trackColor ?? c.surfaceAlt, overflow: 'hidden' }, style]}>
      <Animated.View style={[{ height: '100%', borderRadius: height / 2, backgroundColor: color }, fillStyle]} />
    </View>
  );
}

/** One segment of a stacked bar; grows from 0 to `pct`% on mount and on change. */
export function AnimatedSegment({ pct, color, delay = 0, style }: { pct: number; color: string; delay?: number; style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion();
  const width = useSharedValue(reduced ? pct : 0);
  useEffect(() => {
    width.value = reduced ? pct : withDelay(delay, withTiming(pct, { duration: 900, easing: Easing.out(Easing.cubic) }));
  }, [pct, delay, reduced, width]);
  const animatedStyle = useAnimatedStyle(() => ({ width: `${width.value}%` }));
  return <Animated.View style={[{ height: '100%', backgroundColor: color }, style, animatedStyle]} />;
}
