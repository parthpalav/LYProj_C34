import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, LayoutChangeEvent, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, interpolate, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createStyles, radius, shadow, typeScale } from '../../theme';
import { duration } from '../../motion';

type Props = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
};

const OFFSCREEN = 2000;

/**
 * Compact bottom sheet for pickers and action lists. Drag the grabber or title down, tap the
 * backdrop, or use the system back gesture to close. Larger editors should use a pageSheet Modal.
 */
export function Sheet({ visible, onClose, title, children }: Props) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(visible);
  const height = useSharedValue(OFFSCREEN);
  const y = useSharedValue(OFFSCREEN);

  useEffect(() => {
    if (visible) setMounted(true);
    else if (mounted) {
      y.value = withTiming(height.value, { duration: duration.base, easing: Easing.in(Easing.cubic) }, (done) => {
        if (!done) return;
        height.value = OFFSCREEN; // so the next open measures and slides in again
        scheduleOnRN(setMounted, false);
      });
    }
  }, [visible, mounted, y, height]);

  const onLayout = (e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (height.value === OFFSCREEN) {
      height.value = h;
      y.value = h;
      y.value = withTiming(0, { duration: duration.slow, easing: Easing.out(Easing.cubic) });
    } else {
      height.value = h;
    }
  };

  const pan = usePanGesture({
    onUpdate: (e) => {
      'worklet';
      y.value = Math.max(0, e.translationY);
    },
    onDeactivate: (e) => {
      'worklet';
      if (e.translationY > height.value * 0.3 || e.velocityY > 900) scheduleOnRN(onClose);
      else y.value = withSpring(0, { damping: 30, stiffness: 300 });
    },
  });

  const panel = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  const backdrop = useAnimatedStyle(() => ({
    opacity: height.value === OFFSCREEN ? 0 : interpolate(y.value, [0, height.value], [1, 0]),
  }));

  if (!mounted) return null;
  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdrop]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" />
      </Animated.View>
      <KeyboardAvoidingView style={styles.anchor} behavior={Platform.OS === 'ios' ? 'padding' : undefined} pointerEvents="box-none">
        <Animated.View style={[styles.panel, { paddingBottom: insets.bottom + 16 }, panel]} onLayout={onLayout} accessibilityViewIsModal>
          <GestureDetector gesture={pan}>
            <View style={styles.handleArea}>
              <View style={styles.grabber} />
              {!!title && <Text style={styles.title} accessibilityRole="header">{title}</Text>}
            </View>
          </GestureDetector>
          {children}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const useStyles = createStyles((c) => ({
  backdrop: {
    backgroundColor: c.overlay,
  },
  anchor: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  panel: {
    backgroundColor: c.elevated,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: 20,
    maxHeight: '90%',
    ...shadow(c, 3),
  },
  handleArea: {
    paddingTop: 10,
    paddingBottom: 12,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: c.borderStrong,
    marginBottom: 12,
  },
  title: {
    ...typeScale.headline,
    color: c.text,
  },
}));
