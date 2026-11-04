import React from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { FamilyMemberBreakdown } from '../../types';
import { formatCurrency } from '../../utils/format';
import { createStyles, useTheme } from '../../theme';

const signed = (n: number) => `${n > 0 ? '+' : ''}${n.toFixed(1)}`;
const initials = (name: string) => name.trim().split(/\s+/).map((w) => w.charAt(0).toUpperCase()).slice(0, 2).join('');

/** Who contributes how much to the family score (Shapley points) and the household metrics. */
export function FamilyMemberBreakdownCard({ breakdown, familyScore }: { breakdown?: FamilyMemberBreakdown; familyScore: number }) {
  const { c } = useTheme();
  const styles = useStyles();
  if (!breakdown || breakdown.members.length === 0) return null;
  const positive = breakdown.members.reduce((s, m) => s + Math.max(0, m.score.points), 0);
  const color = (i: number) => c.chart[i % c.chart.length];

  return (
    <View style={styles.card} accessibilityLabel="Member contributions">
      <View style={styles.headerRow}>
        <View style={[styles.iconWrap, { backgroundColor: c.purpleSoft }]}>
          <Ionicons name="people-outline" size={18} color={c.purple} />
        </View>
        <Text style={styles.heading}>Who contributes what</Text>
      </View>
      <Text style={styles.sub}>
        Each member's points of the family score ({familyScore}), from Shapley values: the household is re-scored with and
        without each member. Points add up to the score.
        {!breakdown.viewerCanSeeAllAmounts ? ' Only the owner sees other members’ rupee amounts.' : ''}
      </Text>

      {positive > 0 && (
        <View style={styles.bar}>
          {breakdown.members.map((m, i) =>
            m.score.points > 0 ? (
              <View key={m.userId} style={{ flex: m.score.points / positive, backgroundColor: color(i) }} />
            ) : null,
          )}
        </View>
      )}

      {breakdown.members.map((m, i) => (
        <View key={m.userId} style={styles.row}>
          <View style={styles.rowHead}>
            <View style={[styles.avatar, { backgroundColor: color(i) }]}>
              <Text style={styles.avatarText}>{initials(m.name)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>
                {m.name}
                {m.isYou ? <Text style={styles.muted}> (you)</Text> : null}
              </Text>
              <Text style={styles.muted}>
                Saving {signed(m.score.pillars.D1)} · Spending {signed(m.score.pillars.D2)} · Behaviour {signed(m.score.pillars.D3)}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.points}>{signed(m.score.points)}</Text>
              <Text style={styles.muted}>{m.score.pctOfScore}% of score</Text>
            </View>
          </View>

          <View style={styles.metrics}>
            {[
              ['Income', m.shares.incomePct, m.amounts?.effectiveIncome],
              ['Needs', m.shares.needPct, m.amounts?.need],
              ['Wants', m.shares.wantPct, m.amounts?.want],
              ['Invested', m.shares.investmentPct, m.amounts?.investment],
            ].map(([label, pct, amount]) => (
              <View key={label as string} style={styles.metric}>
                <Text style={styles.muted}>{label as string}</Text>
                <Text style={styles.metricValue}>{pct as number}%</Text>
                {amount !== undefined ? <Text style={styles.muted}>{formatCurrency(amount as number)}</Text> : null}
              </View>
            ))}
          </View>

          {m.amounts && m.amounts.topCategories.length > 0 ? (
            <Text style={[styles.muted, { marginTop: 6 }]}>
              Net cash {formatCurrency(m.amounts.netCash)} · Top: {m.amounts.topCategories.map((t) => t.category).join(', ')}
            </Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

const useStyles = createStyles((c) => ({
  card: { backgroundColor: c.surface, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: c.border },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconWrap: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  heading: { fontSize: 15, fontWeight: '700', color: c.text },
  sub: { fontSize: 12, color: c.textMuted, marginTop: 8, lineHeight: 17 },
  bar: { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', backgroundColor: c.surfaceAlt, marginTop: 12 },
  row: { marginTop: 12, padding: 12, borderRadius: 12, backgroundColor: c.surfaceAlt },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#FFFFFF', fontWeight: '700', fontSize: 12 },
  name: { fontSize: 14, fontWeight: '600', color: c.text },
  muted: { fontSize: 11, color: c.textMuted },
  points: { fontSize: 18, fontWeight: '700', color: c.text },
  metrics: { flexDirection: 'row', marginTop: 10, gap: 8 },
  metric: { flex: 1 },
  metricValue: { fontSize: 13, fontWeight: '600', color: c.text },
}));
