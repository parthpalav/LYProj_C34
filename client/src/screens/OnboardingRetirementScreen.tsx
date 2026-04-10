import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useOnboardingStore } from '../store/onboardingContext';

const TOTAL_STEPS = 5;
const CURRENT_STEP = 3;

interface Props {
  onNext?: () => void;
}

export function OnboardingRetirementScreen({ onNext }: Props): React.ReactElement {
  const [retirementAge, setRetirementAge] = useState('65');
  const [error, setError] = useState('');
  const setRetirementAgeStore = useOnboardingStore((state) => state.setRetirementAge);

  const handleContinue = () => {
    const age = parseInt(retirementAge, 10);
    
    if (!retirementAge.trim()) {
      setError('Please enter your retirement age');
      return;
    }
    
    if (isNaN(age)) {
      setError('Please enter a valid number');
      return;
    }
    
    if (age < 40) {
      setError('Retirement age must be at least 40');
      return;
    }
    
    if (age > 100) {
      setError('Retirement age cannot exceed 100');
      return;
    }

    setError('');
    setRetirementAgeStore(age);
    onNext?.();
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
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
            {/* Heading */}
            <Text style={styles.heading}>When would you like to{'\n'}retire?</Text>
            <Text style={styles.subtitle}>Enter your expected retirement age</Text>

            {/* Input */}
            <View style={styles.inputContainer}>
              <TextInput
                style={[styles.input, error && styles.inputError]}
                placeholder="65"
                placeholderTextColor="#D1D5DB"
                keyboardType="number-pad"
                value={retirementAge}
                onChangeText={(text) => {
                  setRetirementAge(text);
                  if (error) setError('');
                }}
                maxLength={3}
              />
            </View>

            {/* Error Message */}
            {error && <Text style={styles.errorText}>{error}</Text>}

            {/* Hint */}
            <Text style={styles.hint}>Must be between 40 and 100 years old</Text>

            {/* Continue Button */}
            <TouchableOpacity
              style={styles.continueButton}
              onPress={handleContinue}
              activeOpacity={0.8}
            >
              <Text style={styles.continueButtonText}>Continue</Text>
            </TouchableOpacity>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const BRAND_BLUE = '#3B3BDE';

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  flex: {
    flex: 1,
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
  },
  heading: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1A1A2E',
    textAlign: 'center',
    lineHeight: 32,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 28,
    fontWeight: '500',
  },

  // Input
  inputContainer: {
    marginBottom: 12,
  },
  input: {
    height: 56,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    paddingHorizontal: 16,
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A2E',
    textAlign: 'center',
    backgroundColor: '#F9FAFB',
  },
  inputError: {
    borderColor: '#EF4444',
    backgroundColor: '#FEE2E2',
  },

  // Error
  errorText: {
    fontSize: 13,
    color: '#EF4444',
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },

  // Hint
  hint: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 28,
    fontWeight: '500',
  },

  // Button
  continueButton: {
    height: 50,
    borderRadius: 25,
    backgroundColor: BRAND_BLUE,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: BRAND_BLUE,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  continueButtonDisabled: {
    backgroundColor: '#D1D5DB',
    shadowOpacity: 0,
    elevation: 0,
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
});
