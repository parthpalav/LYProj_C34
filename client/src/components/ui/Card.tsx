import React from 'react';
import { StyleProp, StyleSheet, View, ViewProps, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { createStyles, radius, shadow, useTheme } from '../../theme';
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

export function Card({ variant = 'plain', padded = true, onPress, style, children, ...rest }: Props) {
  const styles = useStyles();
  const { isDark } = useTheme();
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
      <PressableScale onPress={onPress} scaleTo={0.98} style={cardStyle} accessibilityRole="button" {...rest}>
        {body}
      </PressableScale>
    );
  }
  return <View style={cardStyle} {...rest}>{body}</View>;
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
