import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { PressableScale } from './motion/PressableScale';
import { createStyles, useTheme } from '../theme';
import { timing } from '../motion';

/** Small circular light/dark switch. The sun and moon cross-fade with a quarter turn. */
export function ThemeToggle({ size = 36 }: { size?: number }) {
  const { c, isDark, toggle } = useTheme();
  const styles = useStyles();
  const progress = useSharedValue(isDark ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(isDark ? 1 : 0, timing());
  }, [isDark, progress]);

  const sunStyle = useAnimatedStyle(() => ({
    opacity: 1 - progress.value,
    transform: [{ rotate: `${interpolate(progress.value, [0, 1], [0, 90])}deg` }, { scale: interpolate(progress.value, [0, 1], [1, 0.6]) }],
  }));
  const moonStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ rotate: `${interpolate(progress.value, [0, 1], [-90, 0])}deg` }, { scale: interpolate(progress.value, [0, 1], [0.6, 1]) }],
  }));

  return (
    <PressableScale
      onPress={toggle}
      scaleTo={0.92}
      style={[styles.button, { width: size, height: size, borderRadius: size / 2 }]}
      accessibilityRole="switch"
      accessibilityState={{ checked: isDark }}
      accessibilityLabel="Dark mode"
      hitSlop={6}
    >
      <Animated.View style={[styles.icon, sunStyle]}>
        <Ionicons name="sunny-outline" size={size * 0.5} color={c.text} />
      </Animated.View>
      <Animated.View style={[styles.icon, moonStyle]}>
        <Ionicons name="moon-outline" size={size * 0.46} color={c.text} />
      </Animated.View>
    </PressableScale>
  );
}

const useStyles = createStyles((c) => ({
  button: {
    backgroundColor: c.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
