import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFinanceStore } from '../store/useFinanceStore';
import { ExpenseCard } from '../components/ExpenseCard';
import { AddExpenseModal } from './AddExpenseModal';

export function ExpenseScreen(): React.ReactElement {
  const insets = useSafeAreaInsets();
  const { expenses, fetchExpenses } = useFinanceStore();
  const [showModal, setShowModal] = useState(false);

  useEffect(() => { fetchExpenses(); }, []);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Expenses</Text>
          <TouchableOpacity style={styles.btn} onPress={() => setShowModal(true)} activeOpacity={0.8}>
            <Text style={styles.btnText}>+ Add Expense</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={{ marginTop: 12 }} showsVerticalScrollIndicator={false}>
          {expenses.map((e) => (
            <ExpenseCard key={e._id || e.timestamp} expense={e} />
          ))}
        </ScrollView>

        <AddExpenseModal visible={showModal} onClose={() => setShowModal(false)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F3F4F6' },
  container: { flex: 1, padding: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 24, fontWeight: '800', color: '#1E293B' },
  btn: { backgroundColor: '#2563EB', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 },
  btnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 }
});
