import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { getDashboard } from '../services/api';
import { useStore } from '../store/useStore';
import { DashboardData } from '../types';

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_PAD = 16;

// ── Colour tokens ──────────────────────────────────────────
const BLUE   = '#3B3BDE';
const GREEN  = '#22C880';
const AMBER  = '#F59E0B';
const RED    = '#EF4444';
const PURPLE = '#7C3AED';

// ═══════════════════════════════════════════════════════════
// GAUGE  (semi-circle via overflow + border trick)
// ═══════════════════════════════════════════════════════════
function SavingsGauge({ score = 5, max = 100 }: { score?: number; max?: number }) {
  const pct = Math.min(score / max, 1);
  const deg = -90 + pct * 180;
  const color = score >= 70 ? GREEN : score >= 45 ? AMBER : RED;

  return (
    <View style={gStyles.wrap}>
      <View style={gStyles.track}>
        <View style={[gStyles.fill, { transform: [{ rotate: `${deg}deg` }], borderColor: color, borderBottomColor: 'transparent', borderLeftColor: 'transparent' }]} />
        <View style={gStyles.mask} />
      </View>
      <View style={gStyles.label}>
        <Text style={gStyles.value}>{score}/100</Text>
        <Text style={gStyles.sub}>FMI score</Text>
      </View>
    </View>
  );
}

const R = 72;
const T = 12;
const gStyles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingTop: 8 },
  track: { width: R * 2, height: R, overflow: 'hidden', position: 'relative' },
  fill: {
    position: 'absolute',
    width: R * 2, height: R * 2,
    borderRadius: R,
    borderWidth: T,
    bottom: 0,
  },
  mask: {
    position: 'absolute',
    width: (R - T) * 2, height: (R - T) * 2,
    borderRadius: R - T,
    backgroundColor: '#fff',
    bottom: 0, left: T, top: T,
  },
  label: { alignItems: 'center', marginTop: 8 },
  value: { fontSize: 22, fontWeight: '800', color: '#111827', letterSpacing: -0.5 },
  sub: { fontSize: 11, color: '#6B7280', marginTop: 2 },
});

// ═══════════════════════════════════════════════════════════
// WANTS vs NEEDS  (vertical bars)
// ═══════════════════════════════════════════════════════════
function WantsNeedsChart({ fmiScore }: { fmiScore: number }) {
  const wantsPct = Math.min(100, Math.round(100 - fmiScore * 0.4));
  const needsPct = Math.min(100, Math.round(fmiScore * 0.5));
  const BAR_H = 110;
  return (
    <View style={wnStyles.row}>
      {[{ label: 'Wants', pct: wantsPct, color: BLUE }, { label: 'Needs', pct: needsPct, color: GREEN }].map((b) => (
        <View key={b.label} style={wnStyles.col}>
          <View style={[wnStyles.track, { height: BAR_H }]}>
            <View style={[wnStyles.bar, { height: (b.pct / 100) * BAR_H, backgroundColor: b.color }]} />
          </View>
          <Text style={wnStyles.pct}>{b.pct}%</Text>
          <Text style={wnStyles.lbl}>{b.label}</Text>
        </View>
      ))}
    </View>
  );
}
const wnStyles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', paddingTop: 4 },
  col: { alignItems: 'center', gap: 4 },
  track: { width: 52, backgroundColor: '#F0F1F5', borderRadius: 8, justifyContent: 'flex-end', overflow: 'hidden' },
  bar: { width: '100%', borderRadius: 8 },
  pct: { fontSize: 20, fontWeight: '800', color: '#111827', marginTop: 6 },
  lbl: { fontSize: 12, color: '#6B7280', fontWeight: '500' },
});

// ═══════════════════════════════════════════════════════════
// GOAL PROGRESS BARS
// ═══════════════════════════════════════════════════════════
function GoalProgress({ goals = [] }: { goals?: any[] }) {
  if (goals.length === 0) return <Text style={{ color: '#6B7280' }}>No active goals. Add one in the Planner!</Text>;
  
  return (
    <View style={{ gap: 14 }}>
      {goals.slice(0, 2).map((g) => {
        const pct = g.targetAmount > 0 ? Math.min(100, Math.round((g.savedAmount / g.targetAmount) * 100)) : 0;
        return (
          <View key={g.id || g.name}>
            <View style={gp.row}>
              <Text style={gp.name}>{g.emoji} {g.name}</Text>
              <Text style={[gp.pct, { color: BLUE }]}>{pct}%</Text>
            </View>
            <View style={gp.track}>
              <View style={[gp.fill, { width: `${pct}%` as any, backgroundColor: BLUE }]} />
            </View>
            <Text style={gp.sub}>₹{g.savedAmount.toLocaleString()} of ₹{g.targetAmount.toLocaleString()}</Text>
          </View>
        );
      })}
    </View>
  );
}
const gp = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  name: { fontSize: 13, fontWeight: '600', color: '#111827' },
  pct:  { fontSize: 13, fontWeight: '700' },
  track: { height: 8, backgroundColor: '#E8ECF2', borderRadius: 99, overflow: 'hidden' },
  fill:  { height: '100%', borderRadius: 99 },
  sub:   { fontSize: 11, color: '#6B7280', marginTop: 4 },
});

// ═══════════════════════════════════════════════════════════
// LINE CHART  (driven by real spendingSeries)
// ═══════════════════════════════════════════════════════════
const LINE_H = 130;
const LINE_LABELS = ['1', '2', '3', '4', '5', '6', '7'];

function LineGraph({ series }: { series: number[] }) {
  const points = series.length >= 2 ? series.slice(-7) : [50, 120, 200, 280, 350, 420, 490];
  const LINE_MAX = Math.max(...points, 1);
  const availW = SCREEN_W - 48 - CARD_PAD * 2;
  const stepX = availW / (points.length - 1);
  const labels = points.map((_, i) => `${i + 1}`);

  return (
    <View>
      <View style={{ height: LINE_H, position: 'relative' }}>
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <View key={f} style={[lnStyles.grid, { bottom: f * LINE_H, left: 28 }]} />
        ))}
        {points.map((val, i) => {
          const x = 28 + i * stepX;
          const y = (val / LINE_MAX) * LINE_H;
          let lineEl = null;
          if (i > 0) {
            const prevVal = points[i - 1];
            const prevX   = 28 + (i - 1) * stepX;
            const prevY   = (prevVal / LINE_MAX) * LINE_H;
            const dx = x - prevX; const dy = y - prevY;
            const length = Math.sqrt(dx * dx + dy * dy);
            const angle  = Math.atan2(dy, dx) * (180 / Math.PI);
            lineEl = (
              <View key={`line-${i}`} style={[lnStyles.segment, { width: length, bottom: prevY, left: prevX, transform: [{ rotate: `${-angle}deg` }] }]} />
            );
          }
          return (
            <React.Fragment key={i}>
              {lineEl}
              <View style={[lnStyles.dot, { bottom: y - 4, left: x - 4 }]} />
            </React.Fragment>
          );
        })}
      </View>
      <View style={[lnStyles.xRow, { paddingLeft: 28 }]}>
        {labels.map((l) => (
          <Text key={l} style={lnStyles.xLbl}>{l}</Text>
        ))}
      </View>
    </View>
  );
}
const lnStyles = StyleSheet.create({
  grid:    { position: 'absolute', right: 0, height: 1, backgroundColor: '#F0F1F5' },
  segment: { position: 'absolute', height: 2.5, backgroundColor: BLUE, borderRadius: 2 },
  dot:     { position: 'absolute', width: 8, height: 8, borderRadius: 4, backgroundColor: BLUE, borderWidth: 2, borderColor: '#fff' },
  xRow:    { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  xLbl:    { fontSize: 10, color: '#9CA3AF', flex: 1, textAlign: 'center' },
});

// ═══════════════════════════════════════════════════════════
// DONUT RING
// ═══════════════════════════════════════════════════════════
function DonutRing({ data = [] }: { data?: Array<{ label: string; pct: number }> }) {
  const SIZE = 130;
  if (data.length === 0) return <View style={{ height: SIZE, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 11, color: '#9CA3AF' }}>No data</Text></View>;
  
  const COLORS = [BLUE, GREEN, AMBER, RED, PURPLE];
  let acc = 0;
  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ width: SIZE, height: SIZE, borderRadius: SIZE / 2, overflow: 'hidden', backgroundColor: '#F0F1F5' }}>
        {data.map((seg, i) => {
          const color = COLORS[i % COLORS.length];
          const startAngle = acc * 3.6;
          acc += seg.pct;
          return (
            <View key={i} pointerEvents="none" style={{ position: 'absolute', width: SIZE, height: SIZE, borderRadius: SIZE / 2, borderWidth: SIZE / 2, borderColor: 'transparent', borderTopColor: seg.pct >= 50 ? color : 'transparent', borderRightColor: color, transform: [{ rotate: `${startAngle - 90}deg` }] }} />
          );
        })}
        <View style={{ position: 'absolute', width: SIZE - 36, height: SIZE - 36, borderRadius: (SIZE - 36) / 2, backgroundColor: '#fff', left: 18, top: 18, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: '#111827' }}>Spend</Text>
        </View>
      </View>
      <View style={donStyles.legRow2}>
        {data.slice(0, 3).map((s, i) => (
          <View key={s.label} style={donStyles.legItem}>
            <View style={[donStyles.legDot, { backgroundColor: COLORS[i % COLORS.length] }]} />
            <Text style={donStyles.legLbl}>{s.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
const donStyles = StyleSheet.create({
  legRow2: { flexDirection: 'row', gap: 16, marginTop: 10 },
  legItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legDot: { width: 9, height: 9, borderRadius: 5 },
  legLbl: { fontSize: 12, color: '#6B7280', fontWeight: '500' },
});

// ═══════════════════════════════════════════════════════════
// BAR CHART
// ═══════════════════════════════════════════════════════════
const BAR_H   = 130;

function BarChart({ data = [] }: { data?: Array<{ label: string; val: number; color: string }> }) {
  if (data.length === 0) return <Text style={{ fontSize: 12, color: '#6B7280' }}>No budget data</Text>;
  const maxVal = Math.max(...data.map(d => d.val), 1);

  return (
    <View>
      <View style={{ flexDirection: 'row', height: BAR_H }}>
        <View style={{ width: 44, height: BAR_H, justifyContent: 'space-between', alignItems: 'flex-end', paddingRight: 8 }}>
          {[maxVal, maxVal / 2, 0].map((v) => (
            <Text key={v} style={{ fontSize: 9, color: '#9CA3AF' }}>₹{Math.round(v)}</Text>
          ))}
        </View>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around' }}>
          {data.map((b) => (
            <View key={b.label} style={{ alignItems: 'center', flex: 1 }}>
              <View style={{ width: 30, height: (b.val / maxVal) * BAR_H, backgroundColor: b.color, borderRadius: 6 }} />
            </View>
          ))}
        </View>
      </View>
      <View style={{ flexDirection: 'row', paddingLeft: 44, marginTop: 4 }}>
        {data.map((b) => (
          <Text key={b.label} style={{ flex: 1, textAlign: 'center', fontSize: 10, color: '#9CA3AF' }}>{b.label}</Text>
        ))}
      </View>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════
// CARD WRAPPER
// ═══════════════════════════════════════════════════════════
function Card({ title, info, children }: { title: string; info?: boolean; children: React.ReactNode }) {
  return (
    <View style={cardStyles.card}>
      <View style={cardStyles.header}>
        <Text style={cardStyles.title}>{title}</Text>
        {info && <TouchableOpacity style={cardStyles.infoBtn}><Text style={cardStyles.infoTxt}>i</Text></TouchableOpacity>}
      </View>
      {children}
    </View>
  );
}
const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: CARD_PAD,
    borderWidth: 1,
    borderColor: '#E8ECF2',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title:  { fontSize: 15, fontWeight: '700', color: '#111827' },
  infoBtn: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center' },
  infoTxt: { fontSize: 11, fontWeight: '700', color: '#6B7280' },
});

// ═══════════════════════════════════════════════════════════
// BALANCE CARD
// ═══════════════════════════════════════════════════════════
function BalanceCard({ balance }: { balance: number }) {
  const formatted = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(balance);
  return (
    <View style={balStyles.card}>
      <Text style={balStyles.label}>Current Balance</Text>
      <Text style={balStyles.amount}>{formatted}</Text>
    </View>
  );
}
const balStyles = StyleSheet.create({
  card: {
    backgroundColor: BLUE,
    borderRadius: 20,
    padding: 20,
    shadowColor: BLUE,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  label: { fontSize: 13, color: 'rgba(255,255,255,0.75)', fontWeight: '500', marginBottom: 6 },
  amount: { fontSize: 32, fontWeight: '800', color: '#fff', letterSpacing: -1 },
});

// ═══════════════════════════════════════════════════════════
// FIS SCORE CARD
// ═══════════════════════════════════════════════════════════
function FisCard({ fis, grade }: { fis: number; grade: string }) {
  const color = fis >= 80 ? GREEN : fis >= 65 ? BLUE : fis >= 50 ? AMBER : RED;
  return (
    <Card title="Integrity Score (FIS)" info>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View>
          <Text style={{ fontSize: 36, fontWeight: '800', color: '#111827', letterSpacing: -1 }}>{fis}</Text>
          <Text style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>out of 100</Text>
        </View>
        <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: color + '1A', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: color }}>
          <Text style={{ fontSize: 24, fontWeight: '800', color }}>{grade}</Text>
        </View>
      </View>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════
// MAIN DASHBOARD SCREEN
// ═══════════════════════════════════════════════════════════
export function DashboardScreen(): React.ReactElement {
  const { dashboard, setDashboard } = useStore();
  const [loading,     setLoading]   = useState(!dashboard);
  const [refreshing,  setRefreshing] = useState(false);
  const [error,       setError]     = useState<string | null>(null);

  const fetchDashboard = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      const data: DashboardData = await getDashboard();
      setDashboard(data);
      setError(null);
    } catch {
      setError('Could not load dashboard. Is the server running?');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const fmiScore     = dashboard?.fmiScore     ?? 0;
  const balance      = dashboard?.balance      ?? 0;
  const spendSeries  = dashboard?.spendingSeries ?? [];
  const risk         = dashboard?.risk         ?? 'low';
  const insights     = dashboard?.insights     ?? [];

  const bannerColor  = risk === 'high' ? '#FEF2F2' : risk === 'medium' ? '#FFFBEB' : '#ECFDF5';
  const bannerBorder = risk === 'high' ? '#FECACA' : risk === 'medium' ? '#FCD34D' : '#6EE7B7';
  const bannerTextColor = risk === 'high' ? '#991B1B' : risk === 'medium' ? '#92400E' : '#065F46';
  const bannerIcon   = risk === 'high' ? '🚨' : risk === 'medium' ? '⚠️' : '✅';

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#F4F6FA', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={BLUE} />
        <Text style={{ marginTop: 12, color: '#6B7280', fontSize: 14 }}>Loading dashboard…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ flex: 1, backgroundColor: '#F4F6FA', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text style={{ fontSize: 32, marginBottom: 12 }}>⚠️</Text>
        <Text style={{ fontSize: 15, color: '#374151', textAlign: 'center', lineHeight: 22 }}>{error}</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={s.screen}
      contentContainerStyle={s.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => fetchDashboard(true)}
          tintColor={BLUE}
          colors={[BLUE]}
        />
      }
    >

      {/* Balance */}
      <BalanceCard balance={balance} />

      {/* Row 0: FIS and FMI */}
      <View style={s.row}>
        <View style={{ flex: 1 }}>
          <FisCard fis={dashboard?.fis ?? 0} grade={dashboard?.fisGrade ?? 'N/A'} />
        </View>
        <View style={{ flex: 1 }}>
          <Card title="FMI Score" info>
            <SavingsGauge score={fmiScore} max={100} />
          </Card>
        </View>
      </View>

      {/* Row 1 */}
      <View style={s.row}>
        <View style={{ flex: 1 }}>
          <Card title="Wants vs Needs">
            <WantsNeedsChart fmiScore={fmiScore} />
          </Card>
        </View>
      </View>

      {/* Goal Progress – full width */}
      <Card title="Goal Progress" info>
        <GoalProgress />
      </Card>

      {/* Pattern Banner */}
      {dashboard?.patterns && dashboard.patterns.length > 0 && (
         <View style={[s.banner, { backgroundColor: '#F3E8FF', borderColor: '#D8B4FE', marginBottom: 0 }]}>
           <Text style={s.bannerIcon}>{dashboard.patterns[0].emoji}</Text>
           <View style={{ flex: 1 }}>
             <Text style={[s.bannerBold, { color: '#6B21A8' }]}>Behavioral Insight</Text>
             <Text style={[s.bannerText, { color: '#6B21A8' }]}>{dashboard.patterns[0].message}</Text>
           </View>
         </View>
      )}

      {/* Row 2 */}
      <View style={s.row}>
        <View style={{ flex: 1 }}>
          <Card title="Spending Trend">
            <Text style={s.chartSub}>Last {spendSeries.length} transactions</Text>
            <LineGraph series={spendSeries} />
          </Card>
        </View>
        <View style={{ flex: 1 }}>
          <Card title="Spend Mix">
            <DonutRing data={dashboard?.categoryBreakdown} />
          </Card>
        </View>
      </View>

      {/* Bar Chart – full width */}
      <Card title="Budget Breakdown">
        <Text style={s.chartSub}>Current allocation flow across buckets</Text>
        <BarChart data={dashboard?.budgetMetrics} />
      </Card>

      {/* Embedded MicroActions directly from PredictionService */}
      {dashboard?.microActions && dashboard.microActions.length > 0 && (
        <Card title="Suggested Micro-Actions">
          {dashboard.microActions.map(action => (
            <View key={action.id} style={s.microActionItem}>
              <View style={{ flex: 1 }}>
                <Text style={s.maTitle}>{action.title}</Text>
                <Text style={s.maDesc}>{action.description}</Text>
                <Text style={s.maImpact}>Impact: {action.impact}</Text>
              </View>
              <TouchableOpacity style={s.maBtn} activeOpacity={0.8}>
                <Text style={s.maBtnText}>{action.actionText}</Text>
              </TouchableOpacity>
            </View>
          ))}
        </Card>
      )}

      {/* Prediction Banner – driven by real risk + insights */}
      <View style={[s.banner, { backgroundColor: bannerColor, borderColor: bannerBorder }]}>
        <Text style={s.bannerIcon}>{bannerIcon}</Text>
        <View style={{ flex: 1 }}>
          <Text style={[s.bannerBold, { color: bannerTextColor }]}>
            Risk Level: {risk.toUpperCase()}
          </Text>
          {insights.slice(0, 2).map((ins, i) => (
            <Text key={i} style={[s.bannerText, { color: bannerTextColor }]}>{ins}</Text>
          ))}
        </View>
      </View>

    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen:   { flex: 1, backgroundColor: '#F4F6FA' },
  content:  { padding: 16, gap: 16, paddingBottom: 32 },
  row:      { flexDirection: 'row', gap: 12 },
  chartSub: { fontSize: 11, color: '#6B7280', marginBottom: 8, marginTop: -4 },
  banner: {
    flexDirection: 'row',
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 14,
    alignItems: 'flex-start',
    gap: 10,
  },
  bannerIcon:      { fontSize: 20 },
  bannerText:      { flex: 1, fontSize: 13, lineHeight: 20, marginTop: 2 },
  bannerBold:      { fontWeight: '700', fontSize: 13, marginBottom: 4 },

  microActionItem: { flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1, borderTopColor: '#F0F1F5', paddingTop: 14, marginTop: 14 },
  maTitle:         { fontSize: 13, fontWeight: '700', color: '#111827', marginBottom: 2 },
  maDesc:          { fontSize: 12, color: '#6B7280', lineHeight: 16 },
  maImpact:        { fontSize: 11, fontWeight: '600', color: GREEN, marginTop: 4 },
  maBtn:           { backgroundColor: BLUE, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12 },
  maBtnText:       { color: '#fff', fontSize: 12, fontWeight: '600' },
});
