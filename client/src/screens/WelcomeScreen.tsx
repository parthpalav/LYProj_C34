import React, { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../store/useAuthStore';
import { createStyles, typeScale } from '../theme';
import { easing } from '../motion';
import { AuroraBackground } from '../components/ui/AuroraBackground';
import { Button } from '../components/ui/Button';

const finauraLogo = require('../assets/finaura_logo.png');

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

/** Shown after an explicit sign-in. Stays on the login's aurora so the hand-off to Home is one continuous fade. */
export function WelcomeScreen({ onContinue }: WelcomeScreenProps): React.ReactElement {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((state) => state.user);
  const dismissWelcome = useAuthStore((state) => state.dismissWelcome);
  const [submitting, setSubmitting] = useState(false);

  const firstName = getFirstName(user?.name);
  const greetingText = firstName ? `Welcome, ${firstName}` : 'Welcome';

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
      <AuroraBackground />
      <View style={styles.contentWrap}>
        <Animated.View entering={ZoomIn.duration(520).easing(easing.standard)} style={styles.logoWrap}>
          <Image source={finauraLogo} style={styles.logoImage} resizeMode="cover" />
        </Animated.View>
        <Animated.Text entering={FadeIn.delay(150).duration(400)} style={styles.badgeText}>FINAURA</Animated.Text>
        <Animated.Text entering={FadeInDown.delay(220).duration(480).easing(easing.standard)} style={styles.greetingTitle} numberOfLines={2} adjustsFontSizeToFit>
          {greetingText}
        </Animated.Text>
        <Animated.Text entering={FadeInDown.delay(320).duration(480).easing(easing.standard)} style={styles.subtitle}>Good to see you again.</Animated.Text>
      </View>

      <Animated.View entering={FadeInDown.delay(450).duration(480)} style={styles.bottomWrap}>
        <Button label="Continue" onPress={handleContinue} loading={submitting} style={styles.continueButton} accessibilityLabel="Continue to Home" />
      </Animated.View>
    </View>
  );
}

const useStyles = createStyles((c) => ({
  container: {
    flex: 1,
    backgroundColor: c.aurora[0],
    justifyContent: 'space-between',
    paddingHorizontal: 24,
  },
  contentWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoWrap: {
    width: 96,
    height: 96,
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.35)',
    marginBottom: 20,
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  badgeText: {
    ...typeScale.overline,
    letterSpacing: 3,
    color: c.onAuroraMuted,
    marginBottom: 10,
  },
  greetingTitle: {
    ...typeScale.display,
    color: c.onAurora,
    textAlign: 'center',
  },
  subtitle: {
    ...typeScale.body,
    fontSize: 17,
    color: c.onAuroraMuted,
    marginTop: 8,
    textAlign: 'center',
  },
  bottomWrap: {
    width: '100%',
  },
  continueButton: {
    width: '100%',
  },
}));
