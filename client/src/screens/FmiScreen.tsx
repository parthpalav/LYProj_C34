import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, ActivityIndicator } from 'react-native';
import { getFMI } from '../services/api';
import { FMIRecord, FMIResponse } from '../types';

const BLUE   = '#3B3BDE';
const GREEN  = '#22C880';
const AMBER  = '#F59E0B';
const RED    = '#EF4444';
const INDIGO = '#4338CA';
const DARK   = '#111827';
const GRAY   = '#6B7280';
const LIGHT  = '#F4F6FA';

// ── Helpers ──────────────────────────────────────────────────

function fmiColor(score: number) {
  if (score >= 70) return GREEN;
  if (score >= 45) return AMBER;
  return RED;
}

function formatINR(n: number) {
  return `₹${Math.round(Math.abs(n)).toLocaleString('en-IN')}`;
}

// ── Gauge Component ──────────────────────────────────────────

function Gauge({ score, label }: { score: number; label?: string }) {
  const color = fmiColor(score);
  const rotation = -90 + (score / 100) * 180;
  
  return (
    <View style={g.container}>
      <View style={g.arcWrap}>
        <View style={g.arcBg} />
        <View style={[g.arcFg, { borderColor: color, transform: [{ rotate: `${rotation}deg` }] }]} />
      </View>
      <View style={g.scoreWrap}>
        <Text style={[g.scoreText, { color }]}>{Math.round(score)}</Text>
        <Text style={g.scoreLabel}>/ 100</Text>
      </View>
      <Text style={[g.status, { color }]}>
        {label || (score >= 70 ? 'Optimal' : score >= 45 ? 'Fair' : 'Needs Attention')}
      </Text>
    </View>
  );
}

const g = StyleSheet.create({
  container: { alignItems: 'center', marginVertical: 20 },
  arcWrap:   { width: 240, height: 120, overflow: 'hidden', alignItems: 'center', position: 'relative' },
  arcBg:     { width: 240, height: 240, borderRadius: 120, borderWidth: 24, borderColor: '#F0F1F5', position: 'absolute' },
  arcFg:     { width: 240, height: 240, borderRadius: 120, borderWidth: 24, borderTopColor: 'transparent', borderRightColor: 'transparent', position: 'absolute' },
  scoreWrap: { position: 'absolute', bottom: 10, alignItems: 'center' },
  scoreText: { fontSize: 48, fontWeight: '800', letterSpacing: -2 },
  scoreLabel:{ fontSize: 13, fontWeight: '700', color: '#9CA3AF', marginTop: -8 },
  status:    { fontSize: 16, fontWeight: '700', marginTop: 12 },
});

// ── Status Badge ─────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const config = {
    above:    { bg: '#FEE2E2', fg: RED,   icon: '⚠️', text: 'Overspending' },
    on_track: { bg: '#FEF3C7', fg: AMBER, icon: '✅', text: 'On Track' },
    below:    { bg: '#D1FAE5', fg: GREEN, icon: '🛡️', text: 'Safe Zone' },
  }[status] || { bg: '#F3F4F6', fg: GRAY, icon: '❓', text: 'Unknown' };

  return (
    <View style={[sb.badge, { backgroundColor: config.bg }]}>
      <Text style={sb.icon}>{config.icon}</Text>
      <Text style={[sb.text, { color: config.fg }]}>{config.text}</Text>
    </View>
  );
}

const sb = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, gap: 6, marginTop: 8 },
  icon:  { fontSize: 16 },
  text:  { fontSize: 14, fontWeight: '700' },
});

// ── Pillar Card ──────────────────────────────────────────────

function PillarCard({ title, emoji, score, weight, detail }: {
  title: string; emoji: string; score: number; weight: number; detail: string;
}) {
  const color = fmiColor(score);
  const pct = Math.min(100, Math.max(0, score));
  const weightPct = Math.round(weight * 100);

  return (
    <View style={pc.card}>
      <View style={pc.header}>
        <Text style={pc.emoji}>{emoji}</Text>
        <View style={{ flex: 1 }}>
          <Text style={pc.title}>{title}</Text>
          <Text style={pc.weight}>Weight: {weightPct}%</Text>
        </View>
        <Text style={[pc.score, { color }]}>{score}</Text>
      </View>
      <View style={pc.barBg}>
        <View style={[pc.barFg, { width: `${pct}%` as any, backgroundColor: color }]} />
      </View>
      <Text style={pc.detail}>{detail}</Text>
    </View>
  );
}

const pc = StyleSheet.create({
  card:   { backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#F0F1F5', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 4, elevation: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  emoji:  { fontSize: 24 },
  title:  { fontSize: 14, fontWeight: '700', color: DARK },
  weight: { fontSize: 11, fontWeight: '600', color: GRAY, marginTop: 2 },
  score:  { fontSize: 28, fontWeight: '800', letterSpacing: -1 },
  barBg:  { height: 6, backgroundColor: '#F0F1F5', borderRadius: 3, overflow: 'hidden' },
  barFg:  { height: '100%', borderRadius: 3 },
  detail: { fontSize: 12, color: GRAY, marginTop: 8, lineHeight: 18 },
});

// ── Main Screen ──────────────────────────────────────────────

export function FmiScreen(): React.ReactElement {
  const [history,    setHistory]    = useState<FMIRecord[]>([]);
  const [current,    setCurrent]    = useState<FMIResponse | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading,    setLoading]    = useState(true);

  const fetchFmi = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      const data = await getFMI();
      setCurrent(data.current);
      setHistory(data.history);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchFmi(); }, [fetchFmi]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: LIGHT, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={BLUE} />
      </View>
    );
  }

  const score  = current?.FMI ?? current?.score ?? 50;
  const label  = current?.fmiLabel;
  const status = current?.status ?? 'on_track';
  const pillars = current?.pillars;
  const prediction = current?.prediction;
  const goalDetail = current?.goalDetail;
  
  const maxScore = Math.max(...history.map(h => h.score), 100);
  
  return (
    <ScrollView 
      style={s.screen} 
      contentContainerStyle={s.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchFmi(true)} tintColor={BLUE} />}
    >
      {/* ── Main FMI Score Card ──────────────────────────────── */}
      <View style={s.card}>
        <Text style={s.cardTitle}>Financial Mood Index</Text>
        <Text style={s.cardSub}>Goal-based measure of your financial health</Text>
        
        <Gauge score={score} label={label} />
        <StatusBadge status={status} />
      </View>

      {/* ── 3 Pillar Cards ──────────────────────────────────── */}
      {pillars && (
        <View style={s.pillarSection}>
          <Text style={s.sectionTitle}>Score Breakdown</Text>
          <View style={{ gap: 12 }}>
            <PillarCard
              title="Saving Discipline"
              emoji="💰"
              score={pillars.D1_savingDiscipline.score}
              weight={pillars.D1_savingDiscipline.weight}
              detail={pillars.D1_savingDiscipline.detail}
            />
            <PillarCard
              title="Spending Control"
              emoji="📊"
              score={pillars.D2_spendingControl.score}
              weight={pillars.D2_spendingControl.weight}
              detail={pillars.D2_spendingControl.detail}
            />
            <PillarCard
              title="Behavioral Risk"
              emoji="🧠"
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
          <Text style={s.cardTitle}>📈 Monthly Prediction</Text>
          <Text style={s.cardSub}>Day {prediction.daysPassed} of {prediction.daysInMonth}</Text>

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
              <Text style={[s.metricValue, { color: GREEN }]}>{formatINR(current.availableMoney)}</Text>
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
          <Text style={s.cardTitle}>🎯 Goal Progress</Text>
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

      {/* ── Insights ────────────────────────────────────────── */}
      {current?.insights && current.insights.length > 0 && (
        <View style={s.card}>
          <Text style={s.cardTitle}>💡 Insights</Text>
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
          <Text style={s.sectionTitle}>⚡ Alerts</Text>
          {current.alerts.map((alert, i) => {
            const alertStyle = {
              critical: { bg: '#FEE2E2', border: '#FECACA', fg: RED,   icon: '🔴' },
              warning:  { bg: '#FEF3C7', border: '#FDE68A', fg: '#92400E', icon: '🟡' },
              nudge:    { bg: '#EEF2FF', border: '#C7D2FE', fg: INDIGO, icon: '🔵' },
            }[alert.type] || { bg: '#F3F4F6', border: '#E5E7EB', fg: GRAY, icon: '⚪' };

            return (
              <View key={i} style={[s.alertCard, { backgroundColor: alertStyle.bg, borderColor: alertStyle.border }]}>
                <Text style={s.alertIcon}>{alertStyle.icon}</Text>
                <Text style={[s.alertText, { color: alertStyle.fg }]}>{alert.message}</Text>
              </View>
            );
          })}
        </View>
      )}

      {/* ── FMI Trend Chart ──────────────────────────────────── */}
      {history.length > 0 && (
        <View style={s.card}>
          <Text style={s.cardTitle}>FMI Trend (Last 7 Days)</Text>
          <View style={s.chart}>
            {history.slice(-7).map((h, i) => {
              const hPct = (h.score / maxScore) * 100;
              const barColor = fmiColor(h.score);
              return (
                <View key={i} style={s.barWrap}>
                  <Text style={s.barVal}>{Math.round(h.score)}</Text>
                  <View style={[s.bar, { height: `${hPct}%` as any, backgroundColor: barColor }]} />
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* ── Info Card ────────────────────────────────────────── */}
      <View style={s.infoCard}>
        <Text style={s.infoTitle}>💡 What is FMI?</Text>
        <Text style={s.infoText}>
          The Financial Mood Index (FMI) is a deterministic score from 0-100 based on three pillars: Saving Discipline (40%), Spending Control (30%), and Behavioral Risk (30%). It compares your actual spending and saving against your retirement goal to give you an explainable, goal-based measure of financial health.
        </Text>
      </View>
      
    </ScrollView>
  );
}

// ── Styles ───────────────────────────────────────────────────

const s = StyleSheet.create({
  screen:    { flex: 1, backgroundColor: LIGHT },
  content:   { padding: 16, paddingBottom: 32, gap: 16 },
  
  card:      { backgroundColor: '#fff', borderRadius: 20, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2, borderWidth: 1, borderColor: '#F0F1F5' },
  cardTitle: { fontSize: 16, fontWeight: '800', color: DARK },
  cardSub:   { fontSize: 13, color: GRAY, marginTop: 4 },

  sectionTitle: { fontSize: 15, fontWeight: '800', color: DARK, marginBottom: 4 },
  pillarSection: { gap: 12 },

  // Metric grid (2×2)
  metricGrid:  { flexDirection: 'row', flexWrap: 'wrap', marginTop: 16, gap: 12 },
  metricItem:  { width: '46%', backgroundColor: '#F9FAFB', borderRadius: 14, padding: 14, alignItems: 'center' },
  metricValue: { fontSize: 18, fontWeight: '800', color: DARK, letterSpacing: -0.5 },
  metricLabel: { fontSize: 11, fontWeight: '600', color: GRAY, marginTop: 4, textAlign: 'center' },

  // Insights
  insightRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: '#F9FAFB', padding: 12, borderRadius: 12 },
  insightDot:  { width: 8, height: 8, borderRadius: 4, backgroundColor: BLUE, marginTop: 5 },
  insightText: { flex: 1, fontSize: 13, fontWeight: '500', color: '#374151', lineHeight: 20 },

  // Alerts
  alertCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 14, borderWidth: 1 },
  alertIcon: { fontSize: 16 },
  alertText: { flex: 1, fontSize: 13, fontWeight: '600', lineHeight: 18 },

  // Trend chart
  chart:     { height: 160, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 20, paddingTop: 20 },
  barWrap:   { alignItems: 'center', width: 28, height: '100%', justifyContent: 'flex-end' },
  barVal:    { fontSize: 10, fontWeight: '700', color: GRAY, marginBottom: 6 },
  bar:       { width: 14, borderRadius: 7, backgroundColor: BLUE, minHeight: 4 },

  // Info
  infoCard:  { backgroundColor: '#EEF2FF', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#C7D2FE' },
  infoTitle: { fontSize: 15, fontWeight: '700', color: INDIGO, marginBottom: 8 },
  infoText:  { fontSize: 13, color: '#4F46E5', lineHeight: 20 },
});
