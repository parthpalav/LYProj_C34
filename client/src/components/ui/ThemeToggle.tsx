import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated from 'react-native-reanimated';
import { createStyles, useTheme } from '../../theme';
import { popIn } from '../../motion';
import { PressableScale } from '../motion/PressableScale';

/** Sun/moon button that flips between light and dark. You & Settings still offers "System". */
export function ThemeToggle({ style, size = 18 }: { style?: StyleProp<ViewStyle>; size?: number }) {
  const styles = useStyles();
  const { c, isDark, toggle } = useTheme();
  return (
    <PressableScale
      onPress={toggle}
      hitSlop={8}
      style={[styles.button, style]}
      accessibilityRole="button"
      accessibilityLabel={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {/* keyed so the new icon fades in instead of swapping hard */}
      <Animated.View key={isDark ? 'sun' : 'moon'} entering={popIn()}>
        <Ionicons name={isDark ? 'sunny-outline' : 'moon-outline'} size={size} color={c.text} />
      </Animated.View>
    </PressableScale>
  );
}

const useStyles = createStyles((c) => ({
  button: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surfaceAlt,
  },
}));
