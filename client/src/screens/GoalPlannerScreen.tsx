import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal,
  TextInput, KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
  RefreshControl, Vibration, Animated, Easing, Keyboard, TouchableWithoutFeedback
} from 'react-native';
import { getGoals, createGoal, deleteGoal } from '../services/api';
import { useStore } from '../store/useStore';
import { Goal } from '../types';

const TABS = ['Active', 'Goals', 'Relative'] as const;
type Tab = (typeof TABS)[number];

const BLUE  = '#3B3BDE';
const GREEN = '#22C880';
const RED   = '#EF4444';

function AddGoalModal({
  visible, onClose, onAdd,
}: {
  visible: boolean; onClose: () => void; onAdd: () => void;
}) {
  const [name,         setName]         = useState('');
  const [emoji,        setEmoji]        = useState('🎯');
  const [target,       setTarget]       = useState('');
  const [date,         setDate]         = useState('');
  const [contribution, setContribution] = useState('');
  const [saving,       setSaving]       = useState(false);

  const handleAdd = async () => {
    if (!name.trim() || !target.trim()) {
      Alert.alert('Missing fields', 'Please fill in Goal Name and Target Amount.');
      return;
    }
    setSaving(true);
    try {
      await createGoal({
        name: name.trim(),
        emoji,
        targetAmount: Number(target),
        targetDate: date,
        monthlyContribution: Number(contribution) || 0,
      });
      setName(''); setTarget(''); setDate(''); setContribution('');
      Vibration.vibrate(50); // Haptic feedback on success
      onAdd();
      onClose();
    } catch {
      Alert.alert('Error', 'Failed to save goal.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={m.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <TouchableOpacity style={m.backdrop} activeOpacity={1} onPress={onClose} />
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={m.sheet}>
          <View style={m.dragHandle} />
          <Text style={m.sheetTitle}>Add New Goal</Text>

          <Text style={m.label}>Goal Name *</Text>
          <TextInput style={m.input} value={name} onChangeText={setName} placeholder="e.g. House Down Payment" placeholderTextColor="#9CA3AF" />

          <Text style={m.label}>Emoji Icon</Text>
          <View style={m.emojiRow}>
            {['🏠','🚗','✈️','🎓','🎯','💍','🌴','💰'].map((e) => (
              <TouchableOpacity key={e} style={[m.emojiBtn, emoji === e && m.emojiBtnActive]} onPress={() => setEmoji(e)}>
                <Text style={m.emojiTxt}>{e}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={m.label}>Target Amount *</Text>
          <TextInput style={m.input} value={target} onChangeText={setTarget} placeholder="e.g. 50000" placeholderTextColor="#9CA3AF" keyboardType="numeric" />

          <Text style={m.label}>Target Date</Text>
          <TextInput style={m.input} value={date} onChangeText={setDate} placeholder="e.g. December 2030" placeholderTextColor="#9CA3AF" />

          <Text style={m.label}>Monthly Contribution</Text>
          <TextInput style={m.input} value={contribution} onChangeText={setContribution} placeholder="e.g. 500" placeholderTextColor="#9CA3AF" keyboardType="numeric" />

          <TouchableOpacity style={m.addBtn} onPress={handleAdd} activeOpacity={0.85} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={m.addBtnTxt}>Add Goal</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={m.cancelBtn} onPress={onClose}>
            <Text style={m.cancelTxt}>Cancel</Text>
          </TouchableOpacity>
        </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const m = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40 },
  dragHandle: { width: 40, height: 4, backgroundColor: '#E2E8F0', borderRadius: 99, alignSelf: 'center', marginBottom: 18 },
  sheetTitle: { fontSize: 20, fontWeight: '800', color: '#111827', marginBottom: 20 },
  label: { fontSize: 12, fontWeight: '600', color: '#6B7280', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { height: 48, borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 14, fontSize: 15, color: '#111827', backgroundColor: '#FAFAFA', marginBottom: 14 },
  emojiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  emojiBtn: { width: 44, height: 44, borderRadius: 12, borderWidth: 1.5, borderColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FAFAFA' },
  emojiBtnActive: { borderColor: BLUE, backgroundColor: '#EEF2FF' },
  emojiTxt: { fontSize: 22 },
  addBtn: { height: 52, borderRadius: 26, backgroundColor: BLUE, alignItems: 'center', justifyContent: 'center', marginTop: 4, shadowColor: BLUE, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
  addBtnTxt: { fontSize: 16, fontWeight: '700', color: '#fff' },
  cancelBtn: { height: 44, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  cancelTxt: { fontSize: 14, color: '#9CA3AF', fontWeight: '500' },
});

export function GoalPlannerScreen(): React.ReactElement {
  const { goals, setGoals } = useStore();
  const [activeTab,    setActiveTab]    = useState<Tab>('Active');
  const [selectedId,   setSelectedId]   = useState<string | null>(null);
  const [showAdd,      setShowAdd]      = useState(false);
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  
  // Animation value for card selection
  const scaleAnim = useState(new Animated.Value(1))[0];
  
  const handleSelectGoal = (id: string) => {
    setSelectedId(id);
    Vibration.vibrate(20); // Light haptic
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.96, duration: 50, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 100, useNativeDriver: true, easing: Easing.bounce })
    ]).start();
  };

  const fetchGoals = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      const data = await getGoals();
      setGoals(data);
      if (data.length > 0 && !selectedId) {
        setSelectedId(data[0].id);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, [setGoals, selectedId]);

  useEffect(() => { fetchGoals(); }, [fetchGoals]);

  const selected = goals.find((g) => g.id === selectedId) ?? goals[0];

  const handleDelete = (id: string) => {
    Alert.alert('Delete Goal', 'Are you sure you want to remove this goal?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await deleteGoal(id);
            Vibration.vibrate([0, 50, 50, 50]); // Heavy haptic feedback for deletion
            fetchGoals(true);
          } catch (e) { Alert.alert('Error', 'Failed to delete goal.'); }
        },
      },
    ]);
  };

  const calculateGoalLogic = (g: Goal) => {
    // Math to guess required stuff based on backend fields
    // Assuming simple calculation without real dates for now
    const shortfallAmt = Math.max(0, g.targetAmount - g.savedAmount);
    const monthsEstim  = 12; // Placeholder
    const requiredMonthly = shortfallAmt > 0 ? shortfallAmt / monthsEstim : 0;
    const isAchievable = g.monthlyContribution >= requiredMonthly;
    const diff = (g.monthlyContribution - requiredMonthly);

    return {
      allocation: `₹${g.savedAmount.toLocaleString()}`,
      contribution: `₹${g.monthlyContribution.toLocaleString()}`,
      achievable: isAchievable,
      requiredMonthly: `₹${Math.round(requiredMonthly).toLocaleString()}`,
      shortfall: isAchievable ? '₹0/mo' : `-₹${Math.round(Math.abs(diff)).toLocaleString()}/mo`,
      recommendation: isAchievable ? 'Keep contributing consistently.' : `Increase contribution by ₹${Math.round(Math.abs(diff)).toLocaleString()}/mo.`,
    };
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#F4F6FA', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={BLUE} />
      </View>
    );
  }

  return (
    <View style={s.screen}>
      <View style={s.tabBar}>
        {TABS.map((t) => (
          <TouchableOpacity key={t} style={s.tabItem} onPress={() => setActiveTab(t)} activeOpacity={0.8}>
            <Text style={[s.tabText, activeTab === t && s.tabTextActive]}>{t}</Text>
            {activeTab === t && <View style={s.tabUnderline} />}
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={s.body} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchGoals(true)} tintColor={BLUE} />}
      >
        <View style={s.columns}>
          <View style={s.leftCol}>
            {goals.map((g) => (
              <TouchableOpacity
                key={g.id}
                style={[s.goalChip, selectedId === g.id && s.goalChipActive]}
                onPress={() => handleSelectGoal(g.id)}
                onLongPress={() => handleDelete(g.id)}
                activeOpacity={0.8}
              >
                <Text style={s.goalEmoji}>{g.emoji}</Text>
                <Text style={[s.goalName, selectedId === g.id && s.goalNameActive]}>{g.name}</Text>
              </TouchableOpacity>
            ))}

            <TouchableOpacity style={s.addGoalBtn} onPress={() => setShowAdd(true)} activeOpacity={0.8}>
              <Text style={s.addGoalIcon}>＋</Text>
              <Text style={s.addGoalTxt}>Add Goal</Text>
            </TouchableOpacity>
          </View>

          <Animated.View style={[s.rightCol, { transform: [{ scale: scaleAnim }] }]}>
            {selected ? (() => {
              const l = calculateGoalLogic(selected);
              return (
                <>
                  <View style={s.detailCard}>
                  <Text style={s.detailTitle}>{selected.name} Fund</Text>

                  <View style={s.detailRow}><Text style={s.detailLabel}>Target:</Text><Text style={s.detailValue}>₹{selected.targetAmount.toLocaleString()}</Text></View>
                  <View style={s.detailRow}><Text style={s.detailLabel}>Date:</Text><Text style={s.detailValue}>{selected.targetDate || 'Not set'}</Text></View>
                  <View style={[s.detailRow, { flexWrap: 'wrap', gap: 4 }]}><Text style={s.detailLabel}>Saved:</Text><Text style={s.detailValue}>{l.allocation}</Text><Text style={[s.detailLabel, { marginLeft: 8 }]}>Contribution:</Text><Text style={s.detailValue}>{l.contribution || 'Not set'}</Text></View>

                  <View style={s.achievableRow}>
                    <Text style={s.achievableQ}>Is this achievable?</Text>
                    <View style={[s.achievableBadge, !l.achievable && s.achievableBadgeNo]}><Text style={s.achievableTxt}>{l.achievable ? 'YES' : 'NO'}</Text></View>
                  </View>
                </View>

                <Text style={s.arrow}>↓</Text>

                <View style={s.statsCard}>
                  <View style={s.statItem}><Text style={s.statLabel}>Required Monthly</Text><Text style={s.statValue}>{l.requiredMonthly}</Text></View>
                  <View style={s.statDivider} />
                  <View style={s.statItem}><Text style={s.statLabel}>predicted shortfall</Text><Text style={[s.statValue, { color: l.achievable ? GREEN : RED }]}>{l.shortfall}</Text></View>
                  <View style={s.statDivider} />
                  <View style={[s.statItem, s.statItemGreen, !l.achievable && s.statItemRed]}><Text style={s.statLabel}>recommended changes</Text><Text style={[s.statValue, { color: l.achievable ? '#065F46' : '#991B1B', fontSize: 13 }]}>{l.recommendation}</Text></View>
                </View>
              </>
              );
            })() : (
              <View style={s.emptyRight}><Text style={s.emptyTxt}>Select a goal to view details</Text></View>
            )}
          </Animated.View>
        </View>
      </ScrollView>

      <AddGoalModal visible={showAdd} onClose={() => setShowAdd(false)} onAdd={() => fetchGoals(true)} />
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F6FA' },
  tabBar: { flexDirection: 'row', backgroundColor: '#fff', paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#E8ECF2' },
  tabItem: { marginRight: 28, paddingVertical: 14, position: 'relative' },
  tabText: { fontSize: 15, fontWeight: '600', color: '#9CA3AF' },
  tabTextActive: { color: '#111827' },
  tabUnderline: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 2.5, backgroundColor: BLUE, borderRadius: 99 },
  body: { padding: 16, paddingBottom: 40 },
  columns: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  leftCol: { width: 130, gap: 10 },
  goalChip: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 12, backgroundColor: '#fff', borderRadius: 16, borderWidth: 1.5, borderColor: '#E8ECF2', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  goalChipActive: { borderColor: BLUE, backgroundColor: '#EEF2FF' },
  goalEmoji: { fontSize: 18 },
  goalName: { fontSize: 13, fontWeight: '600', color: '#374151', flexShrink: 1 },
  goalNameActive: { color: BLUE },
  addGoalBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 16, borderWidth: 1.5, borderColor: '#D1D5DB', borderStyle: 'dashed', backgroundColor: '#FAFAFA' },
  addGoalIcon: { fontSize: 16, color: '#6B7280' },
  addGoalTxt: { fontSize: 12, fontWeight: '600', color: '#6B7280' },
  rightCol: { flex: 1, gap: 0 },
  detailCard: { backgroundColor: '#fff', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: '#E8ECF2', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 3 },
  detailTitle: { fontSize: 18, fontWeight: '800', color: '#111827', marginBottom: 12 },
  detailRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 4 },
  detailLabel: { fontSize: 13, color: '#6B7280', fontWeight: '500' },
  detailValue: { fontSize: 13, fontWeight: '700', color: '#111827' },
  achievableRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, flexWrap: 'wrap' },
  achievableQ: { fontSize: 13, color: '#374151', fontWeight: '500' },
  achievableBadge: { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 99, backgroundColor: GREEN },
  achievableBadgeNo: { backgroundColor: RED },
  achievableTxt: { fontSize: 13, fontWeight: '800', color: '#fff' },
  arrow: { textAlign: 'center', fontSize: 20, color: '#9CA3AF', marginVertical: 10 },
  statsCard: { backgroundColor: '#fff', borderRadius: 20, padding: 14, flexDirection: 'row', borderWidth: 1, borderColor: '#E8ECF2', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 3 },
  statItem: { flex: 1, alignItems: 'flex-start', gap: 4 },
  statItemGreen: { backgroundColor: '#ECFDF5', borderRadius: 12, padding: 6 },
  statItemRed: { backgroundColor: '#FEF2F2' },
  statDivider: { width: 1, backgroundColor: '#E8ECF2', marginHorizontal: 8 },
  statLabel: { fontSize: 10, color: '#6B7280', fontWeight: '500', lineHeight: 14 },
  statValue: { fontSize: 16, fontWeight: '800', color: '#111827' },
  emptyRight: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', borderRadius: 20, borderWidth: 1.5, borderColor: '#E8ECF2', padding: 24 },
  emptyTxt:   { color: '#9CA3AF', fontSize: 13, fontWeight: '500' },
});
