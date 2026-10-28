import React, { useState } from 'react';
import { ActivityIndicator, StyleProp, Text, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { createStyles, radius, useTheme } from '../../theme';
import { PressableScale } from '../motion/PressableScale';

type Props = {
  label: string;
  /** May return a promise: the button shows a spinner and ignores taps until it settles. */
  onPress: () => unknown;
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive';
  size?: 'md' | 'sm';
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

export function Button({ label, onPress, variant = 'primary', size = 'md', icon, loading, disabled, style, accessibilityLabel }: Props) {
  const styles = useStyles();
  const { c } = useTheme();
  const [busy, setBusy] = useState(false);
  const spinning = loading || busy;
  const inactive = disabled || spinning;
  const fg = { primary: c.onPrimary, secondary: c.primary, ghost: c.primary, destructive: c.danger }[variant];

  const press = async () => {
    if (inactive) return;
    const result = onPress();
    if (result instanceof Promise) {
      setBusy(true);
      try {
        await result;
      } finally {
        setBusy(false);
      }
    }
  };

  const content = spinning ? (
    <ActivityIndicator color={fg} />
  ) : (
    <View style={styles.row}>
      {icon && <Ionicons name={icon} size={size === 'sm' ? 16 : 18} color={fg} />}
      <Text style={[styles.label, size === 'sm' && styles.labelSm, { color: fg }]}>{label}</Text>
    </View>
  );

  return (
    <PressableScale
      onPress={press}
      disabled={inactive}
      style={[styles.base, size === 'sm' ? styles.sm : styles.md, styles[variant], disabled && !spinning && styles.disabled, style]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: inactive, busy: spinning }}
    >
      {variant === 'primary' ? (
        <LinearGradient colors={c.accent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fill}>
          {content}
        </LinearGradient>
      ) : (
        content
      )}
    </PressableScale>
  );
}

const useStyles = createStyles((c) => ({
  base: {
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  md: {
    height: 52,
  },
  sm: {
    height: 40,
    paddingHorizontal: 14,
  },
  fill: {
    alignSelf: 'stretch',
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  primary: {
    backgroundColor: c.primary,
    shadowColor: c.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 5,
    overflow: 'visible',
  },
  secondary: {
    backgroundColor: c.primarySoft,
    paddingHorizontal: 18,
  },
  ghost: {
    backgroundColor: 'transparent',
    paddingHorizontal: 12,
  },
  destructive: {
    backgroundColor: c.dangerSoft,
    paddingHorizontal: 18,
  },
  disabled: {
    opacity: 0.5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  labelSm: {
    fontSize: 14,
  },
}));
