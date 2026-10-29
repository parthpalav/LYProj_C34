import React, { useEffect } from 'react';
import { useIsFocused } from '@react-navigation/native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { duration, timing } from '../../motion';

/** Soft rise-and-fade each time a tab comes into focus, so tab switches don't hard-cut. */
export function FocusFade({ children }: { children: React.ReactNode }) {
  const focused = useIsFocused();
  const reduced = useReducedMotion();
  const t = useSharedValue(1);
  useEffect(() => {
    if (!focused || reduced) return;
    t.value = 0;
    t.value = withTiming(1, timing(duration.slow));
  }, [focused, reduced, t]);
  const style = useAnimatedStyle(() => ({
    flex: 1,
    opacity: 0.35 + 0.65 * t.value,
    transform: [{ translateY: (1 - t.value) * 6 }],
  }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

/** Wraps a tab screen component once, at module level, so its identity stays stable. */
export function withFocusFade<P extends object>(Screen: React.ComponentType<P>) {
  return function Faded(props: P) {
    return (
      <FocusFade>
        <Screen {...props} />
      </FocusFade>
    );
  };
}
