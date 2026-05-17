import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useFinanceStore } from '../store/useFinanceStore';
import { ExpenseCard } from '../components/ExpenseCard';
import { AddExpenseModal } from './AddExpenseModal';

export function ExpenseScreen(): React.ReactElement {
  const { expenses, fetchExpenses } = useFinanceStore();
  const [showModal, setShowModal] = useState(false);

  useEffect(() => { fetchExpenses(); }, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Expenses</Text>
        <TouchableOpacity style={styles.btn} onPress={() => setShowModal(true)}>
          <Text style={styles.btnText}>Add Expense</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={{ marginTop: 12 }}>
        {expenses.map((e) => (
          <ExpenseCard key={e._id || e.timestamp} expense={e} />
        ))}
      </ScrollView>

      <AddExpenseModal visible={showModal} onClose={() => setShowModal(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F6FA', padding: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '800', color: '#111827' },
  btn: { backgroundColor: '#3B3BDE', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 12 }
});
