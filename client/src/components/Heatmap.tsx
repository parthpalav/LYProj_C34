import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, TouchableOpacity } from 'react-native';
import { getHeatmap } from '../services/api';

function chunkArray<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export function Heatmap(): React.ReactElement {
  const [data, setData] = useState<Array<{ date: string; totalAmount: number }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await getHeatmap();
        setData(res || []);
      } catch (e) {
        setData([]);
      } finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <ActivityIndicator style={{ margin: 12 }} />;

  const max = data.reduce((m, d) => Math.max(m, d.totalAmount || 0), 0) || 1;

  // Render simple grid of squares — break into rows of 7
  const rows = chunkArray(data, 7);

  return (
    <ScrollView style={styles.wrap} horizontal>
      <View style={styles.container}>
        {rows.map((row, i) => (
          <View key={i} style={styles.row}>
            {row.map((cell) => {
              const intensity = Math.min(1, (cell.totalAmount || 0) / max);
              return (
                <TouchableOpacity key={cell.date} style={styles.cellTouchable} activeOpacity={0.8}>
                  <View style={[styles.cell, { backgroundColor: `rgba(59,59,222,${0.15 + intensity * 0.85})` }]} />
                  <Text style={styles.cellLabel}>{cell.date.slice(-5)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { marginVertical: 8 },
  container: { padding: 8 },
  row: { flexDirection: 'column', marginRight: 6 },
  cellTouchable: { alignItems: 'center', marginBottom: 6 },
  cell: { width: 28, height: 28, borderRadius: 4 },
  cellLabel: { fontSize: 9, color: '#6B7280', marginTop: 4 },
});
