import { useState, useEffect, useRef } from 'react';

interface UseAnimatedNumberOptions {
  duration?: number;
  enabled?: boolean;
}

/**
 * Lightweight, zero-dependency visual interpolation for numeric KPIs.
 * - Animates only upon valid value change
 * - Never starts from 0 on ordinary refetches if a prior value exists
 * - Never flashes 0 while loading
 * - Always finishes on the exact backend value
 * - Respects prefers-reduced-motion: reduce
 */
export function useAnimatedNumber(
  targetValue: number | null | undefined,
  options: UseAnimatedNumberOptions = {}
): number | null | undefined {
  const { duration = 500, enabled = true } = options;
  const [displayValue, setDisplayValue] = useState<number | null | undefined>(targetValue);
  const prevTargetRef = useRef<number | null | undefined>(undefined);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    // If targetValue is nullish or animation is disabled
    if (targetValue === null || targetValue === undefined || !enabled) {
      prevTargetRef.current = targetValue;
      rafRef.current = requestAnimationFrame(() => {
        setDisplayValue(targetValue);
      });
      return () => {
        if (rafRef.current !== null) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
      };
    }

    // Respect prefers-reduced-motion
    if (
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      prevTargetRef.current = targetValue;
      rafRef.current = requestAnimationFrame(() => {
        setDisplayValue(targetValue);
      });
      return () => {
        if (rafRef.current !== null) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
      };
    }

    const previous = prevTargetRef.current;
    const startValue = typeof previous === 'number' ? previous : 0;
    prevTargetRef.current = targetValue;

    // If identical, don't run animation
    if (startValue === targetValue) {
      return;
    }

    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      const current = startValue + (targetValue - startValue) * easeProgress;

      if (progress < 1) {
        setDisplayValue(Math.round(current));
        rafRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayValue(targetValue);
        rafRef.current = null;
      }
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [targetValue, duration, enabled]);

  return displayValue;
}
