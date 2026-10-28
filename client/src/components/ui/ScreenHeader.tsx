import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import Animated, { Extrapolation, interpolate, SharedValue, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createStyles, typeScale, useTheme } from '../../theme';
import { duration, timing } from '../../motion';
import { tabBarHidden } from '../navigation/TabBar';

const BAR = 52;

/** Content top padding so the first item starts below the floating header. */
export function useHeaderHeight() {
  return useSafeAreaInsets().top + BAR;
}

/**
 * Scroll offset for ScreenHeader. Pass `onScroll` to an Animated.ScrollView/FlatList with scrollEventThrottle={16}.
 * Tab root screens pass hidesTabBar so the floating tab bar tucks away while scrolling down.
 */
export function useScrollHeader({ hidesTabBar = false } = {}) {
  const y = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler<{ last?: number; hidden?: number }>({
    onScroll: (e, ctx) => {
      const next = e.contentOffset.y;
      if (hidesTabBar) {
        const dy = next - (ctx.last ?? next);
        const want = next < 40 || dy < -4 ? 0 : dy > 4 ? 1 : ctx.hidden ?? 0;
        if (want !== ctx.hidden) {
          ctx.hidden = want;
          tabBarHidden.value = withTiming(want, timing(duration.base));
        }
      }
      ctx.last = next;
      y.value = next;
    },
  });
  return { y, onScroll };
}

type Props = {
  title: string;
  /** scroll offset from useScrollHeader; without it the bar is always solid */
  y?: SharedValue<number>;
  onBack?: () => void;
  right?: React.ReactNode;
};

/**
 * Floating top bar: transparent over the large title, then blurs in with a compact title once the
 * content scrolls under it. Also keeps scrolled content from colliding with the status bar.
 */
export function ScreenHeader({ title, y, onBack, right }: Props) {
  const styles = useStyles();
  const { c, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const bg = useAnimatedStyle(() => ({
    opacity: y ? interpolate(y.value, [0, 40], [0, 1], Extrapolation.CLAMP) : 1,
  }));
  const compact = useAnimatedStyle(() => ({
    opacity: y ? interpolate(y.value, [28, 60], [0, 1], Extrapolation.CLAMP) : 1,
    transform: [{ translateY: y ? interpolate(y.value, [28, 60], [6, 0], Extrapolation.CLAMP) : 0 }],
  }));

  return (
    <View style={[styles.wrap, { height: insets.top + BAR }]} pointerEvents="box-none">
      <Animated.View style={[StyleSheet.absoluteFill, bg]} pointerEvents="none">
        <BlurView intensity={70} tint={isDark ? 'dark' : 'light'} style={[StyleSheet.absoluteFill, styles.blur]} />
      </Animated.View>
      <View style={[styles.bar, { marginTop: insets.top }]} pointerEvents="box-none">
        <View style={styles.side}>
          {onBack && (
            <Pressable onPress={onBack} hitSlop={10} style={styles.back} accessibilityRole="button" accessibilityLabel="Back">
              <Ionicons name="chevron-back" size={22} color={c.text} />
            </Pressable>
          )}
        </View>
        <Animated.Text style={[styles.title, compact]} numberOfLines={1} accessibilityRole="header">
          {title}
        </Animated.Text>
        <View style={[styles.side, styles.right]}>{right}</View>
      </View>
    </View>
  );
}

/** Big left-aligned page title; render it as the first child of the scroll content. */
export function LargeTitle({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
  const styles = useStyles();
  return (
    <View style={styles.large}>
      <View style={styles.flex}>
        <Text style={styles.largeTitle} accessibilityRole="header">{title}</Text>
        {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>
      {right}
    </View>
  );
}

const useStyles = createStyles((c) => ({
  wrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  blur: {
    backgroundColor: c.glass,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  bar: {
    height: BAR,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  side: {
    width: 72,
    flexDirection: 'row',
    alignItems: 'center',
  },
  right: {
    justifyContent: 'flex-end',
    gap: 8,
  },
  back: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surfaceAlt,
  },
  title: {
    ...typeScale.headline,
    flex: 1,
    textAlign: 'center',
    color: c.text,
  },
  large: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 16,
    gap: 12,
  },
  flex: {
    flex: 1,
  },
  largeTitle: {
    ...typeScale.display,
    color: c.text,
  },
  subtitle: {
    ...typeScale.body,
    color: c.textMuted,
    marginTop: 4,
  },
}));
