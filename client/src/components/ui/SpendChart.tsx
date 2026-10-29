import React, { useEffect, useMemo, useState } from 'react';
import { AccessibilityActionEvent, LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import Animated, { useSharedValue } from 'react-native-reanimated';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';
import * as Haptics from 'expo-haptics';
import { createStyles, tabular, useTheme } from '../../theme';
import { fadeIn } from '../../motion';
import { monotonePath } from '../../utils/chartMath';
import { Bucket, bucketLabel, indexAtX, yTicks } from '../../utils/spending';
import { formatCompact, formatCurrency } from '../../utils/format';

type Props = {
  buckets: Bucket[];
  /** index under the finger, or null when nothing is being inspected */
  active: number | null;
  onScrub: (index: number | null) => void;
  /** changes when the range changes, so the new line fades in */
  rangeKey: string;
  height?: number;
};

const TOP = 22; // room for the top gridline label
const BOTTOM = 6;
const GUTTER = 44; // y-axis labels sit to the right of the line, never on it

/**
 * Spending over time as a smooth area line. Press and drag horizontally to inspect a point; a vertical
 * drag is left to the page so it can still scroll and pull to refresh.
 */
export function SpendChart({ buckets, active, onScrub, rangeKey, height = 230 }: Props) {
  const { c } = useTheme();
  const styles = useStyles();
  const [width, setWidth] = useState(0);
  const n = buckets.length;
  const ticks = useMemo(() => yTicks(Math.max(0, ...buckets.map((b) => b.total))), [buckets]);
  const top = ticks[ticks.length - 1];
  const plotH = height - TOP - BOTTOM;
  const plotW = Math.max(0, width - GUTTER);
  const xAt = (i: number) => (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const yAt = (v: number) => TOP + (1 - v / top) * plotH;

  const { line, area } = useMemo(() => {
    if (!plotW || !n) return { line: '', area: '' };
    const pts = buckets.map((b, i) => ({ x: n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW, y: TOP + (1 - b.total / top) * plotH }));
    const l = monotonePath(pts);
    return { line: l, area: `${l} L ${pts[n - 1].x} ${height - BOTTOM} L ${pts[0].x} ${height - BOTTOM} Z` };
  }, [buckets, plotW, n, top, plotH, height]);

  // The gesture runs on the UI thread, so it reads size from shared values and only calls back on a new index.
  const w = useSharedValue(0);
  const count = useSharedValue(0);
  const last = useSharedValue(-1);
  useEffect(() => {
    w.value = plotW;
    count.value = n;
  }, [plotW, n, w, count]);

  const emit = (i: number) => {
    if (i >= 0) Haptics.selectionAsync().catch(() => {});
    onScrub(i < 0 ? null : i);
  };

  const pan = usePanGesture({
    activeOffsetX: [-4, 4],
    failOffsetY: [-14, 14],
    onBegin: (e) => {
      'worklet';
      if (count.value === 0) return;
      last.value = indexAtX(e.x, w.value, count.value);
      scheduleOnRN(emit, last.value);
    },
    onUpdate: (e) => {
      'worklet';
      const i = indexAtX(e.x, w.value, count.value);
      if (i !== last.value) {
        last.value = i;
        scheduleOnRN(emit, i);
      }
    },
    onFinalize: () => {
      'worklet';
      last.value = -1;
      scheduleOnRN(emit, -1);
    },
  });

  // VoiceOver: swipe up/down steps through the points.
  const onAccessibilityAction = (e: AccessibilityActionEvent) => {
    if (!n) return;
    const from = active ?? (e.nativeEvent.actionName === 'increment' ? -1 : n);
    const next = e.nativeEvent.actionName === 'increment' ? Math.min(n - 1, from + 1) : Math.max(0, from - 1);
    onScrub(next);
  };

  const labelIdx = n <= 1 ? [0] : [...new Set([0, Math.round((n - 1) / 3), Math.round(((n - 1) * 2) / 3), n - 1])];
  const short = (b: Bucket) => b.start.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  const point = active !== null && active < n ? active : null;

  return (
    <View>
      <GestureDetector gesture={pan}>
        <View
          style={{ height }}
          onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel="Spending chart"
          accessibilityValue={{ text: point !== null ? `${bucketLabel(buckets[point])}, ${formatCurrency(buckets[point].total)}` : 'Swipe up or down to step through' }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={onAccessibilityAction}
        >
          {width > 0 && n > 0 && (
            <Animated.View key={rangeKey} entering={fadeIn()} style={StyleSheet.absoluteFill}>
              <Svg width={width} height={height}>
                <Defs>
                  <LinearGradient id="spendFill" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor={c.primary} stopOpacity={0.26} />
                    <Stop offset="1" stopColor={c.primary} stopOpacity={0} />
                  </LinearGradient>
                </Defs>
                {ticks.map((t) => (
                  <Line key={t} x1={0} x2={width} y1={yAt(t)} y2={yAt(t)} stroke={t === 0 ? c.borderStrong : c.border} strokeWidth={1} strokeDasharray={t === 0 ? undefined : '3 5'} />
                ))}
                {n > 1 && <Path d={area} fill="url(#spendFill)" />}
                {n > 1 && <Path d={line} stroke={c.primary} strokeWidth={2.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />}
                {n === 1 && <Circle cx={xAt(0)} cy={yAt(buckets[0].total)} r={5} fill={c.primary} />}
                {point !== null && (
                  <>
                    {/* the part after the finger steps back so the inspected point reads as "now" */}
                    <Rect x={xAt(point)} y={0} width={Math.max(0, plotW - xAt(point))} height={height} fill={c.bg} opacity={0.6} />
                    <Line x1={xAt(point)} x2={xAt(point)} y1={TOP - 12} y2={height - BOTTOM} stroke={c.textSubtle} strokeWidth={1} />
                    <Circle cx={xAt(point)} cy={yAt(buckets[point].total)} r={6} fill={c.primary} stroke={c.bg} strokeWidth={2.5} />
                  </>
                )}
              </Svg>
            </Animated.View>
          )}
          {ticks.slice(1).map((t) => (
            <Text key={t} style={[styles.yLabel, { top: yAt(t) - 16 }]} pointerEvents="none">{formatCompact(t)}</Text>
          ))}
        </View>
      </GestureDetector>

      <View style={styles.xRow}>
        {width > 0 && labelIdx.map((i) => {
          const x = xAt(i);
          const align = n <= 1 ? 'center' : i === 0 ? 'left' : i === n - 1 ? 'right' : 'center';
          const pos = align === 'left' ? { left: 0 } : align === 'right' ? { left: x - 80 } : { left: x - 40 };
          return <Text key={i} style={[styles.xLabel, { textAlign: align }, pos]}>{short(buckets[i])}</Text>;
        })}
      </View>
    </View>
  );
}

const useStyles = createStyles((c) => ({
  yLabel: {
    position: 'absolute',
    right: 0,
    fontSize: 11,
    fontWeight: '600',
    color: c.textSubtle,
    ...tabular,
  },
  xRow: {
    height: 22,
    marginTop: 6,
  },
  xLabel: {
    position: 'absolute',
    width: 80,
    fontSize: 11,
    fontWeight: '600',
    color: c.textSubtle,
  },
}));
