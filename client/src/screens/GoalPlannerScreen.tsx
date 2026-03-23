import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';

// ── Types ──────────────────────────────────────────────────
interface Goal {
  id: string;
  name: string;
  emoji: string;
  target: string;
  date: string;
  allocation: string;
  contribution: string;
  achievable: boolean;
  requiredMonthly: string;
  shortfall: string;
  recommendation: string;
}

// ── Default goals (only Retirement) ───────────────────────
const DEFAULT_GOALS: Goal[] = [
  {
    id: 'retirement',
    name: 'Retirement',
    emoji: '👤',
    target: '$1M',
    date: 'June 2048',
    allocation: '$140k',
    contribution: '$1,200',
    achievable: true,
    requiredMonthly: '$1,350',
    shortfall: '-$150/mo',
    recommendation: 'Reduce Dining Out by $100.',
  },
];

const TABS = ['Active', 'Goals', 'Relative'] as const;
type Tab = (typeof TABS)[number];

// ── Colours ────────────────────────────────────────────────
const BLUE  = '#3B3BDE';
const GREEN = '#22C880';
const RED   = '#EF4444';

// ═══════════════════════════════════════════════════════════
// ADD GOAL MODAL
// ═══════════════════════════════════════════════════════════
function AddGoalModal({
  visible,
  onClose,
  onAdd,
}: {
  visible: boolean;
  onClose: () => void;
  onAdd: (g: Goal) => void;
}) {
  const [name,         setName]         = useState('');
  const [emoji,        setEmoji]        = useState('🎯');
  const [target,       setTarget]       = useState('');
  const [date,         setDate]         = useState('');
  const [contribution, setContribution] = useState('');

  const handleAdd = () => {
    if (!name.trim() || !target.trim()) {
      Alert.alert('Missing fields', 'Please fill in Goal Name and Target Amount.');
      return;
    }
    onAdd({
      id: Date.now().toString(),
      name: name.trim(),
      emoji,
      target,
      date,
      allocation: 'N/A',
      contribution,
      achievable: true,
      requiredMonthly: contribution || 'TBD',
      shortfall: '$0/mo',
      recommendation: 'Keep contributing consistently.',
    });
    setName(''); setTarget(''); setDate(''); setContribution('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={m.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableOpacity style={m.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={m.sheet}>
          <View style={m.dragHandle} />
          <Text style={m.sheetTitle}>Add New Goal</Text>

          <Text style={m.label}>Goal Name *</Text>
          <TextInput
            style={m.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g. House Down Payment"
            placeholderTextColor="#9CA3AF"
          />

          <Text style={m.label}>Emoji Icon</Text>
          <View style={m.emojiRow}>
            {['🏠','🚗','✈️','🎓','🎯','💍','🌴','💰'].map((e) => (
              <TouchableOpacity
                key={e}
                style={[m.emojiBtn, emoji === e && m.emojiBtnActive]}
                onPress={() => setEmoji(e)}
              >
                <Text style={m.emojiTxt}>{e}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={m.label}>Target Amount *</Text>
          <TextInput
            style={m.input}
            value={target}
            onChangeText={setTarget}
            placeholder="e.g. $50,000"
            placeholderTextColor="#9CA3AF"
            keyboardType="default"
          />

          <Text style={m.label}>Target Date</Text>
          <TextInput
            style={m.input}
            value={date}
            onChangeText={setDate}
            placeholder="e.g. December 2030"
            placeholderTextColor="#9CA3AF"
          />

          <Text style={m.label}>Monthly Contribution</Text>
          <TextInput
            style={m.input}
            value={contribution}
            onChangeText={setContribution}
            placeholder="e.g. $500"
            placeholderTextColor="#9CA3AF"
            keyboardType="default"
          />

          <TouchableOpacity style={m.addBtn} onPress={handleAdd} activeOpacity={0.85}>
            <Text style={m.addBtnTxt}>Add Goal</Text>
          </TouchableOpacity>

          <TouchableOpacity style={m.cancelBtn} onPress={onClose}>
            <Text style={m.cancelTxt}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const m = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 40,
  },
  dragHandle: { width: 40, height: 4, backgroundColor: '#E2E8F0', borderRadius: 99, alignSelf: 'center', marginBottom: 18 },
  sheetTitle: { fontSize: 20, fontWeight: '800', color: '#111827', marginBottom: 20 },
  label: { fontSize: 12, fontWeight: '600', color: '#6B7280', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    height: 48, borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: 12,
    paddingHorizontal: 14, fontSize: 15, color: '#111827', backgroundColor: '#FAFAFA', marginBottom: 14,
  },
  emojiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  emojiBtn: { width: 44, height: 44, borderRadius: 12, borderWidth: 1.5, borderColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FAFAFA' },
  emojiBtnActive: { borderColor: BLUE, backgroundColor: '#EEF2FF' },
  emojiTxt: { fontSize: 22 },
  addBtn: { height: 52, borderRadius: 26, backgroundColor: BLUE, alignItems: 'center', justifyContent: 'center', marginTop: 4, shadowColor: BLUE, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
  addBtnTxt: { fontSize: 16, fontWeight: '700', color: '#fff' },
  cancelBtn: { height: 44, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  cancelTxt: { fontSize: 14, color: '#9CA3AF', fontWeight: '500' },
});

// ═══════════════════════════════════════════════════════════
// GOAL PLANNER SCREEN
// ═══════════════════════════════════════════════════════════
export function GoalPlannerScreen(): React.ReactElement {
  const [activeTab,   setActiveTab]   = useState<Tab>('Active');
  const [goals,       setGoals]       = useState<Goal[]>(DEFAULT_GOALS);
  const [selectedId,  setSelectedId]  = useState<string>(DEFAULT_GOALS[0].id);
  const [showAdd,     setShowAdd]     = useState(false);

  const selected = goals.find((g) => g.id === selectedId) ?? goals[0];

  const addGoal = (g: Goal) => {
    setGoals((prev) => [...prev, g]);
    setSelectedId(g.id);
  };

  const deleteGoal = (id: string) => {
    if (id === 'retirement') {
      Alert.alert('Cannot delete', 'The Retirement goal is a default goal.');
      return;
    }
    Alert.alert('Delete Goal', 'Are you sure you want to remove this goal?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: () => {
          setGoals((prev) => prev.filter((g) => g.id !== id));
          setSelectedId('retirement');
        },
      },
    ]);
  };

  return (
    <View style={s.screen}>
      {/* ── Internal tab bar ── */}
      <View style={s.tabBar}>
        {TABS.map((t) => (
          <TouchableOpacity
            key={t}
            style={s.tabItem}
            onPress={() => setActiveTab(t)}
            activeOpacity={0.8}
          >
            <Text style={[s.tabText, activeTab === t && s.tabTextActive]}>{t}</Text>
            {activeTab === t && <View style={s.tabUnderline} />}
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
        {/* ── Two-column layout ── */}
        <View style={s.columns}>

          {/* LEFT: Goal list */}
          <View style={s.leftCol}>
            {goals.map((g) => (
              <TouchableOpacity
                key={g.id}
                style={[s.goalChip, selectedId === g.id && s.goalChipActive]}
                onPress={() => setSelectedId(g.id)}
                onLongPress={() => deleteGoal(g.id)}
                activeOpacity={0.8}
              >
                <Text style={s.goalEmoji}>{g.emoji}</Text>
                <Text style={[s.goalName, selectedId === g.id && s.goalNameActive]}>
                  {g.name}
                </Text>
              </TouchableOpacity>
            ))}

            {/* Add Goal Button */}
            <TouchableOpacity
              style={s.addGoalBtn}
              onPress={() => setShowAdd(true)}
              activeOpacity={0.8}
            >
              <Text style={s.addGoalIcon}>＋</Text>
              <Text style={s.addGoalTxt}>Add Goal</Text>
            </TouchableOpacity>
          </View>

          {/* RIGHT: Goal detail */}
          {selected && (
            <View style={s.rightCol}>
              <View style={s.detailCard}>
                <Text style={s.detailTitle}>{selected.name} Fund</Text>

                <View style={s.detailRow}>
                  <Text style={s.detailLabel}>Target:</Text>
                  <Text style={s.detailValue}>{selected.target}</Text>
                </View>
                <View style={s.detailRow}>
                  <Text style={s.detailLabel}>Date:</Text>
                  <Text style={s.detailValue}>{selected.date || 'Not set'}</Text>
                </View>
                <View style={[s.detailRow, { flexWrap: 'wrap', gap: 4 }]}>
                  <Text style={s.detailLabel}>Allocation:</Text>
                  <Text style={s.detailValue}>{selected.allocation}</Text>
                  <Text style={[s.detailLabel, { marginLeft: 8 }]}>Contribution:</Text>
                  <Text style={s.detailValue}>{selected.contribution || 'Not set'}</Text>
                </View>

                {/* Achievable badge */}
                <View style={s.achievableRow}>
                  <Text style={s.achievableQ}>Is this achievable?</Text>
                  <View style={[s.achievableBadge, !selected.achievable && s.achievableBadgeNo]}>
                    <Text style={s.achievableTxt}>
                      {selected.achievable ? 'YES' : 'NO'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Arrow */}
              <Text style={s.arrow}>↓</Text>

              {/* Stats row */}
              <View style={s.statsCard}>
                <View style={s.statItem}>
                  <Text style={s.statLabel}>Required Monthly</Text>
                  <Text style={s.statValue}>{selected.requiredMonthly}</Text>
                </View>
                <View style={s.statDivider} />
                <View style={s.statItem}>
                  <Text style={s.statLabel}>predicted shortfall</Text>
                  <Text style={[s.statValue, { color: RED }]}>{selected.shortfall}</Text>
                </View>
                <View style={s.statDivider} />
                <View style={[s.statItem, s.statItemGreen]}>
                  <Text style={s.statLabel}>recommended changes</Text>
                  <Text style={[s.statValue, { color: '#065F46', fontSize: 13 }]}>
                    {selected.recommendation}
                  </Text>
                </View>
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Add Goal Modal */}
      <AddGoalModal
        visible={showAdd}
        onClose={() => setShowAdd(false)}
        onAdd={addGoal}
      />
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F6FA' },

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E8ECF2',
  },
  tabItem: { marginRight: 28, paddingVertical: 14, position: 'relative' },
  tabText: { fontSize: 15, fontWeight: '600', color: '#9CA3AF' },
  tabTextActive: { color: '#111827' },
  tabUnderline: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: 2.5, backgroundColor: BLUE, borderRadius: 99,
  },

  // Layout
  body:     { padding: 16, paddingBottom: 40 },
  columns:  { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },

  // Left column – goal list
  leftCol: { width: 130, gap: 10 },
  goalChip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 12, paddingHorizontal: 12,
    backgroundColor: '#fff', borderRadius: 16,
    borderWidth: 1.5, borderColor: '#E8ECF2',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  goalChipActive: { borderColor: BLUE, backgroundColor: '#EEF2FF' },
  goalEmoji: { fontSize: 18 },
  goalName: { fontSize: 13, fontWeight: '600', color: '#374151', flexShrink: 1 },
  goalNameActive: { color: BLUE },
  addGoalBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 10, paddingHorizontal: 12,
    borderRadius: 16, borderWidth: 1.5, borderColor: '#D1D5DB',
    borderStyle: 'dashed', backgroundColor: '#FAFAFA',
  },
  addGoalIcon: { fontSize: 16, color: '#6B7280' },
  addGoalTxt:  { fontSize: 12, fontWeight: '600', color: '#6B7280' },

  // Right column – detail card
  rightCol: { flex: 1, gap: 0 },
  detailCard: {
    backgroundColor: '#fff', borderRadius: 20,
    padding: 16, borderWidth: 1, borderColor: '#E8ECF2',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 3,
  },
  detailTitle: { fontSize: 18, fontWeight: '800', color: '#111827', marginBottom: 12 },
  detailRow:   { flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 4 },
  detailLabel: { fontSize: 13, color: '#6B7280', fontWeight: '500' },
  detailValue: { fontSize: 13, fontWeight: '700', color: '#111827' },

  achievableRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: 14, flexWrap: 'wrap',
  },
  achievableQ:       { fontSize: 13, color: '#374151', fontWeight: '500' },
  achievableBadge:   { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 99, backgroundColor: GREEN },
  achievableBadgeNo: { backgroundColor: RED },
  achievableTxt:     { fontSize: 13, fontWeight: '800', color: '#fff' },

  // Arrow
  arrow: { textAlign: 'center', fontSize: 20, color: '#9CA3AF', marginVertical: 10 },

  // Stats card
  statsCard: {
    backgroundColor: '#fff', borderRadius: 20, padding: 14,
    flexDirection: 'row',
    borderWidth: 1, borderColor: '#E8ECF2',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 3,
  },
  statItem:      { flex: 1, alignItems: 'flex-start', gap: 4 },
  statItemGreen: { backgroundColor: '#ECFDF5', borderRadius: 12, padding: 6 },
  statDivider:   { width: 1, backgroundColor: '#E8ECF2', marginHorizontal: 8 },
  statLabel:     { fontSize: 10, color: '#6B7280', fontWeight: '500', lineHeight: 14 },
  statValue:     { fontSize: 16, fontWeight: '800', color: '#111827' },
});
