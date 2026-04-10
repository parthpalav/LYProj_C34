import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, RefreshControl, StyleSheet, Text, TouchableOpacity, View, Alert, TextInput } from 'react-native';
import { getTransactions } from '../services/api';
import { useStore } from '../store/useStore';
import { Transaction } from '../types';
import { formatCurrency } from '../utils/format';
import { TransactionEntryScreen } from './TransactionEntryScreen';
import { updateTransaction, deleteTransaction } from '../services/api';

const categories = ['all', 'food', 'travel', 'bills', 'shopping', 'others'];

export function TransactionsScreen(): React.ReactElement {
  const { transactions, setTransactions } = useStore();
  const [activeCategory, setActiveCategory] = useState('all');
  const [showEntry,      setShowEntry]      = useState(false);
  const [refreshing,     setRefreshing]     = useState(false);
  const [editTx,         setEditTx]         = useState<Transaction | null>(null);
  const [editAmount,     setEditAmount]     = useState('');
  const [editDesc,       setEditDesc]       = useState('');

  const fetchTransactions = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      const data = await getTransactions();
      setTransactions(data);
    } catch (e) {
      console.error(e);
    } finally {
      setRefreshing(false);
    }
  }, [setTransactions]);

  // Initial load
  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // Re-fetch when the entry modal is closed (new tx was submitted)
  useEffect(() => {
    if (!showEntry && !editTx) fetchTransactions();
  }, [showEntry, editTx]);

  const handleTxLongPress = (tx: Transaction) => {
    Alert.alert(
      'Manage Transaction',
      `What would you like to do with "${tx.description}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Edit', 
          onPress: () => {
            setEditTx(tx);
            setEditAmount(String(Math.abs(tx.amount)));
            setEditDesc(tx.description || '');
          } 
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteTransaction(tx.id);
              fetchTransactions();
            } catch (e) { Alert.alert('Error', 'Failed to delete transaction'); }
          }
        }
      ]
    );
  };

  const submitEdit = async () => {
    if (!editTx) return;
    const parsedAmt = parseFloat(editAmount);
    if (isNaN(parsedAmt) || parsedAmt <= 0) {
      Alert.alert('Error', 'Valid amount required');
      return;
    }
    try {
      // Keep sign if it was an expense
      const isExpense = editTx.amount < 0;
      await updateTransaction(editTx.id, {
        amount: isExpense ? -parsedAmt : parsedAmt,
        description: editDesc,
      });
      setEditTx(null);
      fetchTransactions();
    } catch (e) {
      Alert.alert('Error', 'Failed to update transaction');
    }
  };

  const renderItem = ({ item }: { item: Transaction }) => {
    const isExpense = item.amount < 0;
    const sign = isExpense ? '-' : '+';
    const displayAmount = `${sign}${formatCurrency(Math.abs(item.amount))}`;
    let icon = '🍔';
    if (item.category === 'travel') icon = '🚕';
    if (item.category === 'shopping') icon = '🛍️';
    if (item.category === 'health') icon = '💊';

    let sentimentColor = '#D1D5DB';
    if (item.sentiment === 'positive') sentimentColor = '#34D399';
    if (item.sentiment === 'negative') sentimentColor = '#F87171';
    if (item.tags?.includes('impulse')) sentimentColor = '#FBBF24';

    return (
      <TouchableOpacity 
        style={styles.card} 
        activeOpacity={0.7} 
        onLongPress={() => handleTxLongPress(item)}
      >
        <View style={styles.iconBox}>
          <Text style={styles.iconText}>{icon}</Text>
        </View>
        <View style={styles.details}>
          <Text style={styles.desc}>{item.description}</Text>
          <Text style={styles.date}>{new Date(item.timestamp).toLocaleDateString()} at {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
          {item.tags && item.tags.length > 0 && (
            <View style={{ flexDirection: 'row', gap: 4, marginTop: 4 }}>
              {item.tags.map((t) => (
                <View key={t} style={{ backgroundColor: '#F3F4F6', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                  <Text style={{ fontSize: 10, color: '#4B5563', textTransform: 'uppercase' }}>{t}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[styles.amount, !isExpense && styles.income]}>
            {displayAmount}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: sentimentColor }} />
            <Text style={{ fontSize: 10, color: '#6B7280' }}>{item.sentiment}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const filtered = useMemo(() => {
    if (activeCategory === 'all') {
      return transactions;
    }
    return transactions.filter((tx: Transaction) => tx.category === activeCategory);
  }, [activeCategory, transactions]);

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

      <FlatList
        data={filtered}
        renderItem={renderItem}
        keyExtractor={(item: Transaction) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchTransactions(true)}
            tintColor="#3B3BDE"
            colors={['#3B3BDE']}
          />
        }
      />

      {/* Floating Add Button */}
      <TouchableOpacity style={styles.fab} onPress={() => setShowEntry(true)} activeOpacity={0.85}>
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>

      {/* Transaction Entry Modal */}
      <Modal visible={showEntry} transparent animationType="slide" onRequestClose={() => setShowEntry(false)}>
        <TransactionEntryScreen onClose={() => setShowEntry(false)} />
      </Modal>

      {/* Quick Edit Modal */}
      <Modal visible={!!editTx} transparent animationType="fade" onRequestClose={() => setEditTx(null)}>
        <View style={styles.editOverlay}>
          <View style={styles.editCard}>
            <Text style={styles.editTitle}>Edit Transaction</Text>
            
            <Text style={styles.label}>Amount</Text>
            <TextInput 
              style={styles.input} 
              value={editAmount} 
              onChangeText={setEditAmount} 
              keyboardType="numeric" 
            />
            
            <Text style={styles.label}>Description</Text>
            <TextInput 
              style={styles.input} 
              value={editDesc} 
              onChangeText={setEditDesc} 
            />

            <View style={styles.editActions}>
              <TouchableOpacity onPress={() => setEditTx(null)} style={[styles.editBtn, { backgroundColor: '#E2E8F0' }]}>
                <Text style={{ color: '#475569', fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={submitEdit} style={[styles.editBtn, { backgroundColor: '#3B3BDE' }]}>
                <Text style={{ color: '#fff', fontWeight: '600' }}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
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
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f1f5f9'
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12
  },
  iconText: { fontSize: 20 },
  details: { flex: 1, justifyContent: 'center' },
  desc: { fontSize: 14, fontWeight: '600', color: '#1e293b', marginBottom: 2 },
  date: { fontSize: 11, color: '#64748b' },
  amount: { fontSize: 15, fontWeight: '700', color: '#1e293b' },
  income: { color: '#10b981' },
  anomaly: { borderWidth: 1, borderColor: '#f97316' },
  category: { fontWeight: '700' },
  sentiment: { color: '#64748b' },
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
  editOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  editCard: { backgroundColor: '#fff', padding: 24, borderRadius: 16, elevation: 10, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, shadowOffset: { width:0, height:4 } },
  editTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16, textAlign: 'center' },
  label: { fontSize: 12, fontWeight: '600', color: '#64748B', marginBottom: 4 },
  input: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 16 },
  editActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  editBtn: { flex: 1, padding: 14, borderRadius: 8, alignItems: 'center' }
});
