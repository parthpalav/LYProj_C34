import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface Props {
  values: number[];
}

export function SpendingChart({ values }: Props): React.ReactElement {
  const maxValue = Math.max(...values, 1);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Spending Trend</Text>
      <View style={styles.chartRow}>
        {values.map((value, index) => (
          <View key={`${value}-${index}`} style={styles.barWrap}>
            <View style={[styles.bar, { height: `${(value / maxValue) * 100}%` }]} />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12
  },
  title: { fontSize: 16, fontWeight: '700', marginBottom: 10 },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 110
  },
  barWrap: {
    width: 20,
    height: '100%',
    justifyContent: 'flex-end',
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    overflow: 'hidden'
  },
  bar: {
    width: '100%',
    backgroundColor: '#0f766e',
    borderRadius: 8
  }
});
