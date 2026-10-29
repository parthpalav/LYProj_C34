import React, { useCallback, useMemo, useState } from 'react';
import { RefreshControl, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import Animated from 'react-native-reanimated';
import { ScrollView as GestureScrollView } from 'react-native-gesture-handler';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getTransactions } from '../services/api';
import { useStore } from '../store/useStore';
import { createStyles, radius, tabular, typeScale, useTheme } from '../theme';
import { enterUp } from '../motion';
import { formatCurrency } from '../utils/format';
import { Bucket, RangeKind, SpendType, buildSeries, bucketLabel, rangeFor, spanLabel, startOfDay } from '../utils/spending';
import { LargeTitle, ScreenHeader, useHeaderHeight, useScrollHeader } from '../components/ui/ScreenHeader';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { SpendChart } from '../components/ui/SpendChart';
import { Card } from '../components/ui/Card';
import { EmptyState, ErrorState, MoneyText } from '../components/ui/Bits';
import { Button } from '../components/ui/Button';
import { Sheet } from '../components/ui/Sheet';

const AnimatedScrollView = Animated.createAnimatedComponent(GestureScrollView);

const RANGES: { key: RangeKind; label: string }[] = [
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'year', label: 'Year' },
  { key: 'custom', label: 'Custom' },
];
const RANGE_TITLE: Record<RangeKind, string> = { week: 'Last 7 days', month: 'This month', year: 'Last 12 months', custom: 'Custom range' };
const SPLIT: { key: SpendType; label: string }[] = [
  { key: 'Need', label: 'Needs' },
  { key: 'Want', label: 'Wants' },
  { key: 'Investment', label: 'Investments' },
];

const dayMonth = (d: Date) => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

/** Full-page spending chart: scrub any day for its total and Need / Want / Investment split, over a chosen range. */
export function SpendingScreen() {
  const { c, isDark } = useTheme();
  const styles = useStyles();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { y, onScroll } = useScrollHeader();
  const transactions = useStore((s) => s.transactions);
  const setTransactions = useStore((s) => s.setTransactions);

  const [kind, setKind] = useState<RangeKind>('month');
  const [custom, setCustom] = useState<{ start: Date; end: Date } | null>(null);
  const [active, setActive] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loaded, setLoaded] = useState(transactions.length > 0);
  const [loadFailed, setLoadFailed] = useState(false);
  // Custom range picker: one calendar that edits whichever end is selected
  const [picking, setPicking] = useState(false);
  const [edge, setEdge] = useState<'start' | 'end'>('start');
  const [draft, setDraft] = useState({ start: new Date(), end: new Date() });

  const load = useCallback(async () => {
    try {
      setTransactions(await getTransactions());
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
    } finally {
      setLoaded(true);
    }
  }, [setTransactions]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const series = useMemo(() => {
    const r = rangeFor(kind, new Date(), custom ?? undefined);
    return buildSeries(transactions, r.start, r.end);
  }, [transactions, kind, custom]);

  const total = useMemo<Bucket>(() => series.buckets.reduce(
    (acc, b) => ({ ...acc, total: acc.total + b.total, count: acc.count + b.count, Need: acc.Need + b.Need, Want: acc.Want + b.Want, Investment: acc.Investment + b.Investment }),
    { start: series.from, end: series.to, total: 0, count: 0, Need: 0, Want: 0, Investment: 0 },
  ), [series]);

  const point = active !== null ? series.buckets[active] : undefined;
  const shown = point ?? total;
  const unit = series.bucketDays === 7 ? 'week' : 'day';
  const peak = series.buckets.reduce<Bucket | undefined>((best, b) => (!best || b.total > best.total ? b : best), undefined);
  const average = series.buckets.length ? total.total / series.buckets.length : 0;
  const splitColor: Record<SpendType, string> = { Need: c.info, Want: c.warning, Investment: c.success };

  const chooseRange = (k: RangeKind) => {
    if (k === 'custom') {
      const today = startOfDay(new Date());
      setDraft(custom ?? { start: series.from > today ? today : series.from, end: today });
      setEdge('start');
      setPicking(true);
      return;
    }
    setActive(null);
    setKind(k);
  };

  const pickDate = (d: Date) => {
    const day = startOfDay(d);
    if (edge === 'start') {
      setDraft((r) => ({ start: day, end: r.end < day ? day : r.end }));
      setEdge('end'); // next tap sets the other end, like most range pickers
    } else {
      setDraft((r) => ({ start: r.start > day ? day : r.start, end: day }));
    }
  };

  const applyCustom = () => {
    setCustom(draft);
    setActive(null);
    setKind('custom');
    setPicking(false);
  };

  const firstTx = useMemo(
    () => transactions.reduce<Date | null>((min, t) => {
      const d = startOfDay(new Date(t.timestamp));
      return Number.isFinite(d.getTime()) && (!min || d < min) ? d : min;
    }, null),
    [transactions],
  );

  return (
    <View style={styles.screen}>
      <AnimatedScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingTop: headerHeight, paddingBottom: insets.bottom + 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} tintColor={c.primary} progressViewOffset={headerHeight} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
      >
        <LargeTitle title="Spending" subtitle="Drag across the chart to inspect any day" />

        <View style={styles.body}>
          {loadFailed && transactions.length === 0 ? (
            <ErrorState onRetry={load} />
          ) : (
            <>
              {/* Readout: the range total, or the point under the finger */}
              <View style={styles.readout} accessibilityLiveRegion="polite">
                <Text style={styles.kicker}>{point ? bucketLabel(point) : RANGE_TITLE[kind]}</Text>
                {point ? (
                  <Text style={styles.amount}>{formatCurrency(point.total)}</Text>
                ) : (
                  <MoneyText value={total.total} style={styles.amount} />
                )}
                <Text style={styles.sub}>
                  {point
                    ? `${point.count} transaction${point.count === 1 ? '' : 's'}${series.bucketDays === 7 ? ' this week' : ''}`
                    : series.buckets.length
                      ? `${spanLabel(series.from, series.to)} · ${formatCurrency(average)} a ${unit} on average`
                      : 'No spending in this range'}
                </Text>
              </View>

              <View style={styles.splitBar}>
                {shown.total > 0 ? (
                  SPLIT.map((s) => shown[s.key] > 0 && <View key={s.key} style={{ flex: shown[s.key], backgroundColor: splitColor[s.key] }} />)
                ) : (
                  <View style={[styles.flex, { backgroundColor: c.surfaceAlt }]} />
                )}
              </View>
              <View style={styles.split}>
                {SPLIT.map((s) => (
                  <View key={s.key} style={styles.splitItem} accessible accessibilityLabel={`${s.label} ${formatCurrency(shown[s.key])}`}>
                    <View style={styles.splitHead}>
                      <View style={[styles.dot, { backgroundColor: splitColor[s.key] }]} />
                      <Text style={styles.splitLabel}>{s.label}</Text>
                    </View>
                    <Text style={styles.splitValue} numberOfLines={1} adjustsFontSizeToFit>{formatCurrency(shown[s.key])}</Text>
                    <Text style={styles.splitPct}>{shown.total > 0 ? `${Math.round((shown[s.key] / shown.total) * 100)}%` : '–'}</Text>
                  </View>
                ))}
              </View>

              {/* Chart */}
              <View style={styles.chart}>
                {!loaded ? (
                  <View style={styles.chartEmpty} />
                ) : series.buckets.length ? (
                  <SpendChart
                    buckets={series.buckets}
                    active={active}
                    onScrub={setActive}
                    rangeKey={`${kind}-${series.from.getTime()}-${series.to.getTime()}`}
                  />
                ) : (
                  <EmptyState
                    emoji="📉"
                    title={transactions.length ? 'Nothing in this range' : 'No spending yet'}
                    message={firstTx ? `Your history starts ${dayMonth(firstTx)}. Pick a range after that.` : 'Log an expense with + and it will show up here.'}
                  />
                )}
              </View>

              <SegmentedControl segments={RANGES} value={kind} onChange={chooseRange} accessibilityLabel="Chart range" />

              {series.clamped && series.buckets.length > 0 && (
                <Animated.View entering={enterUp(0)} style={styles.note}>
                  <Ionicons name="information-circle" size={18} color={c.primary} />
                  <Text style={styles.noteText}>Your history starts {dayMonth(series.from)}, so the chart begins there.</Text>
                </Animated.View>
              )}

              {series.buckets.length > 0 && peak && (
                <View style={styles.stats}>
                  <Card style={styles.stat}>
                    <Text style={styles.statLabel}>Highest {unit}</Text>
                    <Text style={styles.statValue}>{formatCurrency(peak.total)}</Text>
                    <Text style={styles.statSub}>{bucketLabel(peak)}</Text>
                  </Card>
                  <Card style={styles.stat}>
                    <Text style={styles.statLabel}>Average per {unit}</Text>
                    <Text style={styles.statValue}>{formatCurrency(average)}</Text>
                    <Text style={styles.statSub}>{total.count} transaction{total.count === 1 ? '' : 's'} in all</Text>
                  </Card>
                </View>
              )}
            </>
          )}
        </View>
      </AnimatedScrollView>
      <ScreenHeader title="Spending" y={y} onBack={() => navigation.goBack()} />

      <Sheet visible={picking} onClose={() => setPicking(false)} title="Custom range">
        <SegmentedControl
          segments={[
            { key: 'start', label: `From  ${draft.start.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` },
            { key: 'end', label: `To  ${draft.end.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` },
          ]}
          value={edge}
          onChange={setEdge}
          accessibilityLabel="Range end to edit"
        />
        <DateTimePicker
          value={draft[edge]}
          mode="date"
          display="inline"
          themeVariant={isDark ? 'dark' : 'light'}
          accentColor={c.primary}
          maximumDate={new Date()}
          onChange={(_, d) => d && pickDate(d)}
        />
        <Text style={styles.pickerHint}>
          {spanLabel(draft.start, draft.end)}
          {firstTx && draft.start < firstTx ? ` · data starts ${firstTx.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : ''}
        </Text>
        <Button label="Show this range" onPress={applyCustom} />
      </Sheet>
    </View>
  );
}

const useStyles = createStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.bg },
  flex: { flex: 1 },
  body: { paddingHorizontal: 16, gap: 16 },
  readout: { gap: 2 },
  kicker: { ...typeScale.overline, color: c.textSubtle },
  amount: { ...typeScale.display, ...tabular, color: c.text, marginTop: 4 },
  sub: { ...typeScale.caption, color: c.textMuted },
  splitBar: { flexDirection: 'row', height: 6, borderRadius: 3, overflow: 'hidden', gap: 2 },
  split: { flexDirection: 'row', gap: 10, marginTop: -4 },
  splitItem: { flex: 1 },
  splitHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  splitLabel: { ...typeScale.caption, color: c.textMuted },
  splitValue: { ...typeScale.headline, ...tabular, color: c.text, marginTop: 4 },
  splitPct: { ...typeScale.caption, ...tabular, color: c.textSubtle },
  chart: { minHeight: 258, justifyContent: 'center' },
  chartEmpty: { height: 258, borderRadius: radius.lg, backgroundColor: c.surfaceAlt },
  note: {
    flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: radius.md, backgroundColor: c.primarySoft,
  },
  noteText: { ...typeScale.caption, flex: 1, color: c.text },
  stats: { flexDirection: 'row', gap: 12 },
  stat: { flex: 1 },
  statLabel: { ...typeScale.caption, color: c.textMuted },
  statValue: { ...typeScale.headline, ...tabular, color: c.text, marginTop: 6 },
  statSub: { ...typeScale.caption, color: c.textSubtle, marginTop: 2 },
  pickerHint: { ...typeScale.label, color: c.textMuted, textAlign: 'center', marginBottom: 12 },
}));
