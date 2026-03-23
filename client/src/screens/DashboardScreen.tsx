import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
} from 'react-native';

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_PAD = 16;
const CARD_W = (SCREEN_W - 48) / 2; // two-column card width

// ── Colour tokens ──────────────────────────────────────────
const BLUE   = '#3B3BDE';
const GREEN  = '#22C880';
const AMBER  = '#F59E0B';
const RED    = '#EF4444';
const PURPLE = '#7C3AED';
const ORANGE = '#F97316';

// ═══════════════════════════════════════════════════════════
// GAUGE  (semi-circle via overflow + border trick)
// ═══════════════════════════════════════════════════════════
function SavingsGauge({ score = 5, max = 100 }: { score?: number; max?: number }) {
  const pct = Math.min(score / max, 1);
  // rotate from -90° (leftmost) to +90° (rightmost)
  const deg = -90 + pct * 180;

  return (
    <View style={gStyles.wrap}>
      {/* Track */}
      <View style={gStyles.track}>
        {/* Filled arc  – we draw a full circle, rotate it so the
            coloured portion sweeps from left edge of the semi-circle */}
        <View style={[gStyles.fill, { transform: [{ rotate: `${deg}deg` }] }]} />
        {/* White centre mask that turns full-circle → donut */}
        <View style={gStyles.mask} />
      </View>
      {/* Label centred below midpoint */}
      <View style={gStyles.label}>
        <Text style={gStyles.value}>${score}/100</Text>
        <Text style={gStyles.sub}>savings score</Text>
      </View>
    </View>
  );
}

const R = 72; // outer radius
const T = 12; // track thickness
const gStyles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingTop: 8 },
  track: {
    width: R * 2,
    height: R,            // show only top half
    overflow: 'hidden',
    position: 'relative',
  },
  fill: {
    position: 'absolute',
    width: R * 2, height: R * 2,
    borderRadius: R,
    borderWidth: T,
    borderColor: GREEN,
    borderBottomColor: 'transparent',
    borderLeftColor: 'transparent',
    bottom: 0,
  },
  mask: {
    position: 'absolute',
    width: (R - T) * 2, height: (R - T) * 2,
    borderRadius: R - T,
    backgroundColor: '#fff',
    bottom: 0,
    left: T, top: T,
  },
  label: { alignItems: 'center', marginTop: 8 },
  value: { fontSize: 22, fontWeight: '800', color: '#111827', letterSpacing: -0.5 },
  sub: { fontSize: 11, color: '#6B7280', marginTop: 2 },
});

// ═══════════════════════════════════════════════════════════
// WANTS vs NEEDS  (vertical bars)
// ═══════════════════════════════════════════════════════════
function WantsNeedsChart() {
  const BAR_H = 110;
  return (
    <View style={wnStyles.row}>
      {[{ label: 'Wants', pct: 88, color: BLUE }, { label: 'Needs', pct: 48, color: GREEN }].map((b) => (
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
function GoalProgress() {
  const goals = [
    { name: 'Retirement', pct: 14, color: BLUE },
    { name: 'Emergency Fund', pct: 41, color: GREEN },
  ];
  return (
    <View style={{ gap: 14 }}>
      {goals.map((g) => (
        <View key={g.name}>
          <View style={gp.row}>
            <Text style={gp.name}>{g.name}</Text>
            <Text style={[gp.pct, { color: g.color }]}>{g.pct}%</Text>
          </View>
          <View style={gp.track}>
            <View style={[gp.fill, { width: `${g.pct}%` as any, backgroundColor: g.color }]} />
          </View>
          <Text style={gp.sub}>{g.name} {g.pct}%</Text>
        </View>
      ))}
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
// LINE CHART  (pure-View sparkline with dot markers)
// ═══════════════════════════════════════════════════════════
const LINE_POINTS = [50, 120, 200, 280, 350, 420, 490];
const LINE_LABELS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const LINE_H = 130;
const LINE_MAX = 500;

function LineGraph() {
  const availW = SCREEN_W - 48 - CARD_PAD * 2;
  const stepX = availW / (LINE_POINTS.length - 1);

  return (
    <View>
      <View style={{ height: LINE_H, position: 'relative' }}>
        {/* Y-axis labels */}
        {[0, 100, 200, 300, 400, 500].map((v) => (
          <Text
            key={v}
            style={[
              lnStyles.yLbl,
              { bottom: (v / LINE_MAX) * LINE_H - 7 },
            ]}
          >
            {v}
          </Text>
        ))}

        {/* Grid lines */}
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <View
            key={f}
            style={[lnStyles.grid, { bottom: f * LINE_H, left: 28 }]}
          />
        ))}

        {/* Connecting lines & dots */}
        {LINE_POINTS.map((val, i) => {
          const x = 28 + i * stepX;
          const y = (val / LINE_MAX) * LINE_H;

          // draw line segment from previous point to this one
          let lineEl = null;
          if (i > 0) {
            const prevVal = LINE_POINTS[i - 1];
            const prevX   = 28 + (i - 1) * stepX;
            const prevY   = (prevVal / LINE_MAX) * LINE_H;
            const dx = x - prevX;
            const dy = y - prevY;
            const length = Math.sqrt(dx * dx + dy * dy);
            const angle  = Math.atan2(dy, dx) * (180 / Math.PI);
            lineEl = (
              <View
                key={`line-${i}`}
                style={[
                  lnStyles.segment,
                  {
                    width: length,
                    bottom: prevY,
                    left: prevX,
                    transform: [{ rotate: `${-angle}deg` }],
                  },
                ]}
              />
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

      {/* X labels */}
      <View style={[lnStyles.xRow, { paddingLeft: 28 }]}>
        {LINE_LABELS.map((l) => (
          <Text key={l} style={lnStyles.xLbl}>{l}</Text>
        ))}
      </View>
    </View>
  );
}
const lnStyles = StyleSheet.create({
  yLbl:    { position: 'absolute', left: 0, fontSize: 10, color: '#9CA3AF', width: 26, textAlign: 'right' },
  grid:    { position: 'absolute', right: 0, height: 1, backgroundColor: '#F0F1F5' },
  segment: {
    position: 'absolute',
    height: 2.5, backgroundColor: BLUE,
    borderRadius: 2,
    transformOrigin: 'left center',
  },
  dot:     { position: 'absolute', width: 8, height: 8, borderRadius: 4, backgroundColor: BLUE, borderWidth: 2, borderColor: '#fff' },
  xRow:    { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  xLbl:    { fontSize: 10, color: '#9CA3AF', flex: 1, textAlign: 'center' },
});

// ═══════════════════════════════════════════════════════════
// DONUT CHART  (ring using overlapping bordered Views)
// ═══════════════════════════════════════════════════════════
const DONUT_DATA = [
  { label: 'Food',      pct: 32, color: BLUE   },
  { label: 'Transport', pct: 20, color: GREEN  },
  { label: 'Shopping',  pct: 18, color: AMBER  },
  { label: 'Health',    pct: 14, color: RED    },
  { label: 'Other',     pct: 16, color: PURPLE },
];

function DonutChart() {
  const SIZE = 120;
  const STROKE = 22;
  const r = (SIZE - STROKE) / 2;
  const circ = 2 * Math.PI * r;

  // We render each slice as an SVG-like arc using a rotated full-border circle
  // Pure-View trick: we split the circle into sectors
  let cumulativeDeg = -90; // start from top

  return (
    <View style={donStyles.wrap}>
      <View style={{ width: SIZE, height: SIZE, position: 'relative' }}>
        {DONUT_DATA.map((seg, idx) => {
          const deg = (seg.pct / 100) * 360;
          const startDeg = cumulativeDeg;
          cumulativeDeg += deg;

          // For each segment draw two half-circle masks
          // Simple approach: use background wedge via clip
          return (
            <View
              key={idx}
              style={[
                donStyles.slice,
                {
                  borderTopColor:    seg.color,
                  borderRightColor:  seg.color,
                  transform: [{ rotate: `${startDeg}deg` }],
                  // show only the portion up to `deg`
                  opacity: 1,
                },
              ]}
            />
          );
        })}
        {/* White inner mask */}
        <View style={donStyles.inner} />
        {/* Centre label */}
        <View style={donStyles.centre}>
          <Text style={donStyles.centreNum}>100%</Text>
        </View>
      </View>

      {/* Legend */}
      <View style={donStyles.legend}>
        {DONUT_DATA.map((s) => (
          <View key={s.label} style={donStyles.legRow}>
            <View style={[donStyles.legDot, { backgroundColor: s.color }]} />
            <Text style={donStyles.legLbl}>{s.label}</Text>
            <Text style={donStyles.legPct}>{s.pct}%</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// Better donut: use a progress-ring approach by stacking coloured arcs
// via conic-gradient simulation using rotated half-circles
function DonutRing() {
  const SIZE = 130;
  const sectors = DONUT_DATA;

  let acc = 0;
  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ width: SIZE, height: SIZE, borderRadius: SIZE / 2, overflow: 'hidden', backgroundColor: '#F0F1F5' }}>
        {sectors.map((seg, i) => {
          const startAngle = acc * 3.6; // degrees
          acc += seg.pct;
          return (
            <View
              key={i}
              pointerEvents="none"
              style={{
                position: 'absolute',
                width: SIZE, height: SIZE,
                borderRadius: SIZE / 2,
                borderWidth: SIZE / 2,
                borderColor: 'transparent',
                borderTopColor: seg.pct >= 50 ? seg.color : 'transparent',
                borderRightColor: seg.color,
                transform: [{ rotate: `${startAngle - 90}deg` }],
              }}
            />
          );
        })}
        {/* white inner hole */}
        <View style={{
          position: 'absolute',
          width: SIZE - 36, height: SIZE - 36,
          borderRadius: (SIZE - 36) / 2,
          backgroundColor: '#fff',
          left: 18, top: 18,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: '#111827' }}>Spend</Text>
        </View>
      </View>

      {/* Legend row */}
      <View style={donStyles.legRow2}>
        <View style={donStyles.legItem}><View style={[donStyles.legDot, { backgroundColor: BLUE }]}/><Text style={donStyles.legLbl}>Category</Text></View>
        <View style={donStyles.legItem}><View style={[donStyles.legDot, { backgroundColor: GREEN }]}/><Text style={donStyles.legLbl}>Cons Chart</Text></View>
      </View>
    </View>
  );
}

const donStyles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  slice: {
    position: 'absolute',
    width: 120, height: 120,
    borderRadius: 60,
    borderWidth: 22,
    borderBottomColor: 'transparent',
    borderLeftColor: 'transparent',
  },
  inner: {
    position: 'absolute',
    width: 76, height: 76, borderRadius: 38,
    backgroundColor: '#fff',
    left: 22, top: 22,
  },
  centre: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  centreNum: { fontSize: 14, fontWeight: '800', color: '#111827' },
  legend: { marginTop: 10, gap: 4 },
  legRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legRow2: { flexDirection: 'row', gap: 16, marginTop: 10 },
  legItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legDot: { width: 9, height: 9, borderRadius: 5 },
  legLbl: { fontSize: 12, color: '#6B7280', fontWeight: '500' },
  legPct: { fontSize: 12, color: '#374151', fontWeight: '600', marginLeft: 'auto' },
});

// ═══════════════════════════════════════════════════════════
// BAR CHART  (vertical)
// ═══════════════════════════════════════════════════════════
const BAR_DATA = [
  { label: 'Needs',   val: 55, color: BLUE  },
  { label: 'Wants',   val: 38, color: BLUE  },
  { label: 'Savings', val: 68, color: GREEN },
  { label: 'Invest',  val: 45, color: GREEN },
];
const BAR_MAX = 80;
const BAR_H   = 130;

function BarChart() {
  return (
    <View>
      {/* Y labels + bars */}
      <View style={{ flexDirection: 'row', height: BAR_H }}>
        {/* Y axis */}
        <View style={{ width: 24, height: BAR_H, justifyContent: 'space-between', alignItems: 'flex-end' }}>
          {[80, 60, 40, 20, 0].map((v) => (
            <Text key={v} style={{ fontSize: 10, color: '#9CA3AF' }}>{v}</Text>
          ))}
        </View>
        {/* Bars */}
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around', paddingBottom: 0 }}>
          {BAR_DATA.map((b) => (
            <View key={b.label} style={{ alignItems: 'center', flex: 1 }}>
              <View style={{
                width: 30,
                height: (b.val / BAR_MAX) * BAR_H,
                backgroundColor: b.color,
                borderRadius: 6,
              }} />
            </View>
          ))}
        </View>
      </View>
      {/* X labels */}
      <View style={{ flexDirection: 'row', paddingLeft: 24, marginTop: 4 }}>
        {BAR_DATA.map((b) => (
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
// MAIN DASHBOARD SCREEN
// ═══════════════════════════════════════════════════════════
export function DashboardScreen(): React.ReactElement {
  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

      {/* Row 1 */}
      <View style={s.row}>
        <View style={{ flex: 1 }}>
          <Card title="Savings Score" info>
            <SavingsGauge score={5} max={100} />
          </Card>
        </View>
        <View style={{ flex: 1 }}>
          <Card title="Wants vs Needs">
            <WantsNeedsChart />
          </Card>
        </View>
      </View>

      {/* Goal Progress – full width */}
      <Card title="Goal Progress" info>
        <GoalProgress />
      </Card>

      {/* Row 2 */}
      <View style={s.row}>
        <View style={{ flex: 1 }}>
          <Card title="Line Graph">
            <Text style={s.chartSub}>Daily Transaction Spending as Ceiling</Text>
            <LineGraph />
          </Card>
        </View>
        <View style={{ flex: 1 }}>
          <Card title="Donut Chart">
            <DonutRing />
          </Card>
        </View>
      </View>

      {/* Bar Chart – full width */}
      <Card title="Bar Chart">
        <Text style={s.chartSub}>Needs / Wants / Savings / Invest</Text>
        <BarChart />
      </Card>

      {/* Prediction Banner */}
      <View style={s.banner}>
        <Text style={s.bannerIcon}>⚠️</Text>
        <Text style={s.bannerText}>
          <Text style={s.bannerBold}>Prediction: </Text>
          You are on track to exceed your 'Want' budget by{' '}
          <Text style={s.bannerHighlight}>$150</Text> this month.
        </Text>
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
    backgroundColor: '#FFFBEB',
    borderWidth: 1.5,
    borderColor: '#FCD34D',
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    gap: 10,
  },
  bannerIcon:      { fontSize: 20 },
  bannerText:      { flex: 1, fontSize: 13, color: '#92400E', lineHeight: 20 },
  bannerBold:      { fontWeight: '700', color: '#78350F' },
  bannerHighlight: { fontWeight: '800', color: '#92400E' },
});
