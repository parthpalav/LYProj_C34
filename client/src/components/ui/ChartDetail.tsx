import React, { useEffect, useState } from 'react';
import { Pressable, StyleProp, Text, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { duration, timing } from '../../motion';
import { createStyles, radius, tabular } from '../../theme';

/**
 * Tap-to-inspect state for a chart. `index` is the highlighted part (null when closed);
 * `shown` keeps the last picked part so the panel's content doesn't blank while it collapses.
 */
export function usePick() {
  const [pick, setPick] = useState({ shown: 0, open: false });
  return {
    index: pick.open ? pick.shown : null,
    shown: pick.shown,
    open: pick.open,
    toggle: (i: number) => {
      Haptics.selectionAsync().catch(() => {});
      setPick((p) => ({ shown: i, open: !(p.open && p.shown === i) }));
    },
    close: () => setPick((p) => ({ ...p, open: false })),
  };
}

/** Grows to its content's height when `open` and collapses to nothing otherwise. */
export function Reveal({ open, children }: { open: boolean; children: React.ReactNode }) {
  const reduced = useReducedMotion();
  const [height, setHeight] = useState(0);
  const t = useSharedValue(open ? 1 : 0);
  useEffect(() => {
    t.value = reduced ? (open ? 1 : 0) : withTiming(open ? 1 : 0, timing(duration.slow));
  }, [open, reduced, t]);
  const style = useAnimatedStyle(() => ({ height: height * t.value, opacity: t.value }), [height]);
  return (
    <Animated.View
      style={[{ overflow: 'hidden' }, style]}
      pointerEvents={open ? 'auto' : 'none'}
      accessibilityElementsHidden={!open}
      importantForAccessibility={open ? 'auto' : 'no-hide-descendants'}
    >
      {/* Absolutely placed so it keeps its natural height while the wrapper animates. */}
      <View style={{ position: 'absolute', left: 0, right: 0, top: 0 }} onLayout={(e) => setHeight(e.nativeEvent.layout.height)}>
        {children}
      </View>
    </Animated.View>
  );
}

type Stat = { label: string; value: string };

type Props = {
  open: boolean;
  title: string;
  /** colour of the leading edge, usually the picked part's colour */
  accent: string;
  stats: Stat[];
  note?: string;
  onClose: () => void;
  /** for panels sitting on the dark aurora hero */
  onAurora?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Summary that expands under a chart when one of its parts is tapped. */
export function ChartDetail({ open, title, accent, stats, note, onClose, onAurora, style }: Props) {
  const s = useStyles();
  return (
    <Reveal open={open}>
      <View style={[s.panel, onAurora && s.panelAurora, { borderLeftColor: accent }, style]} accessibilityLiveRegion="polite">
        <View style={s.head}>
          <Text style={[s.title, onAurora && s.light]} numberOfLines={1}>{title}</Text>
          <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close summary">
            <Ionicons name="close" size={16} color={onAurora ? 'rgba(255,255,255,0.75)' : s.muted.color as string} />
          </Pressable>
        </View>
        <View style={s.stats}>
          {stats.map((x) => (
            <View key={x.label} style={s.stat}>
              <Text style={[s.statLabel, onAurora && s.lightMuted]}>{x.label}</Text>
              <Text style={[s.statValue, onAurora && s.light]} numberOfLines={1} adjustsFontSizeToFit>{x.value}</Text>
            </View>
          ))}
        </View>
        {!!note && <Text style={[s.note, onAurora && s.lightMuted]}>{note}</Text>}
      </View>
    </Reveal>
  );
}

const useStyles = createStyles((c) => ({
  panel: {
    marginTop: 14,
    padding: 14,
    borderRadius: radius.md,
    borderLeftWidth: 3,
    backgroundColor: c.surfaceAlt,
  },
  panelAurora: { backgroundColor: 'rgba(255,255,255,0.12)' },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  title: { flex: 1, fontSize: 14, fontWeight: '700', color: c.text },
  stats: { flexDirection: 'row', gap: 14, marginTop: 10 },
  stat: { flex: 1 },
  statLabel: { fontSize: 11, fontWeight: '500', color: c.textMuted },
  statValue: { fontSize: 16, fontWeight: '700', color: c.text, marginTop: 2, ...tabular },
  note: { fontSize: 12, lineHeight: 17, color: c.textMuted, marginTop: 10 },
  muted: { color: c.textMuted },
  light: { color: '#FFFFFF' },
  lightMuted: { color: 'rgba(255,255,255,0.72)' },
}));
