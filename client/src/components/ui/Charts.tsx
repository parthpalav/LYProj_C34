import React, { useEffect, useMemo, useState } from 'react';
import { GestureResponderEvent, LayoutChangeEvent, Pressable, StyleProp, UIManager, View, ViewStyle } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import Animated, { Easing, useAnimatedProps, useReducedMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { useTheme } from '../../theme';
import { timing } from '../../motion';
import { sliceAt, smoothPath } from '../../utils/chartMath';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPath = Animated.createAnimatedComponent(Path);

// shortcut: dev builds made before react-native-svg was added lack its native views, so charts
// degrade to simple shapes instead of crashing; drop this once every build includes the module.
export const svgReady = !!UIManager.hasViewManagerConfig?.('RNSVGCircle');
const SWEEP = { duration: 1100, easing: Easing.out(Easing.cubic) };

/** Animates 0 -> target on mount and target -> next on change; jumps when Reduce Motion is on. */
function useSweep(target: number, delay = 0) {
  const reduced = useReducedMotion();
  const t = useSharedValue(reduced ? target : 0);
  useEffect(() => {
    t.value = reduced ? target : withDelay(delay, withTiming(target, SWEEP));
  }, [target, reduced, delay, t]);
  return t;
}

type RingProps = {
  /** 0-1 */
  progress: number;
  size?: number;
  stroke?: number;
  color?: string;
  trackColor?: string;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** Circular progress with rounded ends; children render centered inside. */
export function Ring({ progress, size = 120, stroke = 12, color, trackColor, children, style }: RingProps) {
  const { c } = useTheme();
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const t = useSweep(Math.max(0, Math.min(1, progress)));
  const props = useAnimatedProps(() => ({ strokeDashoffset: circumference * (1 - t.value) }));
  if (!svgReady) {
    return (
      <View style={[{ width: size, height: size, borderRadius: size / 2, borderWidth: stroke, borderColor: color ?? c.primary, alignItems: 'center', justifyContent: 'center' }, style]}>
        {children}
      </View>
    );
  }
  return (
    <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={trackColor ?? c.surfaceAlt} strokeWidth={stroke} fill="none" />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color ?? c.primary}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          animatedProps={props}
        />
      </Svg>
      {children}
    </View>
  );
}

export type DonutSegment = { value: number; color: string };

/** How far a picked slice's stroke grows; interactive donuts reserve this much room. */
const POP = 6;

function Arc({ seg, start, total, r, size, stroke, index, state }: { seg: DonutSegment; start: number; total: number; r: number; size: number; stroke: number; index: number; state: -1 | 0 | 1 }) {
  const circumference = 2 * Math.PI * r;
  const gap = total > 0 && seg.value / total < 1 ? Math.min(6, circumference * 0.01) : 0;
  const length = Math.max(0, (seg.value / total) * circumference - gap);
  const t = useSweep(1, index * 90);
  // 1 = picked (thicker), -1 = another slice is picked (faded), 0 = resting
  const reduced = useReducedMotion();
  const pick = useSharedValue(0);
  useEffect(() => {
    pick.value = reduced ? state : withTiming(state, timing());
  }, [state, reduced, pick]);
  const props = useAnimatedProps(() => ({
    strokeDasharray: `${length * t.value} ${circumference}`,
    strokeWidth: stroke + POP * Math.max(0, pick.value),
    opacity: 1 + 0.65 * Math.min(0, pick.value),
  }));
  return (
    <AnimatedCircle
      cx={size / 2}
      cy={size / 2}
      r={r}
      stroke={seg.color}
      strokeLinecap="butt"
      fill="none"
      strokeDashoffset={-(start / total) * circumference}
      animatedProps={props}
    />
  );
}

type DonutProps = {
  segments: DonutSegment[];
  size?: number;
  stroke?: number;
  children?: React.ReactNode;
  /** index of the picked slice; with onSelect the donut becomes tappable */
  selected?: number | null;
  /** called with the tapped slice's index */
  onSelect?: (index: number) => void;
};

/** Proportional ring of segments, drawn clockwise from 12 o'clock with small gaps. Tap a slice to pick it when onSelect is set. */
export function Donut({ segments, size = 160, stroke = 18, children, selected = null, onSelect }: DonutProps) {
  const { c } = useTheme();
  const r = (size - stroke - (onSelect ? POP : 0)) / 2;
  const total = segments.reduce((s, x) => s + Math.max(0, x.value), 0);
  let acc = 0;
  if (!svgReady) {
    return (
      <View style={{ width: size, height: size, borderRadius: size / 2, borderWidth: stroke, borderColor: segments[0]?.color ?? c.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
        {children}
      </View>
    );
  }
  // The ring and label ignore touches, so locationX/Y are always relative to this Pressable.
  const onPress = (e: GestureResponderEvent) => {
    const index = sliceAt(e.nativeEvent.locationX - size / 2, e.nativeEvent.locationY - size / 2, segments);
    if (index >= 0) onSelect?.(index);
  };
  return (
    <Pressable
      disabled={!onSelect || total <= 0}
      onPress={onPress}
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
      accessibilityRole={onSelect ? 'button' : undefined}
      accessibilityLabel={onSelect ? 'Chart. Tap a slice for its summary' : undefined}
    >
      <Svg width={size} height={size} pointerEvents="none" style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={c.surfaceAlt} strokeWidth={stroke} fill="none" />
        {total > 0 &&
          segments.map((seg, i) => {
            const start = acc;
            acc += Math.max(0, seg.value);
            return <Arc key={i} seg={seg} start={start} total={total} r={r} size={size} stroke={stroke} index={i} state={selected === null ? 0 : selected === i ? 1 : -1} />;
          })}
      </Svg>
      <View pointerEvents="none" style={{ alignItems: 'center' }}>{children}</View>
    </Pressable>
  );
}

/** Trend line with a soft gradient fill underneath; stretches to its container's width. */
export function Sparkline({ data, height = 56, color, fill = true, style }: { data: number[]; height?: number; color?: string; fill?: boolean; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  const [width, setWidth] = useState(0);
  const stroke = color ?? c.primary;
  const { line, area, length } = useMemo(() => {
    if (width === 0 || data.length < 2) return { line: '', area: '', length: 0 };
    const min = Math.min(...data);
    const max = Math.max(...data);
    const span = max - min || 1;
    const pad = 3;
    const pts = data.map((v, i) => ({
      x: (i / (data.length - 1)) * width,
      y: pad + (1 - (v - min) / span) * (height - pad * 2),
    }));
    const l = smoothPath(pts);
    // Upper bound on the curve's length, so the dash can hide and then draw the whole line.
    const len = pts.slice(1).reduce((sum, p, i) => sum + Math.hypot(p.x - pts[i].x, p.y - pts[i].y), 0) * 1.25;
    return { line: l, area: `${l} L ${width} ${height} L 0 ${height} Z`, length: len };
  }, [data, width, height]);
  const drawn = useSweep(length > 0 ? 1 : 0);
  const lineProps = useAnimatedProps(() => ({ strokeDashoffset: length * (1 - drawn.value) }));
  const fillProps = useAnimatedProps(() => ({ opacity: drawn.value }));

  return (
    <View style={[{ height }, style]} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 && svgReady && (
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id="spark" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={stroke} stopOpacity={0.28} />
              <Stop offset="1" stopColor={stroke} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          {fill && <AnimatedPath d={area} fill="url(#spark)" animatedProps={fillProps} />}
          <AnimatedPath d={line} stroke={stroke} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={`${length} ${length}`} animatedProps={lineProps} />
        </Svg>
      )}
    </View>
  );
}
