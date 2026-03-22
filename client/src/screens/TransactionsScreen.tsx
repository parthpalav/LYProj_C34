import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { getTransactions } from '../services/api';
import { useStore } from '../store/useStore';
import { Transaction } from '../types';
import { formatCurrency } from '../utils/format';

const categories = ['all', 'food', 'travel', 'bills', 'shopping'];

export function TransactionsScreen(): JSX.Element {
  const { transactions, setTransactions } = useStore();
  const [activeCategory, setActiveCategory] = useState('all');

  useEffect(() => {
    getTransactions().then(setTransactions).catch(console.error);
  }, [setTransactions]);

  const filtered = useMemo(() => {
    if (activeCategory === 'all') {
      return transactions;
    }
    return transactions.filter((tx: Transaction) => tx.category === activeCategory);
  }, [activeCategory, transactions]);

  const renderItem = ({ item }: { item: Transaction }) => (
    <View style={[styles.row, item.isAnomaly && styles.anomaly]}>
      <View>
        <Text style={styles.category}>{item.category.toUpperCase()}</Text>
        <Text style={styles.sentiment}>{item.sentiment}</Text>
      </View>
      <Text style={styles.amount}>{formatCurrency(item.amount)}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.filters}>
        {categories.map((cat) => (
          <Pressable
            key={cat}
            onPress={() => setActiveCategory(cat)}
            style={[styles.filterChip, activeCategory === cat && styles.activeChip]}
          >
            <Text style={activeCategory === cat ? styles.activeText : styles.filterText}>{cat}</Text>
          </Pressable>
        ))}
      </View>

      <FlatList data={filtered} renderItem={renderItem} keyExtractor={(item: Transaction) => item.id} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', padding: 16 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12, gap: 8 },
  filterChip: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, backgroundColor: '#e2e8f0' },
  activeChip: { backgroundColor: '#0f766e' },
  filterText: { color: '#334155' },
  activeText: { color: '#ffffff' },
  row: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  anomaly: { borderWidth: 1, borderColor: '#f97316' },
  category: { fontWeight: '700' },
  sentiment: { color: '#64748b' },
  amount: { fontWeight: '700' }
});
