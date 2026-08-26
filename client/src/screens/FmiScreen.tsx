import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { getFMI } from '../services/api';
import { FMIRecord, FMIResponse } from '../types';

const BLUE = '#2563EB';
const GREEN = '#10B981';
const AMBER = '#F59E0B';
const RED = '#EF4444';
const INDIGO = '#4F46E5';
const DARK = '#0F172A';
const GRAY = '#64748B';
const LIGHT = '#F8FAFC';
const BORDER = '#E2E8F0';

// ── Helpers ──────────────────────────────────────────────────

function fmiColor(score: number) {
  if (score >= 70) return '#059669';
  if (score >= 45) return '#D97706';
  return '#DC2626';
}

function formatINR(n: number | null | undefined) {
  if (n === null || n === undefined || isNaN(n)) return '₹0';
  return `₹${Math.round(Math.abs(n)).toLocaleString('en-IN')}`;
}

// ── Gauge Component ──────────────────────────────────────────

function Gauge({ score, label }: { score: number; label?: string }) {
  const color = fmiColor(score);
  const rotation = -90 + (Math.min(100, Math.max(0, score)) / 100) * 180;

  return (
    <View style={g.container}>
      <View style={g.arcWrap}>
        <View style={g.arcBg} />
        <View
          style={[
            g.arcFg,
            {
              borderColor: color,
              transform: [{ rotate: `${rotation}deg` }],
            },
          ]}
        />
      </View>
      <View style={g.scoreWrap}>
        <Text style={[g.scoreText, { color }]}>{Math.round(score)}</Text>
        <Text style={g.scoreLabel}>/ 100</Text>
      </View>
      <Text style={[g.status, { color }]}>
        {label || (score >= 80 ? 'Excellent' : score >= 65 ? 'Good' : score >= 45 ? 'Fair' : 'Needs Attention')}
      </Text>
    </View>
  );
}

const g = StyleSheet.create({
  container: { alignItems: 'center', marginVertical: 16 },
  arcWrap: {
    width: 220,
    height: 110,
    overflow: 'hidden',
    alignItems: 'center',
    position: 'relative',
  },
  arcBg: {
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 20,
    borderColor: '#F1F5F9',
    position: 'absolute',
  },
  arcFg: {
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 20,
    borderTopColor: 'transparent',
    borderRightColor: 'transparent',
    position: 'absolute',
  },
  scoreWrap: { position: 'absolute', bottom: 8, alignItems: 'center' },
  scoreText: { fontSize: 44, fontWeight: '800', letterSpacing: -1.5 },
  scoreLabel: { fontSize: 13, fontWeight: '700', color: '#94A3B8', marginTop: -6 },
  status: { fontSize: 16, fontWeight: '700', marginTop: 12 },
});

// ── Status Badge ─────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const config =
    {
      above: { bg: '#FEF2F2', fg: RED, border: '#FECACA', text: 'Budget Pressure' },
      on_track: { bg: '#FFFBEB', fg: AMBER, border: '#FDE68A', text: 'On Track' },
      below: { bg: '#ECFDF5', fg: '#059669', border: '#A7F3D0', text: 'Safe Buffer' },
    }[status] || { bg: '#F1F5F9', fg: GRAY, border: BORDER, text: 'Calibrating' };

  return (
    <View style={[sb.badge, { backgroundColor: config.bg, borderColor: config.border }]}>
      <Ionicons
        name={status === 'below' ? 'shield-checkmark' : status === 'on_track' ? 'checkmark-circle' : 'alert-circle'}
        size={16}
        color={config.fg}
      />
      <Text style={[sb.text, { color: config.fg }]}>{config.text}</Text>
    </View>
  );
}

const sb = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    gap: 6,
    marginTop: 6,
  },
  text: { fontSize: 13, fontWeight: '700' },
});

// ── Pillar Card ──────────────────────────────────────────────

function PillarCard({
  title,
  icon,
  score,
  weight,
  detail,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  score: number;
  weight: number;
  detail: string;
}) {
  const color = fmiColor(score);
  const pct = Math.min(100, Math.max(0, score));
  const weightPct = Math.round(weight * 100);

  return (
    <View style={pc.card}>
      <View style={pc.header}>
        <View style={[pc.iconWrap, { backgroundColor: `${color}15` }]}>
          <Ionicons name={icon} size={20} color={color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={pc.title}>{title}</Text>
          <Text style={pc.weight}>Weight: {weightPct}% of FMI</Text>
        </View>
        <Text style={[pc.score, { color }]}>{score}</Text>
      </View>
      <View style={pc.barBg}>
        <View style={[pc.barFg, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
      <Text style={pc.detail}>{detail}</Text>
    </View>
  );
}

const pc = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 14, fontWeight: '700', color: DARK },
  weight: { fontSize: 11, fontWeight: '600', color: GRAY, marginTop: 2 },
  score: { fontSize: 26, fontWeight: '800', letterSpacing: -1 },
  barBg: { height: 6, backgroundColor: '#F1F5F9', borderRadius: 3, overflow: 'hidden' },
  barFg: { height: '100%', borderRadius: 3 },
  detail: { fontSize: 12, color: GRAY, marginTop: 8, lineHeight: 18 },
});

// ── Main Screen ──────────────────────────────────────────────

export function FmiScreen(): React.ReactElement {
  const navigation = useNavigation();
  const [history, setHistory] = useState<FMIRecord[]>([]);
  const [current, setCurrent] = useState<FMIResponse | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchFmi = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      const data = await getFMI();
      setCurrent(data.current);
      setHistory(data.history || []);
    } catch {
      // Non-blocking catch
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchFmi();
    }, [fetchFmi])
  );

  if (loading && !current) {
    return (
      <View style={s.loadingWrap}>
        <ActivityIndicator size="large" color={BLUE} />
        <Text style={s.loadingText}>Calculating Financial Health (FMI)…</Text>
      </View>
    );
  }

  const score = current?.FMI ?? current?.score ?? 50;
  const label = current?.fmiLabel;
  const status = current?.status ?? 'on_track';
  const pillars = current?.pillars;
  const prediction = current?.prediction;
  const goalDetail = current?.goalDetail;

  const maxScore = Math.max(...(history.map((h) => h.score) || [100]), 100);

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" />
      {/* ── Top Bar ──────────────────────────────────────────── */}
      <View style={s.topBar}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={s.backBtn}
          activeOpacity={0.7}
          accessibilityLabel="Back to Previous Screen"
        >
          <Ionicons name="arrow-back" size={22} color={DARK} />
        </TouchableOpacity>
        <Text style={s.topBarTitle}>Financial Health (FMI)</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={s.screen}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchFmi(true)}
            tintColor={BLUE}
            colors={[BLUE]}
          />
        }
      >
        {/* ── Main FMI Score Card ──────────────────────────────── */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Financial Mood Index</Text>
          <Text style={s.cardSub}>Goal-based deterministic measure of your financial health</Text>

          <Gauge score={score} label={label} />
          <StatusBadge status={status} />
        </View>

        {/* ── 3 Pillar Cards ──────────────────────────────────── */}
        {pillars && (
          <View style={s.pillarSection}>
            <Text style={s.sectionTitle}>3 Pillar Breakdown</Text>
            <View style={{ gap: 12 }}>
              <PillarCard
                title="Saving Discipline"
                icon="wallet-outline"
                score={pillars.D1_savingDiscipline.score}
                weight={pillars.D1_savingDiscipline.weight}
                detail={pillars.D1_savingDiscipline.detail}
              />
              <PillarCard
                title="Spending Control"
                icon="pie-chart-outline"
                score={pillars.D2_spendingControl.score}
                weight={pillars.D2_spendingControl.weight}
                detail={pillars.D2_spendingControl.detail}
              />
              <PillarCard
                title="Behavioral Risk"
                icon="pulse-outline"
                score={pillars.D3_behavioralRisk.score}
                weight={pillars.D3_behavioralRisk.weight}
                detail={pillars.D3_behavioralRisk.detail}
              />
            </View>
          </View>
        )}

        {/* ── Prediction Card ─────────────────────────────────── */}
        {prediction && current && (
          <View style={s.card}>
            <View style={s.cardHeaderRow}>
              <Ionicons name="trending-up-outline" size={18} color={BLUE} />
              <Text style={s.cardTitle}>Monthly Spending Pace</Text>
            </View>
            <Text style={s.cardSub}>
              Day {prediction.daysPassed} of {prediction.daysInMonth} in current month
            </Text>

            <View style={s.metricGrid}>
              <View style={s.metricItem}>
                <Text style={s.metricValue}>{formatINR(current.totalSpent)}</Text>
                <Text style={s.metricLabel}>Spent So Far</Text>
              </View>
              <View style={s.metricItem}>
                <Text style={[s.metricValue, { color: fmiColor(current.FMI) }]}>
                  {formatINR(current.predictedMonthlySpend)}
                </Text>
                <Text style={s.metricLabel}>Predicted Total</Text>
              </View>
              <View style={s.metricItem}>
                <Text style={[s.metricValue, { color: '#059669' }]}>{formatINR(current.availableMoney)}</Text>
                <Text style={s.metricLabel}>Available Budget</Text>
              </View>
              <View style={s.metricItem}>
                <Text style={s.metricValue}>{formatINR(prediction.avgDailySpend)}</Text>
                <Text style={s.metricLabel}>Avg Daily Spend</Text>
              </View>
            </View>
          </View>
        )}

        {/* ── Savings & Goal Card ──────────────────────────────── */}
        {current && (
          <View style={s.card}>
            <View style={s.cardHeaderRow}>
              <Ionicons name="flag-outline" size={18} color={GREEN} />
              <Text style={s.cardTitle}>Retirement Goal Progress</Text>
            </View>
            <View style={s.metricGrid}>
              <View style={s.metricItem}>
                <Text style={s.metricValue}>{formatINR(current.totalSaved)}</Text>
                <Text style={s.metricLabel}>Saved This Month</Text>
              </View>
              <View style={s.metricItem}>
                <Text style={s.metricValue}>{formatINR(current.requiredThisMonth)}</Text>
                <Text style={s.metricLabel}>Required This Month</Text>
              </View>
              <View style={s.metricItem}>
                <Text style={s.metricValue}>{formatINR(current.requiredMonthlySaving)}</Text>
                <Text style={s.metricLabel}>Monthly Target</Text>
              </View>
              {goalDetail && (
                <View style={s.metricItem}>
                  <Text style={s.metricValue}>{goalDetail.yearsLeft}y</Text>
                  <Text style={s.metricLabel}>Until Retirement</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* ── Behavioral Insights ─────────────────────────────── */}
        {current?.insights && current.insights.length > 0 && (
          <View style={s.card}>
            <View style={s.cardHeaderRow}>
              <Ionicons name="bulb-outline" size={18} color={AMBER} />
              <Text style={s.cardTitle}>Explainable Insights</Text>
            </View>
            <View style={{ gap: 10, marginTop: 12 }}>
              {current.insights.map((insight, i) => (
                <View key={i} style={s.insightRow}>
                  <View style={s.insightDot} />
                  <Text style={s.insightText}>{insight}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── Alerts ──────────────────────────────────────────── */}
        {current?.alerts && current.alerts.length > 0 && (
          <View style={{ gap: 10 }}>
            <Text style={s.sectionTitle}>Actionable Alerts</Text>
            {current.alerts.map((alert, i) => {
              const alertStyle =
                {
                  critical: { bg: '#FEF2F2', border: '#FECACA', fg: RED, icon: 'alert-circle' as const },
                  warning: { bg: '#FFFBEB', border: '#FDE68A', fg: '#D97706', icon: 'warning' as const },
                  nudge: { bg: '#EEF2FF', border: '#C7D2FE', fg: INDIGO, icon: 'information-circle' as const },
                }[alert.type] || { bg: '#F8FAFC', border: BORDER, fg: GRAY, icon: 'information-circle' as const };

              return (
                <View
                  key={i}
                  style={[s.alertCard, { backgroundColor: alertStyle.bg, borderColor: alertStyle.border }]}
                >
                  <Ionicons name={alertStyle.icon} size={18} color={alertStyle.fg} />
                  <Text style={[s.alertText, { color: alertStyle.fg }]}>{alert.message}</Text>
                </View>
              );
            })}
          </View>
        )}

        {/* ── FMI Trend Chart ──────────────────────────────────── */}
        {history.length > 0 && (
          <View style={s.card}>
            <Text style={s.cardTitle}>FMI Score History</Text>
            <View style={s.chart}>
              {history.slice(-7).map((h, i) => {
                const hPct = (h.score / maxScore) * 100;
                const barColor = fmiColor(h.score);
                return (
                  <View key={i} style={s.barWrap}>
                    <Text style={s.barVal}>{Math.round(h.score)}</Text>
                    <View style={[s.bar, { height: `${hPct}%`, backgroundColor: barColor }]} />
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* ── Info Card (Architecture & Transparency) ───────────── */}
        <View style={s.infoCard}>
          <Text style={s.infoTitle}>💡 How FMI Works</Text>
          <Text style={s.infoText}>
            The Financial Mood Index (FMI) is an explainable deterministic index (0–100) combining three pillars:
            Saving Discipline (40%), Spending Control (30%), and Behavioral Risk (30%). It tracks actual savings against
            retirement goals and detects spending spikes.
          </Text>
          <Text style={[s.infoText, { marginTop: 8, fontStyle: 'italic' }]}>
            Note: Irregular income volatility and emergency runway are measured separately in the Predictability & Income
            Analytics engine.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ───────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: LIGHT },
  screen: { flex: 1, backgroundColor: LIGHT },
  content: { padding: 16, paddingBottom: 40, gap: 16 },

  loadingWrap: {
    flex: 1,
    backgroundColor: LIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: { fontSize: 14, fontWeight: '600', color: GRAY },

  // Top Bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
  },
  topBarTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: DARK,
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: BORDER,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: { fontSize: 16, fontWeight: '800', color: DARK },
  cardSub: { fontSize: 13, color: GRAY, marginTop: 4 },

  sectionTitle: { fontSize: 15, fontWeight: '800', color: DARK, marginBottom: 4 },
  pillarSection: { gap: 12 },

  // Metric grid (2×2)
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 14, gap: 10 },
  metricItem: { width: '48%', backgroundColor: '#F8FAFC', borderRadius: 14, padding: 12, alignItems: 'center' },
  metricValue: { fontSize: 17, fontWeight: '800', color: DARK, letterSpacing: -0.5 },
  metricLabel: { fontSize: 11, fontWeight: '600', color: GRAY, marginTop: 4, textAlign: 'center' },

  // Insights
  insightRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
  },
  insightDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: BLUE, marginTop: 6 },
  insightText: { flex: 1, fontSize: 13, fontWeight: '500', color: DARK, lineHeight: 18 },

  // Alerts
  alertCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 14, borderWidth: 1 },
  alertText: { flex: 1, fontSize: 13, fontWeight: '600', lineHeight: 18 },

  // Trend chart
  chart: {
    height: 140,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 16,
  },
  barWrap: { alignItems: 'center', width: 32, height: '100%', justifyContent: 'flex-end' },
  barVal: { fontSize: 10, fontWeight: '700', color: GRAY, marginBottom: 6 },
  bar: { width: 16, borderRadius: 8, backgroundColor: BLUE, minHeight: 4 },

  // Info
  infoCard: { backgroundColor: '#EEF2FF', borderRadius: 20, padding: 18, borderWidth: 1, borderColor: '#C7D2FE' },
  infoTitle: { fontSize: 14, fontWeight: '700', color: INDIGO, marginBottom: 6 },
  infoText: { fontSize: 12, color: '#4338CA', lineHeight: 18 },
});
