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

const INCOME_TYPES = [
  { id: 'salaried', label: 'Salaried' },
  { id: 'freelancer', label: 'Freelance' },
  { id: 'business', label: 'Business' },
  { id: 'gig', label: 'Gig Economy' },
  { id: 'student', label: 'Student' },
];

export function OnboardingScreen(): React.ReactElement {
  const insets = useSafeAreaInsets();
  const { completeOnboarding } = useAuthStore();
  const [submitting, setSubmitting] = useState(false);

  const [age, setAge] = useState('');
  const [income, setIncome] = useState('');
  const [retirementAge, setRetirementAge] = useState('');
  const [retirementCorpusGoal, setRetirementCorpusGoal] = useState('');
  const [currentBalance, setCurrentBalance] = useState('');
  const [incomeType, setIncomeType] = useState('salaried');
  const [rent, setRent] = useState('');
  const [emi, setEmi] = useState('');
  const [bills, setBills] = useState('');
  const [family, setFamily] = useState('');

  const [focusedField, setFocusedField] = useState<string | null>(null);

  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const fixedObligations = [
        { label: 'Rent', amount: Number(rent || 0) },
        { label: 'EMI', amount: Number(emi || 0) },
        { label: 'Bills', amount: Number(bills || 0) },
        { label: 'Family', amount: Number(family || 0) },
      ].filter((o) => o.amount > 0);

      await completeOnboarding({
        age: Number(age),
        income: Number(income),
        incomeType,
        retirementAge: Number(retirementAge),
        retirementCorpusGoal: Number(retirementCorpusGoal),
        currentBalance: Number(currentBalance),
        fixedObligations
      });
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
              Help us personalize your financial intelligence dashboard and corpus goal tracking.
            </Text>
          </View>

          {/* Section 1: Basic Financial Details */}
          <View style={styles.card}>
            <Text style={styles.sectionHeader}>Personal & Financial Info</Text>

            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.label}>Current Age</Text>
                <TextInput
                  style={[styles.input, focusedField === 'age' && styles.inputFocused]}
                  placeholder="e.g. 26"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="number-pad"
                  value={age}
                  onChangeText={setAge}
                  onFocus={() => setFocusedField('age')}
                  onBlur={() => setFocusedField(null)}
                />
              </View>

              <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                <Text style={styles.label}>Retirement Age</Text>
                <TextInput
                  style={[styles.input, focusedField === 'retirementAge' && styles.inputFocused]}
                  placeholder="e.g. 60"
                  placeholderTextColor="#9CA3AF"
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
                placeholderTextColor="#9CA3AF"
                keyboardType="number-pad"
                value={income}
                onChangeText={setIncome}
                onFocus={() => setFocusedField('income')}
                onBlur={() => setFocusedField(null)}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Current Liquid Balance (₹)</Text>
              <TextInput
                style={[styles.input, focusedField === 'currentBalance' && styles.inputFocused]}
                placeholder="e.g. 150000"
                placeholderTextColor="#9CA3AF"
                keyboardType="number-pad"
                value={currentBalance}
                onChangeText={setCurrentBalance}
                onFocus={() => setFocusedField('currentBalance')}
                onBlur={() => setFocusedField(null)}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Desired Retirement Corpus Goal (₹)</Text>
              <TextInput
                style={[styles.input, focusedField === 'retirementCorpusGoal' && styles.inputFocused]}
                placeholder="e.g. 50000000"
                placeholderTextColor="#9CA3AF"
                keyboardType="number-pad"
                value={retirementCorpusGoal}
                onChangeText={setRetirementCorpusGoal}
                onFocus={() => setFocusedField('retirementCorpusGoal')}
                onBlur={() => setFocusedField(null)}
              />
            </View>

            {/* Income Type Selector */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Employment / Income Type</Text>
              <View style={styles.pillContainer}>
                {INCOME_TYPES.map((type) => {
                  const isSelected = incomeType.toLowerCase() === type.id;
                  return (
                    <TouchableOpacity
                      key={type.id}
                      style={[styles.pill, isSelected && styles.pillSelected]}
                      onPress={() => setIncomeType(type.id)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.pillText, isSelected && styles.pillTextSelected]}>
                        {type.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>

          {/* Section 2: Fixed Monthly Obligations */}
          <View style={styles.card}>
            <Text style={styles.sectionHeader}>Fixed Monthly Obligations (₹)</Text>
            <Text style={styles.sectionSubtitle}>
              Estimate recurring fixed expenses to calculate your net savings capacity.
            </Text>

            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.label}>Rent / Housing</Text>
                <TextInput
                  style={[styles.input, focusedField === 'rent' && styles.inputFocused]}
                  placeholder="0"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="number-pad"
                  value={rent}
                  onChangeText={setRent}
                  onFocus={() => setFocusedField('rent')}
                  onBlur={() => setFocusedField(null)}
                />
              </View>

              <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                <Text style={styles.label}>Loans / EMIs</Text>
                <TextInput
                  style={[styles.input, focusedField === 'emi' && styles.inputFocused]}
                  placeholder="0"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="number-pad"
                  value={emi}
                  onChangeText={setEmi}
                  onFocus={() => setFocusedField('emi')}
                  onBlur={() => setFocusedField(null)}
                />
              </View>
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.label}>Bills & Utilities</Text>
                <TextInput
                  style={[styles.input, focusedField === 'bills' && styles.inputFocused]}
                  placeholder="0"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="number-pad"
                  value={bills}
                  onChangeText={setBills}
                  onFocus={() => setFocusedField('bills')}
                  onBlur={() => setFocusedField(null)}
                />
              </View>

              <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                <Text style={styles.label}>Family Support</Text>
                <TextInput
                  style={[styles.input, focusedField === 'family' && styles.inputFocused]}
                  placeholder="0"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="number-pad"
                  value={family}
                  onChangeText={setFamily}
                  onFocus={() => setFocusedField('family')}
                  onBlur={() => setFocusedField(null)}
                />
              </View>
            </View>
          </View>

          {/* Submit Action */}
          <TouchableOpacity
            style={[styles.btn, submitting && styles.btnDisabled]}
            onPress={submit}
            disabled={submitting}
            activeOpacity={0.8}
          >
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.btnText}>Complete Profile Setup →</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerContainer: {
    marginBottom: 20,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#2563EB',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  inputGroup: {
    marginBottom: 14,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  input: {
    height: 48,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 15,
    color: '#111827',
  },
  inputFocused: {
    borderColor: '#2563EB',
    backgroundColor: '#FFFFFF',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 1,
  },
  pillContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  pillSelected: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  pillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4B5563',
  },
  pillTextSelected: {
    color: '#FFFFFF',
  },
  btn: {
    height: 52,
    backgroundColor: '#2563EB',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 24,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  btnDisabled: {
    backgroundColor: '#93C5FD',
  },
  btnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
