import React, { useCallback, useEffect, useState } from 'react';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { AnimatedNumber } from '../components/motion/AnimatedNumber';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { LargeTitle, ScreenHeader, useHeaderHeight, useScrollHeader } from '../components/ui/ScreenHeader';
import { ErrorState } from '../components/ui/Bits';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { getFMI, getCurrentFamily, getFamilyDashboard } from '../services/api';
import { FMIRecord, FMIResponse, FamilySummary, FamilyDashboard } from '../types';

import { createStyles, useTheme, Palette } from '../theme';
const tokens = (c: Palette) => ({ BLUE: c.primary, GREEN: c.success, AMBER: c.warning, RED: c.danger, DARK: c.text, GRAY: c.textMuted, LIGHT: c.bg, BORDER: c.border });

// ── Helpers ──────────────────────────────────────────────────

function fmiColor(score: number, c: Palette) {
  if (score >= 70) return c.successStrong;
  if (score >= 45) return c.warningStrong;
  return c.dangerStrong;
}

function formatINR(n: number | null | undefined) {
  if (n === null || n === undefined || isNaN(n)) return '₹0';
  return `₹${Math.round(Math.abs(n)).toLocaleString('en-IN')}`;
}

// ── Gauge Component ──────────────────────────────────────────

function Gauge({ score, label }: { score: number; label?: string }) {
  const g = useGStyles();
  const { c } = useTheme();
  const color = fmiColor(score, c);
  const rotation = -90 + (Math.min(100, Math.max(0, score)) / 100) * 180;
  // Sweep the arc from empty to the score on mount and whenever the score changes.
  const reduced = useReducedMotion();
  const rot = useSharedValue(reduced ? rotation : -90);
  useEffect(() => {
    rot.value = reduced ? rotation : withTiming(rotation, { duration: 1100, easing: Easing.out(Easing.cubic) });
  }, [rotation, reduced, rot]);
  const arcStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rot.value}deg` }] }));
  const ratingText = label || (score >= 80 ? 'Excellent' : score >= 65 ? 'Good' : score >= 45 ? 'Fair' : 'Needs Attention');

  return (
    <View style={g.container}>
      <View style={g.arcWrap}>
        <View style={g.arcBg} />
        <Animated.View style={[g.arcFg, { borderColor: color }, arcStyle]} />
        <View style={g.scoreWrap}>
          <Text
            style={[g.scoreText, { color }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            <AnimatedNumber value={Math.round(score)} format={(n) => String(n)} duration={1100} />
          </Text>
          <Text style={g.scoreLabel}>/ 100</Text>
        </View>
      </View>
      <View style={g.ratingWrap}>
        <Text style={[g.status, { color }]} numberOfLines={1}>
          {ratingText}
        </Text>
      </View>
    </View>
  );
}

const useGStyles = createStyles((c) => ({
  container: { alignItems: 'center', marginVertical: 14 },
  arcWrap: {
    width: 220,
    height: 110,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'flex-end',
    position: 'relative',
  },
  arcBg: {
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 20,
    borderColor: c.border,
    position: 'absolute',
    top: 0,
  },
  arcFg: {
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 20,
    borderTopColor: 'transparent',
    borderRightColor: 'transparent',
    position: 'absolute',
    top: 0,
  },
  scoreWrap: {
    position: 'absolute',
    bottom: 2,
    alignItems: 'center',
    justifyContent: 'center',
    width: 140,
  },
  scoreText: {
    fontSize: 40,
    fontWeight: '800',
    letterSpacing: -1,
    lineHeight: 44,
  },
  scoreLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: c.textSubtle,
    marginTop: -2,
    letterSpacing: 0.5,
  },
  ratingWrap: {
    marginTop: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 24,
  },
  status: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
}));

// ── Status Badge ─────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const { c } = useTheme();
  const { AMBER, RED, GRAY, BORDER } = tokens(c);
  const sb = useSbStyles();
  const config =
    {
      above: { bg: c.dangerSoft, fg: RED, border: c.dangerSoft, text: 'Budget Pressure' },
      on_track: { bg: c.warningSoft, fg: AMBER, border: c.warningSoft, text: 'On Track' },
      below: { bg: c.successSoft, fg: c.successStrong, border: c.successSoft, text: 'Safe Buffer' },
    }[status] || { bg: c.surfaceAlt, fg: GRAY, border: BORDER, text: 'Calibrating' };

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

const useSbStyles = createStyles((c) => ({
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
}));

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
  const pc = usePcStyles();
  const { c } = useTheme();
  const color = fmiColor(score, c);
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

const usePcStyles = createStyles((c) => {
  const { DARK, GRAY, BORDER } = tokens(c);
  return {
  card: {
    backgroundColor: c.surface,
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
  barBg: { height: 6, backgroundColor: c.surfaceAlt, borderRadius: 3, overflow: 'hidden' },
  barFg: { height: '100%', borderRadius: 3 },
  detail: { fontSize: 12, color: GRAY, marginTop: 8, lineHeight: 18 },
};
});

// ── Main Screen ──────────────────────────────────────────────

export function FmiScreen(): React.ReactElement {
  const { c } = useTheme();
  const { BLUE, GREEN, AMBER, RED, DARK, GRAY, BORDER } = tokens(c);
  const s = useSStyles();
  const navigation = useNavigation();
  const headerHeight = useHeaderHeight();
  const { y, onScroll } = useScrollHeader();
  const [history, setHistory] = useState<FMIRecord[]>([]);
  const [current, setCurrent] = useState<FMIResponse | null>(null);
  const [familySummary, setFamilySummary] = useState<FamilySummary | null>(null);
  const [familyDashboard, setFamilyDashboard] = useState<FamilyDashboard | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  // ── Explicit Household Visibility Condition ──────────────
  const hasActiveHousehold =
    !!familySummary &&
    (
      typeof familySummary.memberCount === 'number'
        ? familySummary.memberCount > 1
        : Array.isArray(familySummary.members) && familySummary.members.length > 1
    );

  const fetchFamilyContext = useCallback(async () => {
    try {
      const fam = await getCurrentFamily();
      if (!fam) {
        setFamilySummary(null);
        setFamilyDashboard(null);
        return;
      }
      const isMulti =
        typeof fam.memberCount === 'number'
          ? fam.memberCount > 1
          : Array.isArray(fam.members) && fam.members.length > 1;
      setFamilySummary(fam);
      if (!isMulti) {
        setFamilyDashboard(null);
        return;
      }
      const dash = await getFamilyDashboard();
      setFamilyDashboard(dash);
    } catch {
      setFamilySummary(null);
      setFamilyDashboard(null);
    }
  }, []);

  const fetchFmi = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
        setFamilyDashboard(null);
      }
      void fetchFamilyContext();
      const data = await getFMI();
      setCurrent(data.current);
      setHistory(data.history || []);
    } catch {
      // Non-blocking catch
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fetchFamilyContext]);

  useFocusEffect(
    useCallback(() => {
      fetchFmi();
    }, [fetchFmi])
  );

  if (loading && !current) {
    return (
      <View style={s.loadingWrap}>
        <ActivityIndicator size="large" color={BLUE} />
        <Text style={s.loadingText}>Calculating your FMI…</Text>
      </View>
    );
  }

  if (!current) {
    return (
      <View style={[s.safe, { paddingTop: headerHeight }]}>
        <ErrorState message="Your FMI couldn't be calculated right now." onRetry={() => fetchFmi(true)} />
        <ScreenHeader title="Financial Maturity" onBack={() => navigation.goBack()} />
      </View>
    );
  }

  const score = current.FMI ?? current.score;
  const label = current?.fmiLabel;
  const status = current?.status ?? 'on_track';
  const pillars = current?.pillars;
  const prediction = current?.prediction;
  const goalDetail = current?.goalDetail;

  const maxScore = Math.max(...(history.map((h) => h.score) || [100]), 100);

  return (
    <View style={s.safe}>
      <Animated.ScrollView
        style={s.screen}
        contentContainerStyle={[s.content, { paddingTop: headerHeight }]}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchFmi(true)}
            tintColor={BLUE}
            progressViewOffset={headerHeight}
          />
        }
      >
        <View style={s.titleWrap}>
          <LargeTitle title="Financial Maturity" subtitle="Your FMI, what drives it, and how it moved" />
        </View>
        {/* ── Main FMI Score Card ──────────────────────────────── */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Financial Maturity Index</Text>
          <Text style={s.cardSub}>Goal-based deterministic measure of your financial health</Text>

          <Animated.View sharedTransitionTag="fmi-score">
            <Gauge score={score} label={label} />
          </Animated.View>
          <StatusBadge status={status} />
        </View>

        {/* ── Contextual Household FMI Navigation Card ─────────── */}
        {hasActiveHousehold && familyDashboard?.fmi ? (
          <TouchableOpacity
            style={s.householdNavCard}
            onPress={() => (navigation as any).navigate('Family')}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={`Household Financial Maturity Index, ${Math.round(familyDashboard.fmi.score)} out of 100, ${familyDashboard.fmi.fmiLabel}. View household details.`}
          >
            <View style={s.householdIconWrap}>
              <Ionicons name="people" size={18} color={c.purple} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.householdNavTitle}>Household Financial Maturity</Text>
              <Text style={s.householdNavSub}>Combined score for your family</Text>
            </View>
            <View style={s.householdScoreBadge}>
              <Text style={s.householdScoreNum}>{Math.round(familyDashboard.fmi.score)}</Text>
              <Text style={s.householdScoreDenom}>/100</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={c.textMuted} />
          </TouchableOpacity>
        ) : null}

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
                <Text style={[s.metricValue, { color: fmiColor(current.FMI, c) }]}>
                  {formatINR(current.predictedMonthlySpend)}
                </Text>
                <Text style={s.metricLabel}>Predicted Total</Text>
              </View>
              <View style={s.metricItem}>
                <Text style={[s.metricValue, { color: c.successStrong }]}>{formatINR(current.availableMoney)}</Text>
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

        {/* ── What moved the score ────────────────────────────── */}
        {current.factors && current.factors.length > 0 && (
          <View style={s.card}>
            <View style={s.cardHeaderRow}>
              <Ionicons name="git-compare-outline" size={18} color={BLUE} />
              <Text style={s.cardTitle}>What moved your score</Text>
            </View>
            <View style={{ gap: 10, marginTop: 12 }}>
              {current.factors.map((f, i) => (
                <View key={i} style={s.insightRow}>
                  <View style={s.insightDot} />
                  <Text style={s.insightText}>{f}</Text>
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
                  critical: { bg: c.dangerSoft, border: c.dangerSoft, fg: c.dangerStrong, icon: 'alert-circle' as const },
                  warning: { bg: c.warningSoft, border: c.warningSoft, fg: c.warningStrong, icon: 'warning' as const },
                  nudge: { bg: c.primarySoft, border: c.primarySoft, fg: c.primary, icon: 'information-circle' as const },
                }[alert.type] || { bg: c.surfaceAlt, border: BORDER, fg: GRAY, icon: 'information-circle' as const };

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
                const barColor = fmiColor(h.score, c);
                return (
                  <View key={i} style={s.barWrap}>
                    <Text style={s.barVal}>{Math.round(h.score)}</Text>
                    <View style={[s.bar, { height: `${hPct}%`, backgroundColor: barColor }]} />
                    <Text style={s.barDate}>{new Date(h.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</Text>
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
            The Financial Maturity Index (FMI) is an explainable deterministic index (0–100) combining three pillars:
            Saving Discipline (40%), Spending Control (30%), and Behavioral Risk (30%). It tracks actual savings against
            retirement goals and detects spending spikes.
          </Text>
          <Text style={[s.infoText, { marginTop: 8, fontStyle: 'italic' }]}>
            Note: Irregular income volatility and emergency runway are measured separately in the Predictability & Income
            Analytics engine.
          </Text>
        </View>
      </Animated.ScrollView>
      <ScreenHeader title="Financial Maturity" y={y} onBack={() => navigation.goBack()} />
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────

const useSStyles = createStyles((c) => {
  const { BLUE, DARK, GRAY, LIGHT, BORDER } = tokens(c);
  return {
  safe: { flex: 1, backgroundColor: LIGHT },
  screen: { flex: 1, backgroundColor: LIGHT },
  content: { padding: 16, paddingBottom: 40, gap: 16 },
  titleWrap: { marginHorizontal: -20, marginBottom: -12 },

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
    backgroundColor: c.surface,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surfaceAlt,
  },
  topBarTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: DARK,
  },

  card: {
    backgroundColor: c.surface,
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
  metricItem: { width: '48%', backgroundColor: c.bg, borderRadius: 14, padding: 12, alignItems: 'center' },
  metricValue: { fontSize: 17, fontWeight: '800', color: DARK, letterSpacing: -0.5 },
  metricLabel: { fontSize: 11, fontWeight: '600', color: GRAY, marginTop: 4, textAlign: 'center' },

  // Insights
  insightRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: c.bg,
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
  barDate: { fontSize: 9, color: GRAY, marginTop: 6 },
  bar: { width: 16, borderRadius: 8, backgroundColor: BLUE, minHeight: 4 },

  // Info
  infoCard: { backgroundColor: c.primarySoft, borderRadius: 20, padding: 18, borderWidth: 1, borderColor: c.primarySoft },
  infoTitle: { fontSize: 14, fontWeight: '700', color: c.primary, marginBottom: 6 },
  infoText: { fontSize: 12, color: c.primary, lineHeight: 18 },

  // Contextual Household Nav Card
  householdNavCard: {
    backgroundColor: c.surface,
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BORDER,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  householdIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: c.purpleSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  householdNavTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: DARK,
  },
  householdNavSub: {
    fontSize: 11,
    color: GRAY,
    marginTop: 2,
  },
  householdScoreBadge: {
    flexDirection: 'row',
    alignItems: 'baseline',
    backgroundColor: c.bg,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: BORDER,
  },
  householdScoreNum: {
    fontSize: 16,
    fontWeight: '800',
    color: c.purple,
  },
  householdScoreDenom: {
    fontSize: 10,
    fontWeight: '600',
    color: c.textSubtle,
    marginLeft: 1,
  },
};
});
