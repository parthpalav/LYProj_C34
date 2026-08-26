import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  Keyboard,
  TouchableWithoutFeedback,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { addIncome, getIncomeFlow, updateIncome, deleteIncome } from '../services/api';
import { IncomeFlowData } from '../types';
import { formatCurrency } from '../utils/format';

const BLUE = '#2563EB';
const GREEN = '#10B981';
const AMBER = '#F59E0B';
const RED = '#EF4444';
const PURPLE = '#7C3AED';
const DARK = '#0F172A';
const GRAY = '#64748B';
const LIGHT = '#F8FAFC';
const BORDER = '#E2E8F0';

const SOURCES: Record<string, string> = {
  salary: '#2563EB',
  gig: '#10B981',
  freelance: '#F59E0B',
  business: '#8B5CF6',
  rental: '#EC4899',
  consulting: '#06B6D4',
  bonus: '#F97316',
  other: '#64748B',
};

const SOURCE_LABELS: Record<string, string> = {
  salary: '💼 Salary',
  gig: '🛵 Gig',
  freelance: '💻 Freelance',
  business: '🏢 Business',
  rental: '🏠 Rental',
  consulting: '🤝 Consulting',
  bonus: '🎁 Bonus',
  other: '💰 Other',
};

const SOURCE_KEYS = ['salary', 'gig', 'freelance', 'business', 'rental', 'consulting', 'bonus', 'other'] as const;

function AllocationRing({ allocation }: { allocation: IncomeFlowData['allocation'] }) {
  const segments = [
    { label: 'Essentials', value: allocation.essentials, color: BLUE, pct: 50 },
    { label: 'Goals', value: allocation.goals, color: GREEN, pct: 30 },
    { label: 'Emergency', value: allocation.emergency, color: AMBER, pct: 20 },
  ];
  const SIZE = 140;
  let acc = 0;
  return (
    <View style={{ alignItems: 'center' }}>
      <View
        style={{
          width: SIZE,
          height: SIZE,
          borderRadius: SIZE / 2,
          overflow: 'hidden',
          backgroundColor: '#F1F5F9',
        }}
      >
        {segments.map((seg, i) => {
          const start = acc * 3.6;
          acc += seg.pct;
          return (
            <View
              key={i}
              pointerEvents="none"
              style={{
                position: 'absolute',
                width: SIZE,
                height: SIZE,
                borderRadius: SIZE / 2,
                borderWidth: SIZE / 2,
                borderColor: 'transparent',
                borderTopColor: seg.pct >= 50 ? seg.color : 'transparent',
                borderRightColor: seg.color,
                transform: [{ rotate: `${start - 90}deg` }],
              }}
            />
          );
        })}
        <View
          style={{
            position: 'absolute',
            width: SIZE - 40,
            height: SIZE - 40,
            borderRadius: (SIZE - 40) / 2,
            backgroundColor: '#FFFFFF',
            left: 20,
            top: 20,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 10, color: GRAY, fontWeight: '700' }}>50/30/20</Text>
        </View>
      </View>
      <View style={rStyles.legend}>
        {segments.map((s) => (
          <View key={s.label} style={rStyles.legItem}>
            <View style={[rStyles.legDot, { backgroundColor: s.color }]} />
            <Text style={rStyles.legLbl}>{s.label}</Text>
            <Text style={[rStyles.legVal, { color: s.color }]}>{formatCurrency(s.value)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const rStyles = StyleSheet.create({
  legend: { marginTop: 14, gap: 8, width: '100%' },
  legItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legDot: { width: 10, height: 10, borderRadius: 5 },
  legLbl: { flex: 1, fontSize: 13, fontWeight: '600', color: DARK },
  legVal: { fontSize: 13, fontWeight: '700' },
});

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={s.card}>
      <Text style={s.cardTitle}>{title}</Text>
      {children}
    </View>
  );
}

// ── Add Income Modal ───────────────────────────────────────────

function AddIncomeModal({
  visible,
  onClose,
  onAdd,
}: {
  visible: boolean;
  onClose: () => void;
  onAdd: () => void;
}) {
  const [amount, setAmount] = useState('');
  const [source, setSource] = useState<string>('salary');
  const [description, setDescription] = useState('');
  const [dateStr, setDateStr] = useState(new Date().toISOString().split('T')[0]);
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid positive income amount.');
      return;
    }
    setSaving(true);
    try {
      await addIncome({
        amount: amt,
        source,
        description: description.trim() || SOURCE_LABELS[source] || source,
        date: dateStr,
      });
      setAmount('');
      setDescription('');
      setSource('salary');
      onAdd();
      onClose();
    } catch {
      Alert.alert('Error', 'Could not log income. Please check your network connection.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={m.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <View style={m.sheet} onStartShouldSetResponder={() => true}>
            <View style={m.handle} />
            <Text style={m.title}>Record Income</Text>

            <Text style={m.label}>Amount (₹)</Text>
            <TextInput
              style={m.input}
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholder="e.g. 25000"
              placeholderTextColor="#94A3B8"
            />

            <Text style={m.label}>Income Source / Stream</Text>
            <View style={m.sourceRow}>
              {SOURCE_KEYS.map((src) => (
                <TouchableOpacity
                  key={src}
                  style={[
                    m.srcBtn,
                    source === src && { borderColor: SOURCES[src], backgroundColor: `${SOURCES[src]}15` },
                  ]}
                  onPress={() => setSource(src)}
                  activeOpacity={0.8}
                >
                  <Text style={[m.srcTxt, source === src && { color: SOURCES[src], fontWeight: '700' }]}>
                    {SOURCE_LABELS[src]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={m.label}>Description / Client</Text>
            <TextInput
              style={m.input}
              value={description}
              onChangeText={setDescription}
              placeholder="e.g. Freelance web design, Monthly Salary"
              placeholderTextColor="#94A3B8"
            />

            <Text style={m.label}>Date Received (YYYY-MM-DD)</Text>
            <TextInput
              style={m.input}
              value={dateStr}
              onChangeText={setDateStr}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#94A3B8"
            />

            <TouchableOpacity style={m.addBtn} onPress={handleAdd} disabled={saving} activeOpacity={0.85}>
              {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={m.addTxt}>Log Income</Text>}
            </TouchableOpacity>
          </View>
        </TouchableWithoutFeedback>
      </TouchableOpacity>
    </Modal>
  );
}

// ── Main Screen ────────────────────────────────────────────────

export function IncomeFlowScreen(): React.ReactElement {
  const navigation = useNavigation();
  const [flow, setFlow] = useState<IncomeFlowData | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editInc, setEditInc] = useState<{
    id: string;
    amount: number;
    source: string;
    description?: string;
  } | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editSource, setEditSource] = useState<string>('salary');
  const [saving, setSaving] = useState(false);

  const fetchFlow = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      const data = await getIncomeFlow();
      setFlow(data);
    } catch {
      // Non-blocking
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchFlow();
    }, [fetchFlow])
  );

  const handleLongPress = (item: IncomeFlowData['timeline'][number]) => {
    Alert.alert(
      'Manage Income Record',
      `What would you like to do with "${item.description || item.source}" (${formatCurrency(item.amount)})?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Edit',
          onPress: () => {
            setEditInc({
              id: item.id,
              amount: item.amount,
              source: item.source,
              description: item.description,
            });
            setEditAmount(String(item.amount));
            setEditDesc(item.description || '');
            setEditSource(item.source);
          },
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Delete Income',
              `Are you sure you want to delete this ${formatCurrency(item.amount)} entry?`,
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      await deleteIncome(item.id);
                      fetchFlow(true);
                    } catch {
                      Alert.alert('Error', 'Failed to delete income entry.');
                    }
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  const submitEdit = async () => {
    if (!editInc) return;
    const amt = parseFloat(editAmount);
    if (!amt || amt <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount.');
      return;
    }
    setSaving(true);
    try {
      await updateIncome(editInc.id, {
        amount: amt,
        source: editSource,
        description: editDesc.trim() || SOURCE_LABELS[editSource] || editSource,
      });
      setEditInc(null);
      fetchFlow(true);
    } catch {
      Alert.alert('Error', 'Could not update income.');
    } finally {
      setSaving(false);
    }
  };

  if (loading && !flow) {
    return (
      <View style={s.loadingWrap}>
        <ActivityIndicator size="large" color={BLUE} />
        <Text style={s.loadingText}>Loading your income streams…</Text>
      </View>
    );
  }

  const volatilityColor =
    (flow?.volatility ?? 0) > 50 ? RED : (flow?.volatility ?? 0) > 25 ? AMBER : '#059669';

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" />

      {/* ── Top Bar ──────────────────────────────────────────── */}
      <View style={s.topBar}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={s.backBtn}
          activeOpacity={0.7}
          accessibilityLabel="Back to Previous Screen"
        >
          <Ionicons name="arrow-back" size={22} color={DARK} />
        </TouchableOpacity>
        <Text style={s.topBarTitle}>Income Streams</Text>
        <TouchableOpacity
          style={s.addHeaderBtn}
          onPress={() => setShowAdd(true)}
          activeOpacity={0.8}
          accessibilityLabel="Add New Income Record"
        >
          <Ionicons name="add" size={22} color={BLUE} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={s.screen}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchFlow(true)}
            tintColor={BLUE}
            colors={[BLUE]}
          />
        }
      >
        {/* ── Summary Header ───────────────────────────────────── */}
        <View style={s.header}>
          <View>
            <Text style={s.headerLabel}>Total Monthly Income</Text>
            <Text style={s.headerAmount}>{formatCurrency(flow?.total ?? 0)}</Text>
          </View>
          <View style={s.dailyPill}>
            <Text style={s.dailyLabel}>Daily Pace</Text>
            <Text style={s.dailyAmount}>{formatCurrency(flow?.dailySmoothed ?? 0)}</Text>
          </View>
        </View>

        {/* ── Volatility Badge ─────────────────────────────────── */}
        {flow && flow.volatility > 0 && (
          <View
            style={[
              s.volatilityBadge,
              { backgroundColor: `${volatilityColor}12`, borderColor: volatilityColor },
            ]}
          >
            <Ionicons
              name={flow.volatility > 50 ? 'trending-down-outline' : 'pulse-outline'}
              size={20}
              color={volatilityColor}
            />
            <Text style={[s.volatilityText, { color: volatilityColor }]}>
              Income Volatility: {flow.volatility}% —{' '}
              {flow.volatility > 50
                ? 'High variability across income receipts.'
                : flow.volatility > 25
                ? 'Moderate income variation.'
                : 'Stable income stream.'}
            </Text>
          </View>
        )}

        {/* ── 50-30-20 Allocation ──────────────────────────────── */}
        {flow && flow.total > 0 && (
          <Card title="Smart Budget Allocation (50/30/20)">
            <AllocationRing allocation={flow.allocation} />
          </Card>
        )}

        {/* ── Source Breakdown ─────────────────────────────────── */}
        {flow && Object.keys(flow.sources).length > 0 && (
          <Card title="Income Breakdown by Source">
            {Object.entries(flow.sources).map(([src, amt]) => {
              const amount = Number(amt);
              const pct = flow.total > 0 ? Math.round((amount / flow.total) * 100) : 0;
              return (
                <View key={src} style={s.sourceRow}>
                  <Text style={s.sourceName} numberOfLines={1}>
                    {SOURCE_LABELS[src] ?? src}
                  </Text>
                  <View style={s.sourceBarWrap}>
                    <View style={[s.sourceBar, { width: `${pct}%`, backgroundColor: SOURCES[src] ?? BLUE }]} />
                  </View>
                  <Text style={[s.sourceAmt, { color: SOURCES[src] ?? BLUE }]}>{formatCurrency(amount)}</Text>
                </View>
              );
            })}
          </Card>
        )}

        {/* ── Timeline / Recent Records ────────────────────────── */}
        {flow && flow.timeline.length > 0 && (
          <Card title="Income Timeline (Tap to Edit / Delete)">
            {flow.timeline
              .slice()
              .reverse()
              .map((item, i) => (
                <TouchableOpacity
                  key={item.id || i}
                  style={s.timelineRow}
                  onPress={() => handleLongPress(item)}
                  activeOpacity={0.7}
                  accessibilityLabel={`Income record: ${item.description || item.source}, ${formatCurrency(item.amount)}`}
                >
                  <View style={[s.timelineDot, { backgroundColor: SOURCES[item.source] ?? BLUE }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.timelineSource}>{SOURCE_LABELS[item.source] ?? item.source}</Text>
                    <Text style={s.timelineDesc} numberOfLines={1}>
                      {item.description || 'Income Receipt'}
                    </Text>
                    <Text style={s.timelineDate}>
                      {new Date(item.timestamp).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </Text>
                  </View>
                  <Text style={[s.timelineAmt, { color: SOURCES[item.source] ?? BLUE }]}>
                    +{formatCurrency(item.amount)}
                  </Text>
                </TouchableOpacity>
              ))}
          </Card>
        )}

        {/* ── Empty State ──────────────────────────────────────── */}
        {(!flow || flow.timeline.length === 0) && (
          <View style={s.emptyState}>
            <Ionicons name="cash-outline" size={48} color={GRAY} style={{ marginBottom: 12 }} />
            <Text style={s.emptyTitle}>No Income Recorded Yet</Text>
            <Text style={s.emptyText}>
              Tap the button below to record your first income payment or freelance earnings.
            </Text>
            <TouchableOpacity style={s.emptyAddBtn} onPress={() => setShowAdd(true)} activeOpacity={0.8}>
              <Text style={s.emptyAddBtnText}>+ Log First Income</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Floating Action Button */}
      <TouchableOpacity
        style={s.fab}
        onPress={() => setShowAdd(true)}
        activeOpacity={0.85}
        accessibilityLabel="Add New Income Record"
      >
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </TouchableOpacity>

      <AddIncomeModal visible={showAdd} onClose={() => setShowAdd(false)} onAdd={() => fetchFlow(true)} />

      {/* Edit Income Modal */}
      <Modal visible={!!editInc} transparent animationType="slide" onRequestClose={() => setEditInc(null)}>
        <TouchableOpacity style={m.overlay} activeOpacity={1} onPress={() => setEditInc(null)}>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            <View style={m.sheet} onStartShouldSetResponder={() => true}>
              <View style={m.handle} />
              <Text style={m.title}>Edit Income Record</Text>

              <Text style={m.label}>Amount (₹)</Text>
              <TextInput
                style={m.input}
                value={editAmount}
                onChangeText={setEditAmount}
                keyboardType="decimal-pad"
                placeholder="e.g. 25000"
                placeholderTextColor="#94A3B8"
              />

              <Text style={m.label}>Source</Text>
              <View style={m.sourceRow}>
                {SOURCE_KEYS.map((src) => (
                  <TouchableOpacity
                    key={src}
                    style={[
                      m.srcBtn,
                      editSource === src && { borderColor: SOURCES[src], backgroundColor: `${SOURCES[src]}15` },
                    ]}
                    onPress={() => setEditSource(src)}
                    activeOpacity={0.8}
                  >
                    <Text style={[m.srcTxt, editSource === src && { color: SOURCES[src], fontWeight: '700' }]}>
                      {SOURCE_LABELS[src]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={m.label}>Description</Text>
              <TextInput
                style={m.input}
                value={editDesc}
                onChangeText={setEditDesc}
                placeholder="e.g. Consulting payment"
                placeholderTextColor="#94A3B8"
              />

              <View style={{ flexDirection: 'row', gap: 12 }}>
                <TouchableOpacity
                  style={[m.addBtn, { flex: 1, backgroundColor: '#E2E8F0' }]}
                  onPress={() => setEditInc(null)}
                >
                  <Text style={[m.addTxt, { color: '#475569' }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[m.addBtn, { flex: 1 }]} onPress={submitEdit} disabled={saving}>
                  {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={m.addTxt}>Save Changes</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────

const m = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 48,
  },
  handle: { width: 40, height: 4, backgroundColor: '#E2E8F0', borderRadius: 99, alignSelf: 'center', marginBottom: 20 },
  title: { fontSize: 20, fontWeight: '800', color: DARK, marginBottom: 20 },
  label: { fontSize: 12, fontWeight: '600', color: GRAY, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    height: 48,
    borderWidth: 1.5,
    borderColor: BORDER,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 15,
    color: DARK,
    backgroundColor: '#F8FAFC',
    marginBottom: 14,
  },
  sourceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  srcBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 99,
    borderWidth: 1.5,
    borderColor: BORDER,
    backgroundColor: '#F8FAFC',
  },
  srcTxt: { fontSize: 13, color: GRAY, fontWeight: '500' },
  addBtn: {
    height: 52,
    borderRadius: 26,
    backgroundColor: BLUE,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: BLUE,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  addTxt: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: LIGHT },
  screen: { flex: 1, backgroundColor: LIGHT },
  content: { padding: 16, paddingBottom: 96, gap: 16 },

  loadingWrap: {
    flex: 1,
    backgroundColor: LIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: { fontSize: 14, fontWeight: '600', color: GRAY },

  // Top Bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
  },
  topBarTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: DARK,
  },
  addHeaderBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
  },

  header: {
    backgroundColor: '#1E293B',
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  headerLabel: { fontSize: 13, color: '#94A3B8', fontWeight: '500' },
  headerAmount: { fontSize: 30, fontWeight: '800', color: '#FFFFFF', letterSpacing: -1, marginTop: 4 },
  dailyPill: { backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 12, padding: 10, alignItems: 'center' },
  dailyLabel: { fontSize: 11, color: '#94A3B8', fontWeight: '600' },
  dailyAmount: { fontSize: 16, fontWeight: '800', color: '#6EE7B7', marginTop: 2 },

  volatilityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  volatilityText: { flex: 1, fontSize: 13, fontWeight: '600', lineHeight: 18 },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: BORDER,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: DARK, marginBottom: 16 },

  sourceRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  sourceName: { width: 100, fontSize: 13, fontWeight: '600', color: DARK },
  sourceBarWrap: { flex: 1, height: 8, backgroundColor: '#F1F5F9', borderRadius: 99, overflow: 'hidden' },
  sourceBar: { height: '100%', borderRadius: 99 },
  sourceAmt: { width: 80, textAlign: 'right', fontSize: 13, fontWeight: '700' },

  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  timelineDot: { width: 10, height: 10, borderRadius: 5 },
  timelineSource: { fontSize: 14, fontWeight: '700', color: DARK },
  timelineDesc: { fontSize: 12, color: GRAY, marginTop: 2 },
  timelineDate: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
  timelineAmt: { fontSize: 15, fontWeight: '800' },

  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: DARK, marginBottom: 6 },
  emptyText: { fontSize: 13, color: GRAY, textAlign: 'center', lineHeight: 18, paddingHorizontal: 24, marginBottom: 16 },
  emptyAddBtn: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
  },
  emptyAddBtnText: { fontSize: 14, fontWeight: '700', color: BLUE },

  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: BLUE,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: BLUE,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
});
