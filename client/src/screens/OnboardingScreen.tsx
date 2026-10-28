import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, { FadeInRight, FadeInLeft, FadeOutLeft, FadeOutRight, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../store/useAuthStore';
import { celebrate } from '../store/useCelebrationStore';
import { createStyles, radius, typeScale, useTheme } from '../theme';
import { duration, timing } from '../motion';
import { AuroraBackground } from '../components/ui/AuroraBackground';
import { Button } from '../components/ui/Button';
import { Chip } from '../components/ui/Bits';
import { Field } from '../components/ui/Field';

const INCOME_TYPES = [
  { id: 'salaried', label: 'Salaried' },
  { id: 'freelancer', label: 'Freelance' },
  { id: 'business', label: 'Business' },
  { id: 'gig', label: 'Gig Economy' },
  { id: 'student', label: 'Student' },
];

const STEPS = [
  { title: 'About you', subtitle: 'So FINAURA can plan around your stage of life.' },
  { title: 'Your income', subtitle: 'A monthly baseline. You can log actual receipts later.' },
  { title: 'Where you are', subtitle: 'The money you can reach today, across bank accounts.' },
  { title: "Where you're headed", subtitle: 'Your retirement target shapes forecasts and your FMI score.' },
];

const num = (v: string) => (v.trim() === '' ? NaN : Number(v));

function Dot({ active, done }: { active: boolean; done: boolean }) {
  const styles = useStyles();
  const t = timing(duration.base); // built on the JS thread; motion helpers aren't worklets
  const style = useAnimatedStyle(() => ({
    width: withTiming(active ? 22 : 8, t),
    opacity: withTiming(active || done ? 1 : 0.4, t),
  }));
  return <Animated.View style={[styles.dot, style]} />;
}

export function OnboardingScreen(): React.ReactElement {
  const { isDark } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const completeOnboarding = useAuthStore((s) => s.completeOnboarding);
  const authError = useAuthStore((s) => s.authError);
  const logout = useAuthStore((s) => s.logout);

  const [step, setStep] = useState(0);
  const [forward, setForward] = useState(true);
  const [error, setError] = useState('');

  const [age, setAge] = useState(user?.age ? String(user.age) : '');
  const [incomeType, setIncomeType] = useState(user?.incomeType || 'salaried');
  const [income, setIncome] = useState(user?.income || user?.monthlyIncome ? String(user.income || user.monthlyIncome) : '');
  const [currentBalance, setCurrentBalance] = useState(user?.currentBalance ? String(user.currentBalance) : '');
  const [retirementAge, setRetirementAge] = useState(user?.retirementAge ? String(user.retirementAge) : '60');
  const [retirementCorpusGoal, setRetirementCorpusGoal] = useState(user?.retirementCorpusGoal ? String(user.retirementCorpusGoal) : '');

  /** The first problem on the current step, in plain words; empty when the step is complete. */
  const problem = (): string => {
    if (step === 0) {
      const a = num(age);
      if (!Number.isInteger(a) || a < 16 || a > 100) return 'Enter your age in years (16 to 100).';
    }
    if (step === 1 && (!(num(income) >= 0))) return 'Enter your usual monthly income. Use 0 if you have none right now.';
    if (step === 2 && (!(num(currentBalance) >= 0))) return 'Enter the money you can reach today. Use 0 if none.';
    if (step === 3) {
      const r = num(retirementAge);
      if (!Number.isInteger(r) || r <= num(age) || r > 100) return `Retirement age must be after your current age (${age}) and at most 100.`;
      if (retirementCorpusGoal.trim() && !(num(retirementCorpusGoal) >= 0)) return 'Corpus goal must be zero or more, or left blank.';
    }
    return '';
  };

  const go = (next: number) => {
    setError('');
    setForward(next > step);
    setStep(next);
  };

  const submit = async () => {
    const ok = await completeOnboarding({
      age: num(age),
      income: num(income),
      monthlyIncome: num(income),
      incomeType,
      retirementAge: num(retirementAge),
      retirementCorpusGoal: num(retirementCorpusGoal) || 0,
      currentBalance: num(currentBalance),
    });
    if (ok) celebrate({ kind: 'confetti', title: "You're all set!", subtitle: 'Your financial pulse is ready. Explore your dashboard.' });
  };

  const next = async () => {
    const p = problem();
    if (p) return setError(p);
    if (step < STEPS.length - 1) return go(step + 1);
    await submit();
  };

  const fields = [
    <>
      <Field label="Age" icon="person-outline" value={age} onChangeText={(v) => { setAge(v.replace(/[^0-9]/g, '')); setError(''); }} keyboardType="number-pad" placeholder="e.g. 27" autoFocus />
      <Text style={styles.label}>How do you earn?</Text>
      <View style={styles.chips}>
        {INCOME_TYPES.map((t) => <Chip key={t.id} label={t.label} selected={incomeType === t.id} onPress={() => setIncomeType(t.id)} />)}
      </View>
    </>,
    <Field label="Monthly income (₹)" icon="cash-outline" value={income} onChangeText={(v) => { setIncome(v.replace(/[^0-9.]/g, '')); setError(''); }} keyboardType="numeric" placeholder="e.g. 85000" hint="Take-home, after tax." autoFocus />,
    <Field label="Current liquid balance (₹)" icon="wallet-outline" value={currentBalance} onChangeText={(v) => { setCurrentBalance(v.replace(/[^0-9.]/g, '')); setError(''); }} keyboardType="numeric" placeholder="e.g. 120000" hint="Savings and current accounts. Investments come later, under Assets." autoFocus />,
    <>
      <Field label="Target retirement age" icon="hourglass-outline" value={retirementAge} onChangeText={(v) => { setRetirementAge(v.replace(/[^0-9]/g, '')); setError(''); }} keyboardType="number-pad" />
      <Field label="Retirement corpus goal (₹)" icon="trophy-outline" value={retirementCorpusGoal} onChangeText={(v) => { setRetirementCorpusGoal(v.replace(/[^0-9.]/g, '')); setError(''); }} keyboardType="numeric" placeholder="Optional" hint="Leave blank and FINAURA will estimate one from your spending." />
    </>,
  ];

  return (
    <View style={styles.root}>
      <AuroraBackground />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
          <View style={styles.topRow}>
            <Text style={styles.kicker}>Step {step + 1} of {STEPS.length}</Text>
            <View style={styles.dots}>
              {STEPS.map((_, i) => <Dot key={i} active={i === step} done={i < step} />)}
            </View>
          </View>

          <Animated.View key={step} entering={(forward ? FadeInRight : FadeInLeft).duration(duration.slow)} exiting={(forward ? FadeOutLeft : FadeOutRight).duration(duration.fast)}>
            <Text style={styles.title}>{STEPS[step].title}</Text>
            <Text style={styles.subtitle}>{STEPS[step].subtitle}</Text>

            <BlurView intensity={isDark ? 40 : 70} tint={isDark ? 'dark' : 'light'} style={styles.card}>
              {fields[step]}
              {!!(error || authError) && <Text style={styles.error} accessibilityRole="alert">{error || authError}</Text>}
              <View style={styles.actions}>
                {step > 0 && <Button label="Back" variant="secondary" onPress={() => go(step - 1)} style={styles.back} />}
                <Button label={step === STEPS.length - 1 ? 'Finish setup' : 'Continue'} onPress={next} style={styles.flex} />
              </View>
            </BlurView>
          </Animated.View>

          {step === 0 && (
            <Pressable onPress={() => logout()} style={styles.signOut} accessibilityRole="button">
              <Text style={styles.signOutText}>Not {user?.name?.split(' ')[0] ?? 'you'}? Sign out</Text>
            </Pressable>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const useStyles = createStyles((c) => ({
  root: { flex: 1, backgroundColor: c.aurora[0] },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 20 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  kicker: { ...typeScale.overline, color: c.onAuroraMuted },
  dots: { flexDirection: 'row', gap: 6 },
  dot: { height: 8, borderRadius: 4, backgroundColor: c.onAurora },
  title: { ...typeScale.display, color: c.onAurora },
  subtitle: { ...typeScale.body, color: c.onAuroraMuted, marginTop: 8, marginBottom: 24 },
  card: {
    borderRadius: radius.xl,
    overflow: 'hidden',
    padding: 20,
    backgroundColor: c.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.glassBorder,
  },
  label: { fontSize: 13, fontWeight: '600', color: c.textMuted, marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  error: { fontSize: 13, color: c.danger, marginTop: 4, marginBottom: 4 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  back: { width: 96 },
  signOut: { alignSelf: 'center', marginTop: 20, padding: 8 },
  signOutText: { ...typeScale.label, color: c.onAuroraMuted },
}));
