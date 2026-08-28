import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Image,
  Easing
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../store/useAuthStore';

const finauraLogo = require('../assets/finaura_logo.png');
const { width } = Dimensions.get('window');

const BLUE = '#3B3BDE';

export function getFirstName(name?: string | null): string | null {
  if (!name) return null;
  const trimmed = name.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(/\s+/);
  const first = parts[0];
  return first && first.length > 0 ? first : null;
}

interface WelcomeScreenProps {
  onContinue?: () => void;
}

export function WelcomeScreen({ onContinue }: WelcomeScreenProps): React.ReactElement {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((state) => state.user);
  const dismissWelcome = useAuthStore((state) => state.dismissWelcome);
  const [submitting, setSubmitting] = useState(false);

  const firstName = getFirstName(user?.name);
  const greetingText = firstName ? `Welcome, ${firstName}` : 'Welcome';

  // Entry animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const logoScale = useRef(new Animated.Value(0.7)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(logoScale, {
        toValue: 1,
        friction: 6,
        tension: 45,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim, logoScale]);

  const handleContinue = () => {
    if (submitting) return;
    setSubmitting(true);
    if (onContinue) {
      onContinue();
    } else {
      dismissWelcome();
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 20, paddingBottom: Math.max(20, insets.bottom + 12) }]}>
      {/* Upper / Middle Content */}
      <Animated.View
        style={[
          styles.contentWrap,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <Animated.View style={[styles.logoWrap, { transform: [{ scale: logoScale }] }]}>
          <Image source={finauraLogo} style={styles.logoImage} resizeMode="contain" />
        </Animated.View>

        <Text style={styles.badgeText}>FINAURA</Text>
        <Text style={styles.greetingTitle} numberOfLines={2} adjustsFontSizeToFit>
          {greetingText}
        </Text>
        <Text style={styles.subtitle}>Good to see you again.</Text>
      </Animated.View>

      {/* Bottom CTA Button */}
      <View style={styles.bottomWrap}>
        <TouchableOpacity
          style={[styles.continueButton, submitting && styles.continueButtonDisabled]}
          onPress={handleContinue}
          activeOpacity={0.85}
          disabled={submitting}
          accessibilityRole="button"
          accessibilityLabel="Continue to Home"
        >
          <Text style={styles.continueButtonText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
  },
  contentWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 40,
  },
  logoWrap: {
    width: 96,
    height: 96,
    borderRadius: 28,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    shadowColor: BLUE,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 4,
  },
  logoImage: {
    width: 58,
    height: 58,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2.0,
    color: BLUE,
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  greetingTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    letterSpacing: -0.5,
    marginBottom: 10,
    paddingHorizontal: 16,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
    fontWeight: '500',
    lineHeight: 24,
  },
  bottomWrap: {
    width: '100%',
    paddingTop: 12,
  },
  continueButton: {
    backgroundColor: BLUE,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    shadowColor: BLUE,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  continueButtonDisabled: {
    opacity: 0.7,
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
