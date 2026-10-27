import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { getPacing } from '../services/api';

import { createStyles, useTheme } from '../theme';
export function BudgetPacing({ refreshKey }: { refreshKey?: number }): React.ReactElement {
  const { c } = useTheme();
  const styles = useStyles();
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      setLoading(true);
      const res = await getPacing();
      setData(res);
    } catch (e) {
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  // Re-fetch whenever refreshKey changes (parent pull-to-refresh) or on mount
  useEffect(() => { load(); }, [refreshKey]);

  if (loading) return <ActivityIndicator style={{ margin: 12 }} />;

  const rows = [
    { key: 'Needs', label: 'Needs', color: c.primary },
    { key: 'Wants', label: 'Wants', color: c.warning },
    { key: 'Investments', label: 'Invest', color: c.success },
  ];

  return (
    <View style={styles.container}>
      {rows.map((r) => {
        const actual = data?.[r.key]?.actual || 0;
        const limit = data?.[r.key]?.limit || 0;
        const pct = limit > 0 ? Math.min(1, actual / limit) : 0;
        const over = actual > limit;
        return (
          <View key={r.key} style={styles.row}>
            <View style={styles.rowHeader}>
              <Text style={styles.label}>{r.label}</Text>
              <Text style={styles.value}>₹{Math.round(actual)} / ₹{Math.round(limit)}</Text>
            </View>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: over ? '#EF4444' : r.color }]} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

const useStyles = createStyles((c) => ({
  container: { padding: 12 },
  row: { marginBottom: 14 },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  label: { fontWeight: '700', color: c.text },
  value: { color: c.textMuted, fontWeight: '700' },
  track: { height: 12, backgroundColor: c.surfaceAlt, borderRadius: 8, overflow: 'hidden' },
  fill: { height: '100%' },
}));
