import React, { useEffect, useState } from 'react';
import { Keyboard, LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { makeMutable, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createStyles, radius, shadow, useTheme } from '../../theme';
import { duration, spring, timing } from '../../motion';
import { PressableScale } from '../motion/PressableScale';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const TABS: Record<string, { on: IconName; off: IconName; label: string }> = {
  Dashboard: { on: 'home', off: 'home-outline', label: 'Home' },
  Transactions: { on: 'swap-horizontal', off: 'swap-horizontal-outline', label: 'Activity' },
  Plan: { on: 'compass', off: 'compass-outline', label: 'Plan' },
  Chat: { on: 'sparkles', off: 'sparkles-outline', label: 'AI' },
};

const BAR_HEIGHT = 64;
const SLOTS = 5; // four tabs plus the centre add button
const slotOf = (routeIndex: number) => (routeIndex < 2 ? routeIndex : routeIndex + 1);

/** 0 = shown, 1 = tucked below the screen. Driven by scroll direction on tab root screens. */
export const tabBarHidden = makeMutable(0);

/** Bottom padding that keeps the last list item clear of the floating bar. */
export function useTabBarSpace() {
  return BAR_HEIGHT + Math.max(useSafeAreaInsets().bottom, 12) + 24;
}

export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const styles = useStyles();
  const { c, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [width, setWidth] = useState(0);
  const slotWidth = width / SLOTS;
  const bottom = Math.max(insets.bottom - 6, 12);

  const x = useSharedValue(slotOf(state.index));
  useEffect(() => {
    x.value = withSpring(slotOf(state.index), spring);
    tabBarHidden.value = withTiming(0, timing(duration.base));
  }, [state.index, x]);

  // Get out of the way of the keyboard (e.g. the AI chat input).
  useEffect(() => {
    const show = Keyboard.addListener('keyboardWillShow', () => { tabBarHidden.value = withTiming(1, timing(duration.fast)); });
    const hide = Keyboard.addListener('keyboardWillHide', () => { tabBarHidden.value = withTiming(0, timing(duration.base)); });
    return () => { show.remove(); hide.remove(); };
  }, []);

  const pill = useAnimatedStyle(() => ({ transform: [{ translateX: x.value * slotWidth }] }));
  const slide = useAnimatedStyle(() => ({ transform: [{ translateY: tabBarHidden.value * (BAR_HEIGHT + bottom + 16) }] }));

  const tab = (routeIndex: number) => {
    const route = state.routes[routeIndex];
    const meta = TABS[route.name];
    const focused = state.index === routeIndex;
    const onPress = () => {
      const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
      if (!focused && !event.defaultPrevented) {
        Haptics.selectionAsync().catch(() => {});
        navigation.navigate(route.name);
      }
    };
    return (
      <Pressable
        key={route.key}
        onPress={onPress}
        onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
        style={styles.item}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={descriptors[route.key].options.tabBarAccessibilityLabel ?? meta.label}
      >
        <Ionicons name={focused ? meta.on : meta.off} size={22} color={focused ? c.primary : c.textSubtle} />
        <Text style={[styles.label, { color: focused ? c.primary : c.textSubtle }]} numberOfLines={1}>{meta.label}</Text>
      </Pressable>
    );
  };

  return (
    <Animated.View style={[styles.wrap, { bottom }, slide]}>
      <BlurView intensity={isDark ? 50 : 80} tint={isDark ? 'dark' : 'light'} style={[StyleSheet.absoluteFill, styles.glass]} />
      <View style={styles.row} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 && <Animated.View style={[styles.pill, { width: slotWidth - 12 }, pill]} />}
        {tab(0)}
        {tab(1)}
        <View style={styles.item}>
          <PressableScale
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
              navigation.navigate('QuickAdd' as never);
            }}
            haptic={false}
            scaleTo={0.9}
            style={styles.addShadow}
            accessibilityRole="button"
            accessibilityLabel="Add a transaction"
          >
            <LinearGradient colors={c.accent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.add}>
              <Ionicons name="add" size={28} color={c.onPrimary} />
            </LinearGradient>
          </PressableScale>
        </View>
        {tab(2)}
        {tab(3)}
      </View>
    </Animated.View>
  );
}

const useStyles = createStyles((c) => ({
  wrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    height: BAR_HEIGHT,
    borderRadius: radius.xl,
    ...shadow(c, 3),
  },
  glass: {
    borderRadius: radius.xl,
    overflow: 'hidden',
    backgroundColor: c.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.glassBorder,
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pill: {
    position: 'absolute',
    left: 6,
    top: 8,
    bottom: 8,
    borderRadius: radius.lg,
    backgroundColor: c.primarySoft,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  addShadow: {
    borderRadius: 24,
    shadowColor: c.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  add: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
