import React, { useEffect, useRef, useState } from 'react';
import { StyleProp, Text, TextStyle } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { formatCurrency } from '../../utils/format';

/** Counts from the previous value to the new one (from `initial`, default 0, on first mount). */
export function useCountUp(value: number, duration = 900, initial = 0): number {
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState(reduced ? value : initial);
  const fromRef = useRef(reduced ? value : initial);

  useEffect(() => {
    if (reduced || !Number.isFinite(value)) {
      fromRef.current = value;
      setDisplay(value);
      return;
    }
    const from = fromRef.current;
    const start = Date.now();
    let frame = 0;
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      const next = from + (value - from) * eased;
      fromRef.current = next;
      setDisplay(next);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration, reduced]);

  return display;
}

type Props = {
  value: number;
  /** value shown on first mount before counting to `value` */
  from?: number;
  format?: (n: number) => string;
  style?: StyleProp<TextStyle>;
  duration?: number;
  numberOfLines?: number;
  adjustsFontSizeToFit?: boolean;
};

export function AnimatedNumber({ value, from = 0, format = formatCurrency, style, duration, numberOfLines, adjustsFontSizeToFit }: Props) {
  const display = useCountUp(value, duration, from);
  return (
    <Text style={style} numberOfLines={numberOfLines} adjustsFontSizeToFit={adjustsFontSizeToFit}>
      {format(Math.round(display))}
    </Text>
  );
}
