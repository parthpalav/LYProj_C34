import React, { useEffect, useMemo, useState } from 'react';
import { LayoutChangeEvent, StyleProp, View, ViewStyle } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import Animated, { Easing, useAnimatedProps, useReducedMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { useTheme } from '../../theme';
import { smoothPath } from '../../utils/chartMath';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
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

function Arc({ seg, start, total, r, size, stroke, index }: { seg: DonutSegment; start: number; total: number; r: number; size: number; stroke: number; index: number }) {
  const circumference = 2 * Math.PI * r;
  const gap = total > 0 && seg.value / total < 1 ? Math.min(6, circumference * 0.01) : 0;
  const length = Math.max(0, (seg.value / total) * circumference - gap);
  const t = useSweep(1, index * 90);
  const props = useAnimatedProps(() => ({ strokeDasharray: `${length * t.value} ${circumference}` }));
  return (
    <AnimatedCircle
      cx={size / 2}
      cy={size / 2}
      r={r}
      stroke={seg.color}
      strokeWidth={stroke}
      strokeLinecap="butt"
      fill="none"
      strokeDashoffset={-(start / total) * circumference}
      animatedProps={props}
    />
  );
}

/** Proportional ring of segments, drawn clockwise from 12 o'clock with small gaps. */
export function Donut({ segments, size = 160, stroke = 18, children }: { segments: DonutSegment[]; size?: number; stroke?: number; children?: React.ReactNode }) {
  const { c } = useTheme();
  const r = (size - stroke) / 2;
  const total = segments.reduce((s, x) => s + Math.max(0, x.value), 0);
  let acc = 0;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={c.surfaceAlt} strokeWidth={stroke} fill="none" />
        {total > 0 &&
          segments.map((seg, i) => {
            const start = acc;
            acc += Math.max(0, seg.value);
            return <Arc key={i} seg={seg} start={start} total={total} r={r} size={size} stroke={stroke} index={i} />;
          })}
      </Svg>
      {children}
    </View>
  );
}

/** Trend line with a soft gradient fill underneath; stretches to its container's width. */
export function Sparkline({ data, height = 56, color, fill = true, style }: { data: number[]; height?: number; color?: string; fill?: boolean; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  const [width, setWidth] = useState(0);
  const stroke = color ?? c.primary;
  const { line, area } = useMemo(() => {
    if (width === 0 || data.length < 2) return { line: '', area: '' };
    const min = Math.min(...data);
    const max = Math.max(...data);
    const span = max - min || 1;
    const pad = 3;
    const pts = data.map((v, i) => ({
      x: (i / (data.length - 1)) * width,
      y: pad + (1 - (v - min) / span) * (height - pad * 2),
    }));
    const l = smoothPath(pts);
    return { line: l, area: `${l} L ${width} ${height} L 0 ${height} Z` };
  }, [data, width, height]);

  return (
    <View style={[{ height }, style]} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 && (
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id="spark" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={stroke} stopOpacity={0.28} />
              <Stop offset="1" stopColor={stroke} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          {fill && <Path d={area} fill="url(#spark)" />}
          <Path d={line} stroke={stroke} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      )}
    </View>
  );
}
