import React, { useEffect } from 'react';
import { StyleProp, TextStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

/** Empty-state emoji that gently bobs and tilts so the screen doesn't feel dead. */
export function FloatingEmoji({ emoji, style }: { emoji: string; style?: StyleProp<TextStyle> }) {
  const reduced = useReducedMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    if (!reduced) t.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [reduced, t]);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -8 * t.value }, { rotate: `${-4 + 8 * t.value}deg` }],
  }));
  return <Animated.Text style={[style, animatedStyle]}>{emoji}</Animated.Text>;
}
