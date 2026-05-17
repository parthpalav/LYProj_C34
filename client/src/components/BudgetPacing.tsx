import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, RefreshControl, ScrollView } from 'react-native';
import { getPacing } from '../services/api';

export function BudgetPacing(): React.ReactElement {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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

  useEffect(() => { load(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (loading) return <ActivityIndicator style={{ margin: 12 }} />;

  const rows = [
    { key: 'Needs', label: 'Needs', color: '#3B82F6' },
    { key: 'Wants', label: 'Wants', color: '#F59E0B' },
    { key: 'Investments', label: 'Invest', color: '#10B981' },
  ];

  return (
    <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 12 },
  row: { marginBottom: 14 },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  label: { fontWeight: '700', color: '#111827' },
  value: { color: '#6B7280', fontWeight: '700' },
  track: { height: 12, backgroundColor: '#F3F4F6', borderRadius: 8, overflow: 'hidden' },
  fill: { height: '100%' },
});
