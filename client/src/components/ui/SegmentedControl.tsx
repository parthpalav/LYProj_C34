import React, { useEffect, useRef, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleProp, Text, View, ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { createStyles, radius, shadow, typeScale, useTheme } from '../../theme';
import { duration, timing } from '../../motion';

export type Segment<K extends string> = { key: K; label: string; /** small colour dot before the label */ dot?: string };

type Props<K extends string> = {
  segments: readonly Segment<K>[];
  value: K;
  /** also fires when the selected segment is tapped again, so a screen can reopen its picker */
  onChange: (key: K) => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

/** iOS-style segmented control: equal segments on a recessed track, with a raised pill that slides to the choice. */
export function SegmentedControl<K extends string>({ segments, value, onChange, style, accessibilityLabel }: Props<K>) {
  const styles = useStyles();
  const { c, isDark } = useTheme();
  const [width, setWidth] = useState(0);
  const seg = width > 0 ? (width - PAD * 2) / segments.length : 0;
  const index = Math.max(0, segments.findIndex((s) => s.key === value));
  const x = useSharedValue(0);
  const placed = useRef(false);

  useEffect(() => {
    if (!seg) return;
    // First layout places the pill without sliding in from the left edge.
    x.value = placed.current ? withTiming(index * seg, timing(duration.base)) : index * seg;
    placed.current = true;
  }, [index, seg, x]);

  const pill = useAnimatedStyle(() => ({ width: seg, transform: [{ translateX: x.value }] }));

  return (
    <View
      style={[styles.track, style]}
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
    >
      {/* Dark surfaces are too close in tone, so the pill lifts to the strong border colour, as iOS does */}
      {seg > 0 && <Animated.View style={[styles.pill, isDark && { backgroundColor: c.borderStrong, borderColor: c.borderStrong }, pill]} pointerEvents="none" />}
      {segments.map((s) => {
        const on = s.key === value;
        return (
          <Pressable
            key={s.key}
            onPress={() => {
              if (!on) Haptics.selectionAsync().catch(() => {});
              onChange(s.key);
            }}
            style={styles.segment}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={s.label}
          >
            {s.dot && <View style={[styles.dot, { backgroundColor: s.dot }]} />}
            <Text style={[styles.label, on && styles.labelOn]} numberOfLines={1}>{s.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const PAD = 3;

const useStyles = createStyles((c) => ({
  track: {
    flexDirection: 'row',
    padding: PAD,
    borderRadius: radius.md,
    backgroundColor: c.surfaceAlt,
    borderWidth: 1,
    borderColor: c.border,
  },
  pill: {
    position: 'absolute',
    top: PAD,
    bottom: PAD,
    left: PAD,
    borderRadius: radius.md - PAD,
    backgroundColor: c.elevated,
    borderWidth: 1,
    borderColor: c.border,
    ...shadow(c, 1),
  },
  segment: {
    flex: 1,
    height: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 4,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  label: {
    ...typeScale.label,
    color: c.textMuted,
  },
  labelOn: {
    color: c.text,
    fontWeight: '700',
  },
}));
