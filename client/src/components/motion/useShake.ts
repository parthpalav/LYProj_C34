import * as Haptics from 'expo-haptics';
import { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

/** Horizontal shake for error feedback. Spread `style` onto an Animated.View and call `shake()`. */
export function useShake() {
  const x = useSharedValue(0);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const shake = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    x.value = withSequence(
      withTiming(-10, { duration: 50 }),
      withTiming(10, { duration: 50 }),
      withTiming(-7, { duration: 50 }),
      withTiming(7, { duration: 50 }),
      withTiming(0, { duration: 50 }),
    );
  };
  return { style, shake };
}
