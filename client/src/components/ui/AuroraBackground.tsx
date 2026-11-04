import React, { useEffect } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Animated, { Easing, interpolate, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useTheme } from '../../theme';

/** Two soft color fields that drift slowly behind a blur, giving the background a living mesh-gradient feel. */
function Blobs() {
  const reduced = useReducedMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    if (!reduced) t.value = withRepeat(withTiming(1, { duration: 20000, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [reduced, t]);
  const a = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(t.value, [0, 1], [-40, 50]) }, { translateY: interpolate(t.value, [0, 1], [0, 60]) }],
  }));
  const b = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(t.value, [0, 1], [30, -50]) }, { translateY: interpolate(t.value, [0, 1], [20, -40]) }],
  }));
  return (
    <>
      <Animated.View style={[styles.blob, styles.blobA, a]} />
      <Animated.View style={[styles.blob, styles.blobB, b]} />
    </>
  );
}

/** Indigo aurora fill. Place first inside a container; it clips to the container's shape. */
export function AuroraBackground({ blur = 60, style }: { blur?: number; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  return (
    <View style={[StyleSheet.absoluteFill, styles.clip, style]} pointerEvents="none">
      <LinearGradient colors={c.aurora} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <Blobs />
      <BlurView intensity={blur} tint="dark" style={StyleSheet.absoluteFill} />
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
  blob: { position: 'absolute', width: 360, height: 360, borderRadius: 180 },
  blobA: { top: -80, left: -120, backgroundColor: '#7C5CFF', opacity: 0.55 },
  blobB: { top: 220, right: -140, backgroundColor: '#22D3EE', opacity: 0.28 },
});
