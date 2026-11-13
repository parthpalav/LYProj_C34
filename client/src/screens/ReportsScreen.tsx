import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Share, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getIncome, getLiabilities, getMonthlyReport, getTransactions, getWeeklyReport } from '../services/api';
import { MonthlyReport, WeeklyReport } from '../types';
import { createStyles, tabular, typeScale, useTheme } from '../theme';
import { formatCurrency } from '../utils/format';
import { incomesToCsv, liabilitiesToCsv, monthlySummariesToCsv, transactionsToCsv } from '../utils/csv';
import { AnimatedBar } from '../components/motion/AnimatedBar';
import { Card } from '../components/ui/Card';
import { ListRow, SectionHeader } from '../components/ui/Bits';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { LargeTitle, ScreenHeader, useHeaderHeight, useScrollHeader } from '../components/ui/ScreenHeader';

type Tab = 'weekly' | 'monthly' | 'history' | 'export';
const TABS = [
  { key: 'weekly', label: 'Weekly' },
  { key: 'monthly', label: 'Monthly' },
  { key: 'history', label: 'History' },
  { key: 'export', label: 'Export' },
] as const;
const HISTORY_MONTHS = 6;

const monthAgo = (n: number) => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() - n, 1);
};
const loadMonth = (n: number) => { const d = monthAgo(n); return getMonthlyReport(d.getFullYear(), d.getMonth() + 1); };

/** Weekly and monthly reviews, a six-month ledger and CSV export: the mobile twin of the web Reports page. */
export function ReportsScreen() {
  const { c } = useTheme();
  const s = useStyles();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { y, onScroll } = useScrollHeader();
  const [tab, setTab] = useState<Tab>('weekly');
  const [weekly, setWeekly] = useState<WeeklyReport | null>(null);
  const [offset, setOffset] = useState(0); // months back from this month
  const [monthly, setMonthly] = useState<MonthlyReport | null>(null);
  const [history, setHistory] = useState<MonthlyReport[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);

  const loadHistory = useCallback(
    () => Promise.all(Array.from({ length: HISTORY_MONTHS }, (_, i) => loadMonth(i))).then((list) => { setHistory(list); return list; }),
    [],
  );

  useEffect(() => {
    setFailed(false);
    if (tab === 'weekly' && !weekly) getWeeklyReport().then(setWeekly).catch(() => setFailed(true));
    if (tab === 'history' && !history) loadHistory().catch(() => setFailed(true));
  }, [tab, weekly, history, loadHistory]);

  useEffect(() => {
    if (tab !== 'monthly') return;
    let live = true;
    setMonthly(null);
    setFailed(false);
    loadMonth(offset).then((r) => live && setMonthly(r)).catch(() => live && setFailed(true));
    return () => { live = false; };
  }, [tab, offset]);

  const exportCsv = async (name: string, make: () => Promise<string>) => {
    setExporting(name);
    try {
      await Share.share({ title: `finaura-${name}.csv`, message: await make() });
    } catch { /* share sheet dismissed or data failed to load */ } finally {
      setExporting(null);
    }
  };

  const stat = (label: string, value: string, tone?: string) => (
    <View style={s.stat} key={label}>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={[s.statValue, tone ? { color: tone } : null]}>{value}</Text>
    </View>
  );
  const categories = (list: Array<{ category: string; amount: number; pct: number }>) => (
    list.length === 0 ? <Text style={s.muted}>No spending logged in this period.</Text> : list.slice(0, 6).map((cat, i) => (
      <View key={cat.category} style={i > 0 ? s.gap : null}>
        <View style={s.line}>
          <Text style={s.lineLabel}>{cat.category}</Text>
          <Text style={s.lineValue}>{formatCurrency(cat.amount)} · {Math.round(cat.pct)}%</Text>
        </View>
        <AnimatedBar progress={cat.pct / 100} color={c.primary} height={8} delay={i * 100} />
      </View>
    ))
  );
  const loading = failed
    ? <Text style={s.muted}>Couldn't load this report. Pull back and try again.</Text>
    : <ActivityIndicator color={c.primary} style={s.spinner} />;
  const rateTone = (rate: number) => (rate >= 0 ? c.successStrong : c.dangerStrong);

  return (
    <View style={s.screen}>
      <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={{ paddingTop: headerHeight, paddingBottom: insets.bottom + 40 }}>
        <LargeTitle title="Reports" subtitle="Weekly, monthly and historical views of your recorded activity" />
        <View style={s.body}>
          <SegmentedControl segments={TABS} value={tab} onChange={setTab} accessibilityLabel="Report type" />

          {tab === 'weekly' && (!weekly ? loading : (
            <>
              <SectionHeader title="Last 7 days" />
              <Card>
                <View style={s.stats}>
                  {stat('Spent', formatCurrency(weekly.totalSpend))}
                  {stat('Income', formatCurrency(weekly.totalIncome))}
                  {stat('Savings rate', `${Math.round(weekly.savingsRate)}%`, rateTone(weekly.savingsRate))}
                  {stat('Average FMI', String(Math.round(weekly.fmiAvg)))}
                  {stat('Unusual spends', String(weekly.anomalyCount))}
                </View>
              </Card>
              <SectionHeader title="Top spending categories" />
              <Card>{categories(weekly.topCategories)}</Card>
              <SectionHeader title="Patterns this week" />
              <Card>
                {weekly.patterns.length === 0 ? <Text style={s.muted}>No behavioural patterns detected this week.</Text> : weekly.patterns.map((p, i) => (
                  <View key={i} style={[s.pattern, i > 0 && s.gap]}>
                    <Text style={s.emoji}>{p.emoji}</Text>
                    <Text style={s.patternText}>{p.message}</Text>
                  </View>
                ))}
              </Card>
            </>
          ))}

          {tab === 'monthly' && (
            <>
              <View style={s.stepper}>
                <Pressable onPress={() => setOffset((o) => o + 1)} hitSlop={12} accessibilityRole="button" accessibilityLabel="Previous month">
                  <Ionicons name="chevron-back" size={22} color={c.primary} />
                </Pressable>
                <Text style={s.stepperLabel}>{monthAgo(offset).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</Text>
                <Pressable onPress={() => setOffset((o) => Math.max(0, o - 1))} disabled={offset === 0} hitSlop={12} accessibilityRole="button" accessibilityLabel="Next month">
                  <Ionicons name="chevron-forward" size={22} color={offset === 0 ? c.textSubtle : c.primary} />
                </Pressable>
              </View>
              {!monthly ? loading : (
                <>
                  <Card>
                    <View style={s.stats}>
                      {stat('Income', formatCurrency(monthly.totalIncome))}
                      {stat('Expenses', formatCurrency(monthly.totalExpenses))}
                      {stat('Net cash flow', formatCurrency(monthly.netCashFlow), rateTone(monthly.netCashFlow))}
                      {stat('Savings rate', `${Math.round(monthly.savingsRate)}%`, rateTone(monthly.savingsRate))}
                      {stat('Transactions', String(monthly.transactionCount))}
                      {stat('Income receipts', String(monthly.incomeCount))}
                    </View>
                  </Card>
                  <SectionHeader title="Spending mix" />
                  <Card>
                    {([['Needs', c.info], ['Wants', c.warning], ['Investments', c.success]] as const).map(([key, color], i) => {
                      const total = monthly.spendingMix.Needs + monthly.spendingMix.Wants + monthly.spendingMix.Investments;
                      const value = monthly.spendingMix[key];
                      return (
                        <View key={key} style={i > 0 ? s.gap : null}>
                          <View style={s.line}>
                            <Text style={s.lineLabel}>{key}</Text>
                            <Text style={s.lineValue}>{formatCurrency(value)} · {total > 0 ? Math.round((value / total) * 100) : 0}%</Text>
                          </View>
                          <AnimatedBar progress={total > 0 ? value / total : 0} color={color} height={8} delay={i * 100} />
                        </View>
                      );
                    })}
                  </Card>
                  <SectionHeader title="Category breakdown" />
                  <Card>{categories(monthly.topCategories)}</Card>
                  <SectionHeader title="Financial Maturity Index" />
                  <Card>
                    {monthly.fmi.hasSnapshots && monthly.fmi.average !== null ? (
                      <View style={s.stats}>
                        {stat('Average', String(Math.round(monthly.fmi.average)))}
                        {stat('Start', monthly.fmi.first === null ? '—' : String(Math.round(monthly.fmi.first)))}
                        {stat('End', monthly.fmi.last === null ? '—' : String(Math.round(monthly.fmi.last)))}
                        {stat('Change', monthly.fmi.change === null ? '—' : `${monthly.fmi.change > 0 ? '+' : ''}${Math.round(monthly.fmi.change)}`, monthly.fmi.change ? rateTone(monthly.fmi.change) : undefined)}
                      </View>
                    ) : <Text style={s.muted}>No FMI readings were recorded this month.</Text>}
                  </Card>
                  <SectionHeader title="Unusual spends" />
                  <Card>
                    {monthly.anomalies.count === 0 ? <Text style={s.muted}>Nothing unusual this month.</Text> : monthly.anomalies.items.map((a, i) => (
                      <View key={a.id} style={[s.line, i > 0 && s.gap]}>
                        <Text style={s.lineLabel} numberOfLines={1}>{a.description || a.category}</Text>
                        <Text style={s.lineValue}>{formatCurrency(a.amount)}</Text>
                      </View>
                    ))}
                  </Card>
                </>
              )}
            </>
          )}

          {tab === 'history' && (!history ? loading : (
            <>
              <SectionHeader title={`Last ${HISTORY_MONTHS} months`} />
              <Card>
                {history.map((m, i) => (
                  <View key={m.periodLabel} style={i > 0 ? s.ledgerRow : null}>
                    <View style={s.line}>
                      <Text style={s.lineLabel}>{m.periodLabel}</Text>
                      <Text style={[s.lineValue, { color: rateTone(m.netCashFlow) }]}>{m.netCashFlow >= 0 ? '+' : '−'}{formatCurrency(Math.abs(m.netCashFlow))}</Text>
                    </View>
                    <Text style={s.ledgerMeta}>
                      In {formatCurrency(m.totalIncome)} · Out {formatCurrency(m.totalExpenses)} · Saved {Math.round(m.savingsRate)}%{m.fmi.average !== null ? ` · FMI ${Math.round(m.fmi.average)}` : ''}
                    </Text>
                  </View>
                ))}
              </Card>
            </>
          ))}

          {tab === 'export' && (
            <>
              <SectionHeader title="Download your records as CSV" />
              <Card padded={false}>
                {([
                  ['transactions', 'Transactions', 'Every recorded expense', 'receipt-outline', async () => transactionsToCsv(await getTransactions())],
                  ['income', 'Income', 'Salary and other receipts', 'cash-outline', async () => incomesToCsv(await getIncome())],
                  ['liabilities', 'Liabilities', 'Loans, cards and bills', 'card-outline', async () => liabilitiesToCsv(await getLiabilities())],
                  ['monthly-summaries', 'Monthly summaries', `Totals for the last ${HISTORY_MONTHS} months`, 'calendar-outline', async () => monthlySummariesToCsv(history ?? await loadHistory())],
                ] as const).map(([name, title, subtitle, icon, make]) => (
                  <View key={name} style={s.exportRow}>
                    <ListRow icon={icon} tint={c.primary} title={title} subtitle={exporting === name ? 'Preparing…' : subtitle} onPress={() => !exporting && exportCsv(name, make)} />
                  </View>
                ))}
              </Card>
              <Text style={s.note}>Opens the share sheet with the CSV text: save it to Files, or send it to mail or notes.</Text>
            </>
          )}
        </View>
      </Animated.ScrollView>
      <ScreenHeader title="Reports" y={y} onBack={() => navigation.goBack()} />
    </View>
  );
}

const useStyles = createStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.bg },
  body: { paddingHorizontal: 16 },
  muted: { ...typeScale.body, color: c.textMuted },
  spinner: { marginTop: 40 },
  gap: { marginTop: 14 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 16 },
  stat: { width: '50%', gap: 2 },
  statLabel: { ...typeScale.caption, color: c.textMuted },
  statValue: { fontSize: 20, fontWeight: '800', color: c.text, ...tabular },
  line: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginBottom: 6 },
  lineLabel: { fontSize: 15, fontWeight: '600', color: c.text, flexShrink: 1 },
  lineValue: { fontSize: 14, fontWeight: '700', color: c.text, ...tabular },
  pattern: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  emoji: { fontSize: 18 },
  patternText: { ...typeScale.body, color: c.text, flex: 1 },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16 },
  stepperLabel: { ...typeScale.headline, color: c.text },
  ledgerRow: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: c.border },
  ledgerMeta: { ...typeScale.caption, color: c.textMuted },
  exportRow: { paddingHorizontal: 12 },
  note: { ...typeScale.caption, color: c.textMuted, marginTop: 10, paddingHorizontal: 4 },
}));
