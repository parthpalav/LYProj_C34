import React, { useState } from 'react';
import { StyleProp, StyleSheet, View, ViewProps, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import Animated from 'react-native-reanimated';
import { createStyles, radius, shadow, useTheme } from '../../theme';
import { fadeIn, rise } from '../../motion';
import { PressableScale } from '../motion/PressableScale';
import { AuroraBackground } from './AuroraBackground';

type Props = Omit<ViewProps, 'style'> & {
  /** plain = surface card, glass = frosted over content, hero = aurora gradient with light text */
  variant?: 'plain' | 'glass' | 'hero';
  padded?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
};

// Cards that mount together rise in one after another; a pause in mounting starts a new run.
let run = 0;
let lastMount = 0;
function nextDelay() {
  const now = Date.now();
  if (now - lastMount > 120) run = 0;
  lastMount = now;
  return Math.min(run++, 6) * 45;
}

export function Card({ variant = 'plain', padded = true, onPress, style, children, ...rest }: Props) {
  const styles = useStyles();
  const { isDark } = useTheme();
  // Pressable cards only fade: their press scale owns the transform.
  const [entering] = useState(() => { const delay = nextDelay(); return onPress ? fadeIn(delay) : rise(delay, 6); });
  const body = (
    <>
      {variant === 'hero' && <AuroraBackground blur={40} />}
      {variant === 'glass' && <BlurView intensity={isDark ? 40 : 60} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />}
      {children}
    </>
  );
  const cardStyle = [styles.base, styles[variant], padded && styles.padded, style];

  if (onPress) {
    return (
      <PressableScale entering={entering} onPress={onPress} scaleTo={0.98} style={cardStyle} accessibilityRole="button" {...rest}>
        {body}
      </PressableScale>
    );
  }
  return <Animated.View entering={entering} style={cardStyle} {...rest}>{body}</Animated.View>;
}

const useStyles = createStyles((c) => ({
  base: {
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  padded: {
    padding: 18,
  },
  plain: {
    backgroundColor: c.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    ...shadow(c, 1),
  },
  glass: {
    backgroundColor: c.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.glassBorder,
  },
  hero: {
    borderRadius: radius.xl,
    backgroundColor: c.aurora[1],
    ...shadow(c, 2),
  },
}));
