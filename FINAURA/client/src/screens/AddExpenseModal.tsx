import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { useFinanceStore } from '../store/useFinanceStore';

const CATEGORIES = ['food', 'groceries', 'rent', 'bills', 'medicine', 'travel', 'party', 'shopping', 'education', 'gym', 'gold', 'silver', 'sip', 'investment', 'emergency', 'family', 'client meeting', 'office tools', 'entertainment', 'subscriptions', 'others'];

export function AddExpenseModal({ visible, onClose }: { visible: boolean; onClose: () => void }): React.ReactElement {
  const { addExpense } = useFinanceStore();
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [description, setDescription] = useState('');

  const submit = async () => {
    await addExpense({ amount: Number(amount), category, description, timestamp: new Date().toISOString() });
    setAmount('');
    setDescription('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Add Expense</Text>
          <TextInput style={styles.input} placeholder="Amount" keyboardType="number-pad" value={amount} onChangeText={setAmount} />
          <TextInput style={styles.input} placeholder="Category" value={category} onChangeText={setCategory} />
          <TextInput style={styles.input} placeholder="Description" value={description} onChangeText={setDescription} />

          <View style={styles.row}>
            <TouchableOpacity style={styles.cancel} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.save} onPress={submit}>
              <Text style={styles.saveText}>Save</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.hint}>Categories: {CATEGORIES.slice(0, 6).join(', ')}...</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', padding: 16, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  title: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 10 },
  input: { height: 44, borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', paddingHorizontal: 12, marginBottom: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  cancel: { flex: 1, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center', marginRight: 8 },
  save: { flex: 1, padding: 10, borderRadius: 8, backgroundColor: '#3B3BDE', alignItems: 'center' },
  cancelText: { color: '#111827', fontWeight: '700' },
  saveText: { color: '#fff', fontWeight: '700' },
  hint: { fontSize: 10, color: '#6B7280', marginTop: 8 }
});
