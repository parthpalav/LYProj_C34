import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import type { MonthlyCommitments } from '../../types';
import { formatCurrency } from '../../utils/format';
import { createStyles } from '../../theme';
import { Sheet } from '../ui/Sheet';

// Keys are YYYY-MM-DD in the user's timezone; noon keeps the label on the same day in any device zone.
const day = (key: string) => new Date(`${key}T12:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

/** Auto-deduct liabilities this month: what is already deducted and what will still come out of the balance. */
export function CommitmentsSheet({ visible, onClose, commitments: c, balance }: {
  visible: boolean;
  onClose: () => void;
  commitments: MonthlyCommitments;
  balance: number;
}) {
  const styles = useStyles();
  return (
    <Sheet visible={visible} onClose={onClose} title="Committed this month">
      <ScrollView style={{ maxHeight: 460 }}>
        <View style={styles.summary}>
          <View style={styles.stat}>
            <Text style={styles.muted}>Still to deduct by {day(c.monthEnd)}</Text>
            <Text style={styles.value}>{formatCurrency(c.remaining)}</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.muted}>Free after bills</Text>
            <Text style={[styles.value, balance - c.remaining < 0 && styles.negative]}>{formatCurrency(balance - c.remaining)}</Text>
          </View>
        </View>
        <Text style={styles.muted}>
          Already deducted {formatCurrency(c.paidSoFar)}
          {Object.entries(c.byType).map(([type, t]) => ` · ${type} ${formatCurrency(t.remaining)} left`).join('')}
        </Text>

        {c.items.length === 0 ? (
          <Text style={[styles.muted, { marginTop: 12 }]}>No auto-deduct liabilities this month.</Text>
        ) : (
          c.items.map((it) => (
            <View key={it.id} style={styles.item}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{it.name} <Text style={styles.muted}>· {it.type}</Text></Text>
                <Text style={styles.muted}>
                  {[...it.paidDates.map((d) => `✓ ${day(d)}`), ...it.dueDates.map(day)].join('  ')}
                </Text>
              </View>
              <Text style={styles.amount}>{it.remainingAmount > 0 ? formatCurrency(it.remainingAmount) : 'Paid'}</Text>
            </View>
          ))
        )}
      </ScrollView>
    </Sheet>
  );
}

const useStyles = createStyles((c) => ({
  summary: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  stat: { flex: 1, padding: 12, borderRadius: 12, backgroundColor: c.surfaceAlt },
  value: { fontSize: 18, fontWeight: '700', color: c.text, marginTop: 2 },
  negative: { color: c.danger },
  muted: { fontSize: 12, color: c.textMuted },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.border },
  name: { fontSize: 14, fontWeight: '600', color: c.text },
  amount: { fontSize: 14, fontWeight: '600', color: c.text },
}));
