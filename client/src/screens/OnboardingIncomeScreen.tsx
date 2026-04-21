import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useOnboardingStore } from '../store/onboardingContext';

const TOTAL_STEPS = 5;
const CURRENT_STEP = 4;

interface Props {
  onNext?: () => void;
}

export function OnboardingIncomeScreen({ onNext }: Props): React.ReactElement {
  const [monthlyIncome, setMonthlyIncome] = useState('50000');
  const [error, setError] = useState('');
  const setMonthlyIncomeStore = useOnboardingStore((state) => state.setMonthlyIncome);

  const handleContinue = () => {
    const income = parseFloat(monthlyIncome);

    if (!monthlyIncome.trim()) {
      setError('Please enter your monthly income');
      return;
    }

    if (Number.isNaN(income)) {
      setError('Please enter a valid number');
      return;
    }

    if (income < 0) {
      setError('Monthly income must be a positive number');
      return;
    }

    setError('');
    setMonthlyIncomeStore(income);
    onNext?.();
  };

  const formatIncomeDisplay = (value: string) => {
    const num = parseFloat(value);
    if (!num || Number.isNaN(num)) return '₹0';
    return `₹${num.toLocaleString('en-IN')}`;
  };

  return (
    <SafeAreaView style={styles.safe}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView style={styles.container} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={styles.logoRow}>
            <View style={styles.logoIcon}>
              <Text style={styles.logoIconText}>⟡</Text>
            </View>
            <Text style={styles.logoText}>Finaura</Text>
          </View>

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

          <View style={styles.card}>
            <Text style={styles.heading}>What's your{'\n'}monthly income?</Text>
            <Text style={styles.subtitle}>This helps us tailor your budget strategies</Text>

            <View style={styles.displayBox}>
              <Text style={styles.displayValue}>{formatIncomeDisplay(monthlyIncome)}</Text>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Enter amount</Text>
              <View style={styles.inputWrapper}>
                <Text style={styles.currencySymbol}>₹</Text>
                <TextInput
                  style={[styles.input, error && styles.inputError]}
                  placeholder="50000"
                  placeholderTextColor="#D1D5DB"
                  keyboardType="decimal-pad"
                  value={monthlyIncome}
                  onChangeText={(text) => {
                    setMonthlyIncome(text);
                    if (error) setError('');
                  }}
                />
              </View>
            </View>

            {error && <Text style={styles.errorText}>{error}</Text>}

            <Text style={styles.hint}>Enter your expected net monthly income</Text>

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
      </TouchableWithoutFeedback>
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
    marginBottom: 24,
    fontWeight: '500',
  },
  displayBox: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    alignItems: 'center',
  },
  displayValue: {
    fontSize: 32,
    fontWeight: '800',
    color: BRAND_BLUE,
  },
  inputContainer: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
    backgroundColor: '#F9FAFB',
  },
  currencySymbol: {
    fontSize: 18,
    fontWeight: '700',
    color: BRAND_BLUE,
    marginRight: 4,
  },
  input: {
    flex: 1,
    height: 56,
    paddingHorizontal: 8,
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A2E',
  },
  inputError: {
    borderColor: '#EF4444',
    backgroundColor: '#FEE2E2',
  },
  errorText: {
    fontSize: 13,
    color: '#EF4444',
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  hint: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 28,
    fontWeight: '500',
  },
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
  continueButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
});
