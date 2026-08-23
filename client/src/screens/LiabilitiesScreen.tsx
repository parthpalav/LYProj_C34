import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, TextInput, Switch, KeyboardAvoidingView, Platform, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getLiabilities, createLiability, updateLiability, deleteLiability } from '../services/api';

const VALID_CATEGORIES = ['Food', 'Travel', 'Entertainment', 'Shopping', 'Bills', 'Groceries', 'Health', 'Party', 'Education', 'Misc'];
const VALID_TYPES = ['Need', 'Want', 'Investment'];
const FREQUENCIES = ['daily', 'weekly', 'monthly', 'yearly'];

export function LiabilitiesScreen() {
  const [liabilities, setLiabilities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Bills');
  const [type, setType] = useState('Need');
  const [autoDeduct, setAutoDeduct] = useState(false);
  const [frequency, setFrequency] = useState('monthly');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [dayOfWeek, setDayOfWeek] = useState('0');
  const [dayOfMonth, setDayOfMonth] = useState('1');
  const [monthOfYear, setMonthOfYear] = useState('1');

  const fetchData = async () => {
    try {
      setLoading(true);
      const data = await getLiabilities();
      setLiabilities(data);
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to fetch liabilities');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openAddModal = () => {
    setEditingId(null);
    setName('');
    setAmount('');
    setCategory('Bills');
    setType('Need');
    setAutoDeduct(false);
    setFrequency('monthly');
    setStartDate(new Date().toISOString().split('T')[0]);
    setDayOfWeek('0');
    setDayOfMonth('1');
    setMonthOfYear('1');
    setModalVisible(true);
  };

  const openEditModal = (liability: any) => {
    setEditingId(liability.id);
    setName(liability.name);
    setAmount(String(liability.amount));
    setCategory(liability.category);
    setType(liability.type);
    setAutoDeduct(liability.autoDeduct);
    setFrequency(liability.frequency);
    setStartDate(liability.startDate.split('T')[0]);
    setDayOfWeek(String(liability.dayOfWeek || 0));
    setDayOfMonth(String(liability.dayOfMonth || 1));
    setMonthOfYear(String(liability.monthOfYear || 1));
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!name || !amount || isNaN(Number(amount))) {
      Alert.alert('Error', 'Please enter a valid name and amount.');
      return;
    }

    const payload: any = {
      name,
      amount: Number(amount),
      category,
      type,
      autoDeduct,
      frequency,
      startDate: new Date(startDate).toISOString()
    };

    if (frequency === 'weekly') payload.dayOfWeek = Number(dayOfWeek);
    if (frequency === 'monthly') payload.dayOfMonth = Number(dayOfMonth);
    if (frequency === 'yearly') {
      payload.dayOfMonth = Number(dayOfMonth);
      payload.monthOfYear = Number(monthOfYear);
    }

    try {
      if (editingId) {
        await updateLiability(editingId, payload);
      } else {
        await createLiability(payload);
      }
      setModalVisible(false);
      fetchData();
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to save liability');
    }
  };

  const handleDelete = async (id: string) => {
    Alert.alert('Delete Liability', 'Are you sure you want to remove this liability?', [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Delete', 
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteLiability(id);
            fetchData();
          } catch (e) {
            console.error(e);
            Alert.alert('Error', 'Failed to delete liability');
          }
        }
      }
    ]);
  };

  if (loading && !liabilities.length) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#3B3BDE" />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Liabilities</Text>
          <TouchableOpacity style={styles.addBtn} onPress={openAddModal}>
            <Ionicons name="add" size={20} color="#fff" />
            <Text style={styles.addBtnText}>Add</Text>
          </TouchableOpacity>
        </View>

        {liabilities.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={48} color="#9CA3AF" />
            <Text style={styles.emptyTitle}>No Liabilities Yet</Text>
            <Text style={styles.emptyDesc}>Add your recurring expenses like rent, EMI, or subscriptions.</Text>
          </View>
        ) : (
          liabilities.map((item) => (
            <View key={item.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardName}>{item.name}</Text>
                <Text style={styles.cardAmount}>₹{item.amount.toLocaleString()}</Text>
              </View>
              <Text style={styles.cardMeta}>{item.category} • {item.type}</Text>
              
              <View style={styles.scheduleRow}>
                <Ionicons name="repeat" size={16} color="#6B7280" />
                <Text style={styles.scheduleText}>
                  {item.frequency} {item.autoDeduct ? '• Auto Deduct ON' : '• Auto Deduct OFF'}
                </Text>
              </View>
              
              {item.autoDeduct && item.nextDueDate && (
                <View style={styles.scheduleRow}>
                  <Ionicons name="calendar" size={16} color="#3B3BDE" />
                  <Text style={[styles.scheduleText, { color: '#3B3BDE', fontWeight: '600' }]}>
                    Next Due: {new Date(item.nextDueDate).toLocaleDateString()}
                  </Text>
                </View>
              )}

              <View style={styles.cardActions}>
                <TouchableOpacity style={styles.actionBtn} onPress={() => openEditModal(item)}>
                  <Ionicons name="pencil" size={16} color="#4B5563" />
                  <Text style={styles.actionText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn} onPress={() => handleDelete(item.id)}>
                  <Ionicons name="trash" size={16} color="#EF4444" />
                  <Text style={[styles.actionText, { color: '#EF4444' }]}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingId ? 'Edit Liability' : 'Add Liability'}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={28} color="#111827" />
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Name (e.g. Rent)</Text>
              <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Rent" />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Amount (₹)</Text>
              <TextInput style={styles.input} value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder="25000" />
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.label}>Category</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {VALID_CATEGORIES.map(c => (
                    <TouchableOpacity key={c} style={[styles.chip, category === c && styles.chipActive]} onPress={() => setCategory(c)}>
                      <Text style={[styles.chipText, category === c && styles.chipTextActive]}>{c}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.label}>Type</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {VALID_TYPES.map(t => (
                    <TouchableOpacity key={t} style={[styles.chip, type === t && styles.chipActive]} onPress={() => setType(t)}>
                      <Text style={[styles.chipText, type === t && styles.chipTextActive]}>{t}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>

            <View style={styles.switchGroup}>
              <View>
                <Text style={styles.label}>Auto Deduct</Text>
                <Text style={styles.helperText}>Automatically create transactions</Text>
              </View>
              <Switch value={autoDeduct} onValueChange={setAutoDeduct} trackColor={{ true: '#3B3BDE' }} />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Frequency</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {FREQUENCIES.map(f => (
                  <TouchableOpacity key={f} style={[styles.chip, frequency === f && styles.chipActive]} onPress={() => setFrequency(f)}>
                    <Text style={[styles.chipText, frequency === f && styles.chipTextActive]}>{f}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Start Date (YYYY-MM-DD)</Text>
              <TextInput style={styles.input} value={startDate} onChangeText={setStartDate} placeholder="YYYY-MM-DD" />
            </View>

            {frequency === 'weekly' && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Day of Week (0=Sun, 6=Sat)</Text>
                <TextInput style={styles.input} value={dayOfWeek} onChangeText={setDayOfWeek} keyboardType="numeric" />
              </View>
            )}

            {(frequency === 'monthly' || frequency === 'yearly') && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Day of Month (1-31)</Text>
                <TextInput style={styles.input} value={dayOfMonth} onChangeText={setDayOfMonth} keyboardType="numeric" />
              </View>
            )}

            {frequency === 'yearly' && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Month of Year (1-12)</Text>
                <TextInput style={styles.input} value={monthOfYear} onChangeText={setMonthOfYear} keyboardType="numeric" />
              </View>
            )}

            <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
              <Text style={styles.saveBtnText}>Save Liability</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  screen: { flex: 1, backgroundColor: '#F4F6FA' },
  content: { padding: 16, paddingBottom: 40 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 24, fontWeight: '800', color: '#111827' },
  addBtn: { backgroundColor: '#3B3BDE', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  addBtnText: { color: '#fff', fontWeight: '700', marginLeft: 4 },
  emptyState: { alignItems: 'center', marginTop: 60, padding: 20 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#374151', marginTop: 16, marginBottom: 8 },
  emptyDesc: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 20 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#F0F1F5', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  cardName: { fontSize: 16, fontWeight: '700', color: '#111827', flex: 1 },
  cardAmount: { fontSize: 18, fontWeight: '800', color: '#111827' },
  cardMeta: { fontSize: 13, color: '#6B7280', marginBottom: 12 },
  scheduleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  scheduleText: { fontSize: 13, color: '#4B5563', textTransform: 'capitalize' },
  cardActions: { flexDirection: 'row', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6', gap: 16 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionText: { fontSize: 13, fontWeight: '600', color: '#4B5563' },
  modalContent: { padding: 20, paddingBottom: 60 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontSize: 22, fontWeight: '800', color: '#111827' },
  row: { flexDirection: 'row' },
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8 },
  helperText: { fontSize: 12, color: '#6B7280', marginBottom: 4 },
  input: { height: 48, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 12, paddingHorizontal: 14, fontSize: 16, backgroundColor: '#F9FAFB' },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB', marginRight: 8 },
  chipActive: { backgroundColor: '#EFF6FF', borderColor: '#3B3BDE' },
  chipText: { fontSize: 13, fontWeight: '600', color: '#4B5563' },
  chipTextActive: { color: '#3B3BDE' },
  switchGroup: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, padding: 12, backgroundColor: '#F9FAFB', borderRadius: 12, borderWidth: 1, borderColor: '#F3F4F6' },
  saveBtn: { backgroundColor: '#3B3BDE', height: 52, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginTop: 24 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' }
});
