import React, { useEffect, useState } from 'react';
import { StyleProp, Text, TextInput, TextInputProps, TextStyle, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { createStyles, useTheme } from '../../theme';
import { duration, timing } from '../../motion';

type Props = Omit<TextInputProps, 'style'> & {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  error?: string;
  /** Extra TextInput style, e.g. right padding for a trailing button. */
  style?: StyleProp<TextStyle>;
  /** Trailing element rendered inside the field (absolute, right). */
  trailing?: React.ReactNode;
  /** Optional element on the label row's right (e.g. "Forgot?"). */
  labelAction?: React.ReactNode;
};

/** Labeled auth field: leading icon, focus ring that tints in 180ms, inline error. */
export function AuthInput({ label, icon, error, style, trailing, labelAction, onFocus, onBlur, ...rest }: Props) {
  const { c, isDark } = useTheme();
  const styles = useStyles();
  const [focused, setFocused] = useState(false);
  const f = useSharedValue(0);
  useEffect(() => {
    f.value = withTiming(focused ? 1 : 0, timing(duration.fast + 20));
  }, [focused, f]);
  const ring = useAnimatedStyle(() => ({
    borderColor: error ? c.danger : interpolateColor(f.value, [0, 1], [c.border, c.primary]),
  }));

  return (
    <View style={styles.wrap}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {labelAction}
      </View>
      <Animated.View style={[styles.field, ring]}>
        <Ionicons name={icon} size={18} color={focused ? c.primary : c.textSubtle} style={styles.icon} />
        <TextInput
          {...rest}
          style={[styles.input, style]}
          placeholderTextColor={c.textSubtle}
          keyboardAppearance={isDark ? 'dark' : 'light'}
          selectionColor={c.primary}
          onFocus={(e) => { setFocused(true); onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); onBlur?.(e); }}
        />
        {trailing}
      </Animated.View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const useStyles = createStyles((c) => ({
  wrap: {
    marginBottom: 14,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: c.textMuted,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    backgroundColor: c.surface,
  },
  icon: {
    marginLeft: 14,
  },
  input: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 10,
    fontSize: 15,
    color: c.text,
  },
  error: {
    fontSize: 12,
    color: c.danger,
    marginTop: 6,
  },
}));
