import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { runScenario } from '../../services/api';
import { PredictabilitySnapshot } from '../../types';
import { createStyles, radius, tabular, typeScale, useTheme } from '../../theme';
import { formatCurrency } from '../../utils/format';
import { Card } from '../ui/Card';
import { Ring } from '../ui/Charts';

type Knob = {
  key: 'monthly' | 'age' | 'ret';
  label: string;
  value: number;
  step: number;
  min: number;
  max: number;
  format: (v: number) => string;
};

const prob = (s: PredictabilitySnapshot | null) => s?.probabilistic?.estimatedFire?.probabilityFundedAtTargetAge ?? null;

/**
 * Nudge monthly investing, retirement age and expected return, and see the modeled odds move.
 * Each change re-runs the server simulation (debounced); nothing is saved to the profile.
 */
export function WhatIfLab({ baseline }: { baseline: PredictabilitySnapshot }) {
  const styles = useStyles();
  const { c } = useTheme();
  const base = {
    monthly: Math.round(baseline.retirement?.monthlyContributionUsed ?? 0),
    age: baseline.retirement?.retirementAge ?? 60,
    ret: Math.round((baseline.retirement?.assumptions?.nominalReturn ?? 0.08) * 1000) / 10,
  };
  const [values, setValues] = useState(base);
  const [result, setResult] = useState<PredictabilitySnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const changed = values.monthly !== base.monthly || values.age !== base.age || values.ret !== base.ret;
  const currentAge = baseline.retirement?.currentAge ?? 18;

  useEffect(() => {
    if (!changed) {
      setResult(null);
      setError('');
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setBusy(true);
      setError('');
      try {
        setResult(await runScenario({ monthlyContribution: values.monthly, retirementAge: values.age, expectedReturnRate: values.ret / 100 }));
      } catch (e: any) {
        setError(e?.response?.status === 429 ? 'Too many changes at once. Wait a moment.' : e?.response?.data?.error || "Couldn't run that scenario.");
      } finally {
        setBusy(false);
      }
    }, 700);
    return () => { if (timer.current) clearTimeout(timer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.monthly, values.age, values.ret]);

  const knobs: Knob[] = [
    { key: 'monthly', label: 'Invest each month', value: values.monthly, step: 2500, min: 0, max: 10_000_000, format: formatCurrency },
    { key: 'age', label: 'Retire at', value: values.age, step: 1, min: Math.max(40, currentAge + 1), max: 100, format: (v) => `${v}` },
    { key: 'ret', label: 'Expected return', value: values.ret, step: 0.5, min: 0, max: 20, format: (v) => `${v.toFixed(1)}%` },
  ];

  const nudge = (k: Knob, dir: 1 | -1) => {
    const next = Math.min(k.max, Math.max(k.min, Math.round((k.value + dir * k.step) * 10) / 10));
    if (next === k.value) return;
    Haptics.selectionAsync().catch(() => {});
    setValues((v) => ({ ...v, [k.key]: next }));
  };

  const baseProb = prob(baseline);
  const shown = changed ? prob(result) : baseProb;
  const delta = changed && shown !== null && baseProb !== null ? Math.round((shown - baseProb) * 100) : null;
  const corpus = (changed ? result : baseline)?.retirement?.projectedCorpusAtRetirement ?? null;

  return (
    <Card style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.title}>What if…</Text>
        {changed && (
          <Pressable onPress={() => setValues(base)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Reset what-if values">
            <Text style={styles.reset}>Reset</Text>
          </Pressable>
        )}
      </View>
      <Text style={styles.sub}>Try changes without touching your plan.</Text>

      <View style={styles.result}>
        <Ring progress={shown ?? 0} size={92} stroke={10} color={shown !== null && shown >= 0.75 ? c.success : c.warning}>
          {busy ? <ActivityIndicator color={c.primary} /> : <Text style={styles.prob}>{shown === null ? '—' : `${Math.round(shown * 100)}%`}</Text>}
        </Ring>
        <View style={styles.flex}>
          <Text style={styles.resultLabel}>Chance of a fully funded retirement</Text>
          {delta !== null && !busy && (
            <Text style={[styles.delta, { color: delta >= 0 ? c.successStrong : c.dangerStrong }]}>
              {delta >= 0 ? '▲' : '▼'} {Math.abs(delta)} points vs your plan
            </Text>
          )}
          {corpus !== null && <Text style={styles.corpus}>Projected corpus {formatCurrency(corpus)}</Text>}
          {!!error && <Text style={styles.error}>{error}</Text>}
        </View>
      </View>

      {knobs.map((k) => (
        <View key={k.key} style={styles.knob}>
          <Text style={styles.knobLabel}>{k.label}</Text>
          <View style={styles.stepper}>
            <Pressable onPress={() => nudge(k, -1)} style={styles.stepBtn} accessibilityRole="button" accessibilityLabel={`Decrease ${k.label}`}>
              <Ionicons name="remove" size={18} color={c.text} />
            </Pressable>
            <Text style={styles.knobValue} accessibilityLiveRegion="polite">{k.format(k.value)}</Text>
            <Pressable onPress={() => nudge(k, 1)} style={styles.stepBtn} accessibilityRole="button" accessibilityLabel={`Increase ${k.label}`}>
              <Ionicons name="add" size={18} color={c.text} />
            </Pressable>
          </View>
        </View>
      ))}
    </Card>
  );
}

const useStyles = createStyles((c) => ({
  card: { marginBottom: 16 },
  flex: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { ...typeScale.headline, color: c.text },
  reset: { ...typeScale.label, color: c.primary },
  sub: { ...typeScale.caption, color: c.textMuted, marginTop: 2 },
  result: { flexDirection: 'row', alignItems: 'center', gap: 16, marginVertical: 16 },
  prob: { fontSize: 20, fontWeight: '800', color: c.text, ...tabular },
  resultLabel: { fontSize: 14, fontWeight: '600', color: c.text },
  delta: { fontSize: 13, fontWeight: '700', marginTop: 4 },
  corpus: { ...typeScale.caption, color: c.textMuted, marginTop: 4 },
  error: { ...typeScale.caption, color: c.danger, marginTop: 4 },
  knob: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, borderTopWidth: 1, borderTopColor: c.border },
  knobLabel: { fontSize: 14, color: c.textMuted },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surfaceAlt },
  knobValue: { minWidth: 92, textAlign: 'center', fontSize: 15, fontWeight: '700', color: c.text, ...tabular },
}));
