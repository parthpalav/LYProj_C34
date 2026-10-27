import React, { useEffect } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import { useTheme } from '../../theme';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

type Props = { width?: ViewStyle['width']; height?: number; radius?: number; style?: StyleProp<ViewStyle> };

/** Pulsing placeholder block shown while data loads. */
export function Skeleton({ width = '100%', height = 16, radius = 8, style }: Props) {
  const reduced = useReducedMotion();
  const { c } = useTheme();
  const opacity = useSharedValue(0.55);

  useEffect(() => {
    if (!reduced) opacity.value = withRepeat(withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [reduced, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return <Animated.View style={[{ width, height, borderRadius: radius, backgroundColor: c.skeleton }, animatedStyle, style]} />;
}

/** A card-shaped group of skeleton lines. */
export function SkeletonCard({ lines = 3, style }: { lines?: number; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  return (
    <View style={[{ backgroundColor: c.surface, borderRadius: 20, padding: 18, gap: 12, borderWidth: 1, borderColor: c.border }, style]}>
      <Skeleton width="45%" height={14} />
      <Skeleton width="70%" height={26} />
      {Array.from({ length: Math.max(0, lines - 2) }).map((_, i) => (
        <Skeleton key={i} width={`${90 - i * 15}%`} height={12} />
      ))}
    </View>
  );
}
