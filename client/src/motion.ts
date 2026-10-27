import { Easing, FadeIn, FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';

// Motion tokens: short, eased, no overshoot. Layout animations follow the system Reduce Motion setting by default.
export const duration = { fast: 160, base: 240, slow: 380 };

export const easing = {
  standard: Easing.bezier(0.2, 0, 0, 1),
  exit: Easing.bezier(0.3, 0, 1, 1),
};

/** Critically damped: settles without bouncing. */
export const spring = { damping: 30, stiffness: 300, mass: 1, overshootClamping: true };

export const timing = (ms: number = duration.base) => ({ duration: ms, easing: easing.standard });

/** Staggered entrance: fades in while rising 8pt. */
export const enterUp = (index = 0, step = 40) =>
  FadeInDown.delay(Math.min(index, 8) * step)
    .duration(duration.slow)
    .easing(easing.standard)
    .withInitialValues({ opacity: 0, transform: [{ translateY: 8 }] });

export const fadeIn = (delay = 0) => FadeIn.delay(delay).duration(duration.base).easing(easing.standard);

export const exitFade = FadeOut.duration(duration.fast).easing(easing.exit);

export const listLayout = LinearTransition.duration(duration.base).easing(easing.standard);
