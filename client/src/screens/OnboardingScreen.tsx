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
  ActivityIndicator
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../store/useAuthStore';
import { celebrate } from '../store/useCelebrationStore';

import { createStyles, useTheme } from '../theme';
const INCOME_TYPES = [
  { id: 'salaried', label: 'Salaried' },
  { id: 'freelancer', label: 'Freelance' },
  { id: 'business', label: 'Business' },
  { id: 'gig', label: 'Gig Economy' },
  { id: 'student', label: 'Student' },
];

export function OnboardingScreen(): React.ReactElement {
  const { c } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { user, completeOnboarding, loading, authError } = useAuthStore();
  const [submitting, setSubmitting] = useState(false);

  const [age, setAge] = useState(user?.age ? String(user.age) : '');
  const [income, setIncome] = useState(user?.income || user?.monthlyIncome ? String(user.income || user.monthlyIncome) : '');
  const [retirementAge, setRetirementAge] = useState(user?.retirementAge ? String(user.retirementAge) : '60');
  const [retirementCorpusGoal, setRetirementCorpusGoal] = useState(user?.retirementCorpusGoal ? String(user.retirementCorpusGoal) : '');
  const [currentBalance, setCurrentBalance] = useState(user?.currentBalance ? String(user.currentBalance) : '');
  const [incomeType, setIncomeType] = useState(user?.incomeType || 'salaried');

  const [focusedField, setFocusedField] = useState<string | null>(null);

  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const ok = await completeOnboarding({
        age: Number(age) || 25,
        income: Number(income) || 0,
        monthlyIncome: Number(income) || 0,
        incomeType,
        retirementAge: Number(retirementAge) || 60,
        retirementCorpusGoal: Number(retirementCorpusGoal) || 0,
        currentBalance: Number(currentBalance) || 0
      });
      if (ok) celebrate({ kind: 'confetti', title: "You're all set!", subtitle: 'Your financial pulse is ready. Explore your dashboard.' });
    } catch (error) {
      console.error('Error submitting onboarding:', error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.rootContainer, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.headerContainer}>
            <Text style={styles.badgeText}>FINAURA ONBOARDING</Text>
            <Text style={styles.title}>Set Up Your Financial Profile</Text>
            <Text style={styles.subtitle}>
              Personalize your financial wellness index, goal tracking, and retirement forecast.
            </Text>
          </View>

          {authError ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>{authError}</Text>
            </View>
          ) : null}

          {/* Section 1: Basic Financial Details */}
          <View style={styles.card}>
            <Text style={styles.sectionHeader}>Personal & Income Details</Text>

            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.label}>Current Age</Text>
                <TextInput
                  style={[styles.input, focusedField === 'age' && styles.inputFocused]}
                  placeholder="e.g. 26"
                  placeholderTextColor={c.textSubtle}
                  keyboardType="number-pad"
                  value={age}
                  onChangeText={setAge}
                  onFocus={() => setFocusedField('age')}
                  onBlur={() => setFocusedField(null)}
                />
              </View>

              <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                <Text style={styles.label}>Target Retirement Age</Text>
                <TextInput
                  style={[styles.input, focusedField === 'retirementAge' && styles.inputFocused]}
                  placeholder="e.g. 60"
                  placeholderTextColor={c.textSubtle}
                  keyboardType="number-pad"
                  value={retirementAge}
                  onChangeText={setRetirementAge}
                  onFocus={() => setFocusedField('retirementAge')}
                  onBlur={() => setFocusedField(null)}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Monthly Income (₹)</Text>
              <TextInput
                style={[styles.input, focusedField === 'income' && styles.inputFocused]}
                placeholder="e.g. 85000"
                placeholderTextColor={c.textSubtle}
                keyboardType="number-pad"
                value={income}
                onChangeText={setIncome}
                onFocus={() => setFocusedField('income')}
                onBlur={() => setFocusedField(null)}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Income Rhythm / Source</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                {INCOME_TYPES.map((type) => (
                  <TouchableOpacity
                    key={type.id}
                    style={[styles.chip, incomeType === type.id && styles.chipActive]}
                    onPress={() => setIncomeType(type.id)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.chipText, incomeType === type.id && styles.chipTextActive]}>
                      {type.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>

          {/* Section 2: Wealth & Corpus Goals */}
          <View style={styles.card}>
            <Text style={styles.sectionHeader}>Wealth & Corpus Targets</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Current Net Savings / Liquid Balance (₹)</Text>
              <TextInput
                style={[styles.input, focusedField === 'currentBalance' && styles.inputFocused]}
                placeholder="e.g. 150000"
                placeholderTextColor={c.textSubtle}
                keyboardType="number-pad"
                value={currentBalance}
                onChangeText={setCurrentBalance}
                onFocus={() => setFocusedField('currentBalance')}
                onBlur={() => setFocusedField(null)}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Retirement Corpus Goal (₹)</Text>
              <TextInput
                style={[styles.input, focusedField === 'corpus' && styles.inputFocused]}
                placeholder="e.g. 20000000 (2 Crore)"
                placeholderTextColor={c.textSubtle}
                keyboardType="number-pad"
                value={retirementCorpusGoal}
                onChangeText={setRetirementCorpusGoal}
                onFocus={() => setFocusedField('corpus')}
                onBlur={() => setFocusedField(null)}
              />
            </View>
          </View>

          {/* Action Button */}
          <TouchableOpacity
            style={styles.submitBtn}
            onPress={submit}
            disabled={submitting || loading}
            activeOpacity={0.8}
          >
            {submitting || loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitBtnText}>Complete Setup & Enter FINAURA →</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const useStyles = createStyles((c) => ({
  rootContainer: {
    flex: 1,
    backgroundColor: c.surfaceAlt,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: 40,
  },
  headerContainer: {
    marginBottom: 20,
    marginTop: 8,
  },
  badgeText: {
    color: c.primary,
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 1,
    marginBottom: 6,
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    color: c.text,
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: c.textMuted,
    lineHeight: 20,
  },
  errorBanner: {
    backgroundColor: c.dangerSoft,
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  errorBannerText: {
    color: c.dangerStrong,
    fontSize: 13,
    fontWeight: '600',
  },
  card: {
    backgroundColor: c.surface,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: c.border,
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: '800',
    color: c.text,
    marginBottom: 4,
  },
  sectionSub: {
    fontSize: 12,
    color: c.textMuted,
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
  },
  inputGroup: {
    marginBottom: 14,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: c.textMuted,
    marginBottom: 6,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 14,
    color: c.text,
    backgroundColor: c.bg,
  },
  inputFocused: {
    borderColor: c.primary,
    backgroundColor: c.surface,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: c.surfaceAlt,
    borderWidth: 1,
    borderColor: c.border,
  },
  chipActive: {
    backgroundColor: c.primarySoft,
    borderColor: c.primary,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: c.textMuted,
  },
  chipTextActive: {
    color: c.primary,
  },
  submitBtn: {
    backgroundColor: c.primary,
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
}));
