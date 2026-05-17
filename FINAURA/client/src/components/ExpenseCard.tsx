import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { formatCurrency } from '../utils/formatCurrency';

export function ExpenseCard({ expense }: { expense: any }): React.ReactElement {
  return (
    <View style={styles.card}>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{expense.category}</Text>
        <Text style={styles.sub}>{expense.description || 'No description'}</Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={styles.amount}>{formatCurrency(expense.amount)}</Text>
        <Text style={styles.tag}>{expense.classification}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', padding: 12, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 10 },
  title: { fontWeight: '700', color: '#111827' },
  sub: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  amount: { fontWeight: '800', color: '#111827' },
  tag: { fontSize: 11, fontWeight: '700', color: '#3B82F6', marginTop: 4 }
});
