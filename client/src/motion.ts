import { Easing, FadeIn, FadeInDown, FadeOut, LinearTransition, withDelay, withTiming } from 'react-native-reanimated';

// Motion tokens: short, eased, no overshoot. Layout animations follow the system Reduce Motion setting by default.
export const duration = { fast: 160, base: 240, slow: 380 };

export const easing = {
  standard: Easing.bezier(0.2, 0, 0, 1),
  exit: Easing.bezier(0.3, 0, 1, 1),
};

/** Critically damped: settles without bouncing. */
export const spring = { damping: 30, stiffness: 300, mass: 1, overshootClamping: true };

export const timing = (ms: number = duration.base) => ({ duration: ms, easing: easing.standard });

/** Fades in while rising `offset` pt. */
export const rise = (delay = 0, offset = 8) =>
  FadeInDown.delay(delay)
    .duration(duration.slow)
    .easing(easing.standard)
    .withInitialValues({ opacity: 0, transform: [{ translateY: offset }] });

/** Staggered entrance: fades in while rising 8pt. */
export const enterUp = (index = 0, step = 40) => rise(Math.min(index, 8) * step);

const popConfig = { duration: duration.slow, easing: easing.standard };

/** Fades in while settling from 96% scale: for cards, badges and logos. Replaces springy zooms. */
export const popIn = (delay = 0) => () => {
  'worklet';
  return {
    initialValues: { opacity: 0, transform: [{ scale: 0.96 }] },
    animations: {
      opacity: withDelay(delay, withTiming(1, popConfig)),
      transform: [{ scale: withDelay(delay, withTiming(1, popConfig)) }],
    },
  };
};

export const fadeIn = (delay = 0) => FadeIn.delay(delay).duration(duration.base).easing(easing.standard);

export const exitFade = FadeOut.duration(duration.fast).easing(easing.exit);

export const listLayout = LinearTransition.duration(duration.base).easing(easing.standard);
