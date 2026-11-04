import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getBehaviorPatterns, getDashboard, getHeatmap, getPacing, getTransactions } from '../services/api';
import { BehaviorPattern, Transaction } from '../types';
import { createStyles, tabular, typeScale, useTheme } from '../theme';
import { enterUp } from '../motion';
import { formatCurrency } from '../utils/format';
import { AnimatedBar } from '../components/motion/AnimatedBar';
import { Card } from '../components/ui/Card';
import { EmptyState, IconTile, SectionHeader } from '../components/ui/Bits';
import { Donut } from '../components/ui/Charts';
import { LargeTitle, ScreenHeader, useHeaderHeight, useScrollHeader } from '../components/ui/ScreenHeader';

type Pacing = Awaited<ReturnType<typeof getPacing>>;
const WEEKS = 12;
const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Where the money goes and how habits look: budget pace, categories, a spending calendar, patterns and outliers. */
export function InsightsScreen() {
  const { c } = useTheme();
  const s = useStyles();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { y, onScroll } = useScrollHeader();
  const [pacing, setPacing] = useState<Pacing | null>(null);
  const [categories, setCategories] = useState<Array<{ label: string; pct: number }>>([]);
  const [heat, setHeat] = useState<Record<string, number>>({});
  const [patterns, setPatterns] = useState<{ patterns: BehaviorPattern[]; analyzedCount: number } | null>(null);
  const [outliers, setOutliers] = useState<Transaction[]>([]);
  const [picked, setPicked] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [p, d, h, b, t] = await Promise.allSettled([getPacing(), getDashboard(), getHeatmap(), getBehaviorPatterns(), getTransactions()]);
    if (p.status === 'fulfilled') setPacing(p.value);
    if (d.status === 'fulfilled') setCategories((d.value.categoryBreakdown ?? []).filter((x) => x.pct > 0).sort((a, z) => z.pct - a.pct));
    if (h.status === 'fulfilled') setHeat(Object.fromEntries((h.value ?? []).map((x) => [x.date.slice(0, 10), x.totalAmount])));
    if (b.status === 'fulfilled') setPatterns(b.value);
    if (t.status === 'fulfilled') {
      setOutliers(t.value.filter((x) => x.isAnomaly).sort((a, z) => new Date(z.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 5));
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Last 12 weeks as columns of 7 days, ending this week.
  const grid = useMemo(() => {
    const today = new Date();
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + (6 - today.getDay()));
    return Array.from({ length: WEEKS }, (_, w) =>
      Array.from({ length: 7 }, (_, d) => {
        const date = new Date(end.getFullYear(), end.getMonth(), end.getDate() - (WEEKS - 1 - w) * 7 - (6 - d));
        return { key: dayKey(date), date, future: date > today };
      }));
  }, []);
  const maxDay = Math.max(1, ...grid.flat().map((g) => heat[g.key] ?? 0));
  const pickedDay = picked ? grid.flat().find((g) => g.key === picked) : null;

  const top = categories.slice(0, 6);
  const rest = categories.slice(6).reduce((sum, x) => sum + x.pct, 0);
  const slices = [...top, ...(rest > 0 ? [{ label: 'Other', pct: rest }] : [])];

  return (
    <View style={s.screen}>
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingTop: headerHeight, paddingBottom: insets.bottom + 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} progressViewOffset={headerHeight} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
      >
        <LargeTitle title="Insights" subtitle="Where your money goes, and the habits behind it" />
        <View style={s.body}>
          {pacing && (
            <Animated.View entering={enterUp(0)}>
              <SectionHeader title="This month vs 50/30/20" />
              <Card>
                {([['Needs', c.info], ['Wants', c.warning], ['Investments', c.success]] as const).map(([key, color], i) => {
                  const row = pacing[key];
                  const over = row.limit > 0 && row.actual > row.limit;
                  return (
                    <View key={key} style={[s.paceRow, i > 0 && s.paceGap]}>
                      <View style={s.paceTop}>
                        <Text style={s.paceLabel}>{key}</Text>
                        <Text style={[s.paceValue, over && { color: c.dangerStrong }]}>
                          {formatCurrency(row.actual)} <Text style={s.paceLimit}>of {formatCurrency(row.limit)}</Text>
                        </Text>
                      </View>
                      <AnimatedBar progress={row.limit > 0 ? row.actual / row.limit : 0} color={over ? c.danger : color} height={8} delay={i * 120} />
                      {over && <Text style={s.over}>Over by {formatCurrency(row.actual - row.limit)}</Text>}
                    </View>
                  );
                })}
              </Card>
            </Animated.View>
          )}

          <SectionHeader title="Where it goes" />
          <Card>
            {slices.length === 0 ? (
              <Text style={s.muted}>Log a few expenses to see your category mix.</Text>
            ) : (
              <View style={s.donutRow}>
                <Donut segments={slices.map((x, i) => ({ value: x.pct, color: c.chart[i % c.chart.length] }))} size={136} stroke={18}>
                  <Text style={s.donutTop}>{slices[0].pct}%</Text>
                  <Text style={s.donutSub} numberOfLines={1}>{slices[0].label}</Text>
                </Donut>
                <View style={s.flex}>
                  {slices.map((x, i) => (
                    <View key={x.label} style={s.legendRow}>
                      <View style={[s.dot, { backgroundColor: c.chart[i % c.chart.length] }]} />
                      <Text style={s.legendLabel} numberOfLines={1}>{x.label}</Text>
                      <Text style={s.legendPct}>{x.pct}%</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </Card>

          <SectionHeader title="Spending calendar" />
          <Card>
            <View style={s.heatWrap}>
              <View style={s.heatLetters}>
                {DAY_LETTERS.map((l, i) => <Text key={i} style={s.heatLetter}>{l}</Text>)}
              </View>
              {grid.map((week, w) => (
                <View key={w} style={s.heatCol}>
                  {week.map((d) => {
                    const amount = heat[d.key] ?? 0;
                    const level = amount > 0 ? 0.2 + 0.8 * Math.min(1, amount / maxDay) : 0;
                    return (
                      <Pressable
                        key={d.key}
                        disabled={d.future}
                        onPress={() => setPicked(d.key === picked ? null : d.key)}
                        style={[
                          s.heatCell,
                          { backgroundColor: d.future ? 'transparent' : level ? c.primary : c.surfaceAlt, opacity: level ? level : 1 },
                          picked === d.key && s.heatPicked,
                        ]}
                        accessibilityLabel={`${d.date.toDateString()}: ${formatCurrency(amount)}`}
                      />
                    );
                  })}
                </View>
              ))}
            </View>
            <Text style={s.heatCaption}>
              {pickedDay
                ? `${pickedDay.date.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}: ${formatCurrency(heat[pickedDay.key] ?? 0)}`
                : 'Last 12 weeks. Darker days cost more. Tap a day for the total.'}
            </Text>
          </Card>

          <SectionHeader title="Habits FINAURA noticed" />
          {patterns && patterns.patterns.length > 0 ? (
            patterns.patterns.map((p, i) => (
              <Card key={i} style={s.patternCard}>
                <Text style={s.patternEmoji}>{p.emoji}</Text>
                <View style={s.flex}>
                  <Text style={s.patternText}>{p.message}</Text>
                  <Text style={s.patternSub}>{p.severity === 'high' ? 'Worth a look' : 'Gentle heads-up'}</Text>
                </View>
              </Card>
            ))
          ) : (
            <Card><Text style={s.muted}>No risky patterns in your last {patterns?.analyzedCount ?? 50} transactions. Nice.</Text></Card>
          )}

          <SectionHeader title="Unusually large spends" action={outliers.length ? 'Activity' : undefined} onAction={() => navigation.navigate('Transactions')} />
          {outliers.length === 0 ? (
            <EmptyState emoji="🧘" title="Nothing unusual" message="Spends well above your typical amount show up here." />
          ) : (
            <Card padded={false} style={s.list}>
              {outliers.map((t, i) => (
                <View key={t.id} style={[s.outRow, i > 0 && s.divider]}>
                  <IconTile icon="trending-up" tint={c.danger} size={36} />
                  <View style={s.flex}>
                    <Text style={s.outTitle} numberOfLines={1}>{t.description || t.category}</Text>
                    <Text style={s.outSub}>{t.category} · {new Date(t.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</Text>
                  </View>
                  <Text style={s.outAmount}>{formatCurrency(Math.abs(t.amount))}</Text>
                </View>
              ))}
            </Card>
          )}
        </View>
      </Animated.ScrollView>
      <ScreenHeader title="Insights" y={y} onBack={() => navigation.goBack()} />
    </View>
  );
}

const useStyles = createStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.bg },
  flex: { flex: 1 },
  body: { paddingHorizontal: 16 },
  muted: { ...typeScale.body, color: c.textMuted },
  paceRow: { gap: 8 },
  paceGap: { marginTop: 16 },
  paceTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  paceLabel: { fontSize: 15, fontWeight: '600', color: c.text },
  paceValue: { fontSize: 15, fontWeight: '700', color: c.text, ...tabular },
  paceLimit: { fontSize: 12, fontWeight: '500', color: c.textSubtle },
  over: { fontSize: 12, fontWeight: '600', color: c.dangerStrong },
  donutRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  donutTop: { fontSize: 20, fontWeight: '800', color: c.text, ...tabular },
  donutSub: { fontSize: 10, color: c.textMuted, maxWidth: 80 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { flex: 1, fontSize: 13, color: c.text },
  legendPct: { fontSize: 13, fontWeight: '700', color: c.text, ...tabular },
  heatWrap: { flexDirection: 'row', gap: 4, justifyContent: 'center' },
  heatLetters: { gap: 4, marginRight: 2 },
  heatLetter: { height: 20, lineHeight: 20, fontSize: 10, color: c.textSubtle },
  heatCol: { gap: 4 },
  heatCell: { width: 20, height: 20, borderRadius: 5 },
  heatPicked: { borderWidth: 2, borderColor: c.text },
  heatCaption: { ...typeScale.caption, color: c.textMuted, marginTop: 12, textAlign: 'center' },
  patternCard: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 10 },
  patternEmoji: { fontSize: 28 },
  patternText: { fontSize: 15, fontWeight: '600', color: c.text },
  patternSub: { ...typeScale.caption, color: c.textMuted, marginTop: 2 },
  list: { paddingHorizontal: 14, paddingVertical: 4 },
  outRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
  outTitle: { fontSize: 15, fontWeight: '600', color: c.text },
  outSub: { fontSize: 12, color: c.textMuted, marginTop: 2 },
  outAmount: { fontSize: 15, fontWeight: '700', color: c.text, ...tabular },
}));

