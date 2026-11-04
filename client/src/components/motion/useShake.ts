import * as Haptics from 'expo-haptics';
import { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

/** Horizontal shake for error feedback. Spread `style` onto an Animated.View and call `shake()`. */
export function useShake() {
  const x = useSharedValue(0);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const shake = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    x.value = withSequence(
      withTiming(-6, { duration: 40 }),
      withTiming(6, { duration: 40 }),
      withTiming(-4, { duration: 40 }),
      withTiming(4, { duration: 40 }),
      withTiming(0, { duration: 40 }),
    );
  };
  return { style, shake };
}
