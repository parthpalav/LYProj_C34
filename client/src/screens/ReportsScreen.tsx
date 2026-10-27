import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl, ActivityIndicator,
} from 'react-native';
import { getWeeklyReport } from '../services/api';
import { WeeklyReport } from '../types';

import { createStyles, useTheme, Palette } from '../theme';
const tokens = (c: Palette) => ({ BLUE: c.primary, AMBER: c.warning, RED: c.danger, PURPLE: c.purple });
const GREEN  = '#22C880';
// Chart series colors are saturated enough to read on both light and dark surfaces.
const PALETTE = ['#3B3BDE', GREEN, '#F59E0B', '#EF4444', '#7C3AED'];

function StatCard({ label, value, sub, color: colorProp }: { label: string; value: string; sub?: string; color?: string }) {
  const { c } = useTheme();
  const color = colorProp ?? c.primary;
  const st = useStStyles();
  return (
    <View style={[st.card, { borderTopColor: color }]}>
      <Text style={st.label}>{label}</Text>
      <Text style={[st.value, { color }]}>{value}</Text>
      {sub ? <Text style={st.sub}>{sub}</Text> : null}
    </View>
  );
}
const useStStyles = createStyles((c) => ({
  card:  { flex: 1, backgroundColor: c.surface, borderRadius: 16, padding: 14, borderTopWidth: 3, borderColor: c.border, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  label: { fontSize: 11, color: c.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  value: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  sub:   { fontSize: 11, color: c.textSubtle, marginTop: 4 },
}));

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  const sc = useScStyles();
  return (
    <View style={sc.card}>
      <Text style={sc.title}>{title}</Text>
      {children}
    </View>
  );
}
const useScStyles = createStyles((c) => ({
  card:  { backgroundColor: c.surface, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: c.border, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 3 },
  title: { fontSize: 15, fontWeight: '700', color: c.text, marginBottom: 16 },
}));

function CategoryBar({ category, amount, pct, color }: { category: string; amount: number; pct: number; color: string }) {
  const cb = useCbStyles();
  return (
    <View style={cb.row}>
      <Text style={cb.label}>{category.charAt(0).toUpperCase() + category.slice(1)}</Text>
      <View style={cb.barWrap}>
        <View style={[cb.bar, { width: `${pct}%` as any, backgroundColor: color }]} />
      </View>
      <Text style={cb.pct}>{pct}%</Text>
      <Text style={cb.amt}>₹{amount.toLocaleString()}</Text>
    </View>
  );
}
const useCbStyles = createStyles((c) => ({
  row:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  label:   { width: 80, fontSize: 12, fontWeight: '600', color: c.textMuted },
  barWrap: { flex: 1, height: 8, backgroundColor: c.bg, borderRadius: 99, overflow: 'hidden' },
  bar:     { height: '100%', borderRadius: 99 },
  pct:     { width: 32, fontSize: 12, fontWeight: '600', color: c.textMuted, textAlign: 'right' },
  amt:     { width: 64, fontSize: 12, fontWeight: '700', color: c.text, textAlign: 'right' },
}));

export function ReportsScreen(): React.ReactElement {
  const { c } = useTheme();
  const { BLUE, AMBER, RED } = tokens(c);
  const s = useSStyles();
  const [report,     setReport]     = useState<WeeklyReport | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading,    setLoading]    = useState(true);

  const fetchReport = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      const data = await getWeeklyReport();
      setReport(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={BLUE} />
      </View>
    );
  }

  const fmiBand = (report?.fmiAvg ?? 0) >= 70 ? GREEN : (report?.fmiAvg ?? 0) >= 45 ? AMBER : RED;
  const savingsColor = (report?.savingsRate ?? 0) >= 20 ? GREEN : (report?.savingsRate ?? 0) >= 10 ? AMBER : RED;
  const netFlow = (report?.totalIncome ?? 0) - (report?.totalSpend ?? 0);

  return (
    <ScrollView
      style={s.screen}
      contentContainerStyle={s.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchReport(true)} tintColor={BLUE} colors={[BLUE]} />}
    >
      <Text style={s.heading}>Weekly Report</Text>
      <Text style={s.subHeading}>Last 7 days summary</Text>

      {/* Stat row 1 */}
      <View style={s.statRow}>
        <StatCard label="Total Spend" value={`₹${(report?.totalSpend ?? 0).toLocaleString()}`} sub="this week" color={RED} />
        <StatCard label="Total Income" value={`₹${(report?.totalIncome ?? 0).toLocaleString()}`} sub="this week" color={GREEN} />
      </View>

      {/* Stat row 2 */}
      <View style={s.statRow}>
        <StatCard label="FMI Average" value={`${report?.fmiAvg ?? 0}/100`} sub="financial mood" color={fmiBand} />
        <StatCard label="Savings Rate" value={`${report?.savingsRate ?? 0}%`} sub="of income saved" color={savingsColor} />
      </View>

      {/* Net flow banner */}
      <View style={[s.netBanner, { backgroundColor: netFlow >= 0 ? '#ECFDF5' : '#FEF2F2', borderColor: netFlow >= 0 ? '#6EE7B7' : '#FECACA' }]}>
        <Text style={s.netIcon}>{netFlow >= 0 ? '✅' : '⚠️'}</Text>
        <View style={{ flex: 1 }}>
          <Text style={[s.netLabel, { color: netFlow >= 0 ? '#065F46' : '#991B1B' }]}>Net Cash Flow</Text>
          <Text style={[s.netValue, { color: netFlow >= 0 ? '#10B981' : RED }]}>
            {netFlow >= 0 ? '+' : ''}₹{netFlow.toLocaleString()}
          </Text>
        </View>
        {(report?.anomalyCount ?? 0) > 0 && (
          <View style={s.anomalyBadge}>
            <Text style={s.anomalyText}>{report?.anomalyCount} anomalies</Text>
          </View>
        )}
      </View>

      {/* Top categories */}
      {(report?.topCategories ?? []).length > 0 && (
        <SectionCard title="Spending by Category">
          {(report?.topCategories ?? []).map((cat, i) => (
            <CategoryBar
              key={cat.category}
              category={cat.category}
              amount={cat.amount}
              pct={cat.pct}
              color={PALETTE[i % PALETTE.length]}
            />
          ))}
        </SectionCard>
      )}

      {/* Behavioral patterns */}
      {(report?.patterns ?? []).length > 0 && (
        <SectionCard title="Behavioral Insights">
          {(report?.patterns ?? []).map((p, i) => {
            const c = p.severity === 'high' ? RED : p.severity === 'medium' ? AMBER : GREEN;
            return (
              <View key={i} style={[s.patternRow, { backgroundColor: c + '12', borderColor: c + '40' }]}>
                <Text style={s.patternEmoji}>{p.emoji}</Text>
                <Text style={[s.patternMsg, { color: c === RED ? '#991B1B' : c === AMBER ? '#92400E' : '#065F46' }]}>{p.message}</Text>
              </View>
            );
          })}
        </SectionCard>
      )}

      {!report && (
        <View style={s.empty}>
          <Text style={{ fontSize: 40, marginBottom: 12 }}>📊</Text>
          <Text style={{ fontSize: 16, fontWeight: '700', color: c.text }}>No report data yet</Text>
          <Text style={{ fontSize: 13, color: c.textMuted, marginTop: 6, textAlign: 'center' }}>Add transactions and income to see your weekly report.</Text>
        </View>
      )}
    </ScrollView>
  );
}

const useSStyles = createStyles((c) => {
  const { RED } = tokens(c);
  return {
  screen:    { flex: 1, backgroundColor: c.bg },
  content:   { padding: 16, paddingBottom: 32, gap: 16 },
  heading:   { fontSize: 24, fontWeight: '800', color: c.text, letterSpacing: -0.5 },
  subHeading:{ fontSize: 13, color: c.textMuted, marginTop: -8 },
  statRow:   { flexDirection: 'row', gap: 12 },

  netBanner:  { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 16, borderWidth: 1.5 },
  netIcon:    { fontSize: 24 },
  netLabel:   { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  netValue:   { fontSize: 26, fontWeight: '800', letterSpacing: -1, marginTop: 2 },
  anomalyBadge: { backgroundColor: c.dangerSoft, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  anomalyText:  { fontSize: 12, fontWeight: '700', color: RED },

  patternRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 8 },
  patternEmoji: { fontSize: 18 },
  patternMsg:  { flex: 1, fontSize: 13, fontWeight: '600', lineHeight: 18 },

  empty: { alignItems: 'center', paddingVertical: 48 },
};
});
