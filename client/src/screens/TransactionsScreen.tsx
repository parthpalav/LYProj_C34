import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getTransactions } from '../services/api';
import { useStore } from '../store/useStore';
import { Transaction } from '../types';
import { formatCurrency } from '../utils/format';
import { TransactionEntryScreen } from './TransactionEntryScreen';

const categories = ['all', 'food', 'travel', 'bills', 'shopping'];

export function TransactionsScreen(): React.ReactElement {
  const { transactions, setTransactions } = useStore();
  const [activeCategory, setActiveCategory] = useState('all');
  const [showEntry, setShowEntry] = useState(false);

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

      {/* Floating Add Button */}
      <TouchableOpacity style={styles.fab} onPress={() => setShowEntry(true)} activeOpacity={0.85}>
        <Text style={styles.fabIcon}>＋</Text>
      </TouchableOpacity>

      {/* Transaction Entry Modal */}
      <Modal
        visible={showEntry}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEntry(false)}
      >
        <TransactionEntryScreen onClose={() => setShowEntry(false)} />
      </Modal>
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
  amount: { fontWeight: '700' },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#3B3BDE',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3B3BDE',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 10,
  },
  fabIcon: {
    fontSize: 28,
    color: '#fff',
    lineHeight: 32,
  },
});
