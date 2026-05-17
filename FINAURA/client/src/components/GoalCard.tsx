import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { formatCurrency } from '../utils/formatCurrency';

export function GoalCard({ goal }: { goal: any }): React.ReactElement {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{goal.name}</Text>
      <Text style={styles.amount}>Target: {formatCurrency(goal.targetAmount)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 12, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB' },
  title: { fontWeight: '700', color: '#111827' },
  amount: { fontSize: 12, color: '#6B7280', marginTop: 4 }
});
