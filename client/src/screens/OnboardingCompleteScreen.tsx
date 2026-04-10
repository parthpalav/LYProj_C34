import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../store/useStore';
import { useOnboardingStore } from '../store/onboardingContext';
import { completeOnboarding } from '../services/api';

const TOTAL_STEPS = 5;
const CURRENT_STEP = 5;

interface Props {
  onComplete?: () => void;
}

export function OnboardingCompleteScreen({ onComplete }: Props): React.ReactElement {
  const [loading, setLoading] = useState(false);
  const user = useStore((state) => state.user);
  const setUser = useStore((state) => state.setUser);
  const onboardingData = useOnboardingStore((state) => state.onboardingData);
  const resetOnboarding = useOnboardingStore((state) => state.reset);

  useEffect(() => {
    // Auto-submit onboarding data when screen loads
    handleCompleteOnboarding();
  }, []);

  const handleCompleteOnboarding = async () => {
    if (!user || !onboardingData.dateOfBirth || onboardingData.retirementAge === null || onboardingData.monthlyIncome === null) {
      Alert.alert('Error', 'Missing required onboarding information');
      return;
    }

    try {
      setLoading(true);
      const result = await completeOnboarding(
        user.id,
        onboardingData.dateOfBirth,
        onboardingData.retirementAge,
        onboardingData.monthlyIncome
      );

      // Update user in store with onboarding complete flag
      if (result.user) {
        setUser({
          ...user,
          ...result.user,
          onboardingComplete: true,
        });
      }

      // Reset onboarding store
      resetOnboarding();

      setTimeout(() => {
        onComplete?.();
      }, 1000);
    } catch (error: any) {
      Alert.alert(
        'Error',
        error?.response?.data?.error || 'Failed to complete onboarding'
      );
      setLoading(false);
    }
  };

  const handleSkip = () => {
    // Allow user to skip if they want
    onComplete?.();
  };
  
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Logo / Brand */}
        <View style={styles.logoRow}>
          <View style={styles.logoIcon}>
            <Text style={styles.logoIconText}>⟡</Text>
          </View>
          <Text style={styles.logoText}>Finaura</Text>
        </View>

        {/* Progress bar */}
        <View style={styles.progressContainer}>
          <Text style={styles.stepLabel}>Step {CURRENT_STEP} of {TOTAL_STEPS}</Text>
          <View style={styles.progressBarRow}>
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.progressSegment,
                  i < CURRENT_STEP ? styles.progressSegmentActive : styles.progressSegmentInactive,
                  { marginRight: i < TOTAL_STEPS - 1 ? 4 : 0 },
                ]}
              />
            ))}
          </View>
        </View>

        {/* Card */}
        <View style={styles.card}>
          {/* Success Icon or Loading */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={BRAND_BLUE} />
              <Text style={styles.loadingText}>Completing your setup...</Text>
            </View>
          ) : (
            <>
              {/* Success Icon */}
              <View style={styles.successIcon}>
                <Text style={styles.checkmark}>✓</Text>
              </View>

              {/* Heading */}
              <Text style={styles.heading}>You're all set!</Text>
              <Text style={styles.subtitle}>Your profile has been created and we're ready to help you manage your finances</Text>

              {/* Feature List */}
              <View style={styles.featureList}>
                <View style={styles.featureItem}>
                  <Text style={styles.featureBullet}>•</Text>
                  <Text style={styles.featureText}>Personalized financial insights</Text>
                </View>
                <View style={styles.featureItem}>
                  <Text style={styles.featureBullet}>•</Text>
                  <Text style={styles.featureText}>Smart budget tracking</Text>
                </View>
                <View style={styles.featureItem}>
                  <Text style={styles.featureBullet}>•</Text>
                  <Text style={styles.featureText}>Goal-based saving plans</Text>
                </View>
              </View>

              {/* Start Button */}
              <TouchableOpacity
                style={styles.startButton}
                onPress={onComplete}
                activeOpacity={0.8}
              >
                <Text style={styles.startButtonText}>Start Exploring</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const BRAND_BLUE = '#3B3BDE';

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  container: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },

  // Logo
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  logoIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: BRAND_BLUE,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  logoIconText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  logoText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A2E',
    letterSpacing: 0.3,
  },

  // Progress
  progressContainer: {
    marginBottom: 20,
  },
  stepLabel: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 8,
    fontWeight: '500',
  },
  progressBarRow: {
    flexDirection: 'row',
  },
  progressSegment: {
    flex: 1,
    height: 5,
    borderRadius: 10,
  },
  progressSegmentActive: {
    backgroundColor: BRAND_BLUE,
  },
  progressSegmentInactive: {
    backgroundColor: '#D1D5DB',
  },

  // Card
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 5,
    marginBottom: 20,
    alignItems: 'center',
  },

  // Success Icon
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  checkmark: {
    fontSize: 40,
    color: '#10B981',
    fontWeight: '800',
  },

  // Loading Container
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 16,
    fontWeight: '600',
  },

  // Heading
  heading: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1A1A2E',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 28,
    fontWeight: '500',
  },

  // Feature List
  featureList: {
    width: '100%',
    marginBottom: 32,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureBullet: {
    fontSize: 18,
    color: BRAND_BLUE,
    fontWeight: '700',
    marginRight: 12,
  },
  featureText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
    flex: 1,
  },

  // Button
  startButton: {
    height: 50,
    borderRadius: 25,
    backgroundColor: BRAND_BLUE,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    shadowColor: BRAND_BLUE,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  startButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
});
