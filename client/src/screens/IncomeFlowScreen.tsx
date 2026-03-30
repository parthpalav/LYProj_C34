import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, TextInput, Modal, Alert, ActivityIndicator,
} from 'react-native';
import { addIncome, getIncomeFlow, updateIncome, deleteIncome } from '../services/api';
import { IncomeFlowData } from '../types';

const BLUE    = '#3B3BDE';
const GREEN   = '#22C880';
const AMBER   = '#F59E0B';
const PURPLE  = '#7C3AED';
const SOURCES: Record<string, string> = {
  salary:    '#3B3BDE',
  gig:       '#22C880',
  freelance: '#F59E0B',
  other:     '#7C3AED',
};
const SOURCE_LABELS: Record<string, string> = {
  salary: '💼 Salary', gig: '🛵 Gig', freelance: '💻 Freelance', other: '💰 Other',
};

function AllocationRing({ allocation }: { allocation: IncomeFlowData['allocation'] }) {
  const total = allocation.essentials + allocation.goals + allocation.emergency;
  const segments = [
    { label: 'Essentials', value: allocation.essentials, color: BLUE, pct: 50 },
    { label: 'Goals',      value: allocation.goals,      color: GREEN, pct: 30 },
    { label: 'Emergency',  value: allocation.emergency,   color: AMBER, pct: 20 },
  ];
  const SIZE = 140;
  let acc = 0;
  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ width: SIZE, height: SIZE, borderRadius: SIZE / 2, overflow: 'hidden', backgroundColor: '#F0F1F5' }}>
        {segments.map((seg, i) => {
          const start = acc * 3.6;
          acc += seg.pct;
          return (
            <View key={i} pointerEvents="none" style={{
              position: 'absolute', width: SIZE, height: SIZE, borderRadius: SIZE / 2,
              borderWidth: SIZE / 2, borderColor: 'transparent',
              borderTopColor: seg.pct >= 50 ? seg.color : 'transparent',
              borderRightColor: seg.color,
              transform: [{ rotate: `${start - 90}deg` }],
            }} />
          );
        })}
        <View style={{
          position: 'absolute', width: SIZE - 40, height: SIZE - 40,
          borderRadius: (SIZE - 40) / 2, backgroundColor: '#fff',
          left: 20, top: 20, alignItems: 'center', justifyContent: 'center',
        }}>
          <Text style={{ fontSize: 10, color: '#6B7280', fontWeight: '600' }}>50/30/20</Text>
        </View>
      </View>
      <View style={rStyles.legend}>
        {segments.map((s) => (
          <View key={s.label} style={rStyles.legItem}>
            <View style={[rStyles.legDot, { backgroundColor: s.color }]} />
            <Text style={rStyles.legLbl}>{s.label}</Text>
            <Text style={[rStyles.legVal, { color: s.color }]}>₹{s.value.toLocaleString()}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
const rStyles = StyleSheet.create({
  legend:  { marginTop: 14, gap: 8, width: '100%' },
  legItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legDot:  { width: 10, height: 10, borderRadius: 5 },
  legLbl:  { flex: 1, fontSize: 13, fontWeight: '600', color: '#374151' },
  legVal:  { fontSize: 13, fontWeight: '700' },
});

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={s.card}>
      <Text style={s.cardTitle}>{title}</Text>
      {children}
    </View>
  );
}

function AddIncomeModal({ visible, onClose, onAdd }: {
  visible: boolean; onClose: () => void; onAdd: () => void;
}) {
  const [amount,      setAmount]      = useState('');
  const [source,      setSource]      = useState<'salary'|'gig'|'freelance'|'other'>('salary');
  const [description, setDescription] = useState('');
  const [saving,      setSaving]      = useState(false);

  const sources: Array<'salary'|'gig'|'freelance'|'other'> = ['salary','gig','freelance','other'];

  const handleAdd = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { Alert.alert('Invalid', 'Enter a valid amount.'); return; }
    setSaving(true);
    try {
      await addIncome({ amount: amt, source, description: description.trim() || SOURCE_LABELS[source] });
      setAmount(''); setDescription(''); setSource('salary');
      onAdd();
      onClose();
    } catch {
      Alert.alert('Error', 'Could not log income.');
    } finally { setSaving(false); }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={m.overlay} activeOpacity={1} onPress={onClose}>
        <View style={m.sheet} onStartShouldSetResponder={() => true}>
          <View style={m.handle} />
          <Text style={m.title}>Log Income</Text>

          <Text style={m.label}>Amount (₹)</Text>
          <TextInput style={m.input} value={amount} onChangeText={setAmount}
            keyboardType="decimal-pad" placeholder="e.g. 15000" placeholderTextColor="#9CA3AF" />

          <Text style={m.label}>Source</Text>
          <View style={m.sourceRow}>
            {sources.map((src) => (
              <TouchableOpacity key={src} style={[m.srcBtn, source === src && { borderColor: SOURCES[src], backgroundColor: SOURCES[src] + '18' }]}
                onPress={() => setSource(src)} activeOpacity={0.8}>
                <Text style={[m.srcTxt, source === src && { color: SOURCES[src], fontWeight: '700' }]}>{SOURCE_LABELS[src]}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={m.label}>Description</Text>
          <TextInput style={m.input} value={description} onChangeText={setDescription}
            placeholder="e.g. March salary" placeholderTextColor="#9CA3AF" />

          <TouchableOpacity style={m.addBtn} onPress={handleAdd} disabled={saving} activeOpacity={0.85}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={m.addTxt}>Log Income</Text>}
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}
const m = StyleSheet.create({
  overlay:   { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet:     { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 48 },
  handle:    { width: 40, height: 4, backgroundColor: '#E2E8F0', borderRadius: 99, alignSelf: 'center', marginBottom: 20 },
  title:     { fontSize: 20, fontWeight: '800', color: '#111827', marginBottom: 20 },
  label:     { fontSize: 12, fontWeight: '600', color: '#6B7280', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  input:     { height: 48, borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 14, fontSize: 15, color: '#111827', backgroundColor: '#FAFAFA', marginBottom: 14 },
  sourceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  srcBtn:    { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 99, borderWidth: 1.5, borderColor: '#E2E8F0', backgroundColor: '#FAFAFA' },
  srcTxt:    { fontSize: 13, color: '#6B7280', fontWeight: '500' },
  addBtn:    { height: 52, borderRadius: 26, backgroundColor: BLUE, alignItems: 'center', justifyContent: 'center', marginTop: 8, shadowColor: BLUE, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
  addTxt:    { fontSize: 16, fontWeight: '700', color: '#fff' },
});

export function IncomeFlowScreen(): React.ReactElement {
  const [flow,       setFlow]       = useState<IncomeFlowData | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading,    setLoading]    = useState(true);
  const [showAdd,    setShowAdd]    = useState(false);
  const [editInc,    setEditInc]    = useState<{id: string, amount: number, source: string, description?: string} | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editDesc,   setEditDesc]   = useState('');
  const [editSource, setEditSource] = useState<'salary'|'gig'|'freelance'|'other'>('salary');
  const [saving,     setSaving]     = useState(false);

  const fetchFlow = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      const data = await getIncomeFlow();
      setFlow(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchFlow(); }, [fetchFlow]);

  const handleLongPress = (item: any) => {
    Alert.alert(
      'Manage Income',
      `What would you like to do with "${item.description || item.source}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Edit', 
          onPress: () => {
            setEditInc(item);
            setEditAmount(String(item.amount));
            setEditDesc(item.description || '');
            setEditSource(item.source);
          } 
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteIncome(item.id);
              fetchFlow(true);
            } catch (e) { Alert.alert('Error', 'Failed to delete income entry'); }
          }
        }
      ]
    );
  };

  const submitEdit = async () => {
    if (!editInc) return;
    const amt = parseFloat(editAmount);
    if (!amt || amt <= 0) { Alert.alert('Invalid', 'Enter a valid amount.'); return; }
    setSaving(true);
    try {
      await updateIncome(editInc.id, { 
        amount: amt, 
        source: editSource, 
        description: editDesc.trim() || SOURCE_LABELS[editSource] 
      });
      setEditInc(null);
      fetchFlow(true);
    } catch {
      Alert.alert('Error', 'Could not update income.');
    } finally { setSaving(false); }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#F4F6FA', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={BLUE} />
      </View>
    );
  }

  const volatilityColor = (flow?.volatility ?? 0) > 50 ? RED : (flow?.volatility ?? 0) > 25 ? AMBER : GREEN;

  return (
    <>
      <ScrollView
        style={s.screen}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchFlow(true)} tintColor={BLUE} colors={[BLUE]} />}
      >
        {/* Summary header */}
        <View style={s.header}>
          <View>
            <Text style={s.headerLabel}>Total Monthly Income</Text>
            <Text style={s.headerAmount}>₹{(flow?.total ?? 0).toLocaleString()}</Text>
          </View>
          <View style={s.dailyPill}>
            <Text style={s.dailyLabel}>Daily</Text>
            <Text style={s.dailyAmount}>₹{flow?.dailySmoothed ?? 0}</Text>
          </View>
        </View>

        {/* Volatility */}
        {flow && flow.volatility > 0 && (
          <View style={[s.volatilityBadge, { backgroundColor: volatilityColor + '18', borderColor: volatilityColor }]}>
            <Text style={{ fontSize: 16 }}>{flow.volatility > 50 ? '📈' : '📊'}</Text>
            <Text style={[s.volatilityText, { color: volatilityColor }]}>
              Income Volatility: {flow.volatility}% — {flow.volatility > 50 ? 'High variability. Smoothing recommended.' : flow.volatility > 25 ? 'Moderate income variation.' : 'Stable income stream.'}
            </Text>
          </View>
        )}

        {/* 50-30-20 Allocation */}
        {flow && flow.total > 0 && (
          <Card title="Smart Allocation (50/30/20)">
            <AllocationRing allocation={flow.allocation} />
          </Card>
        )}

        {/* Source Breakdown */}
        {flow && Object.keys(flow.sources).length > 0 && (
          <Card title="Income Sources">
            {Object.entries(flow.sources).map(([src, amt]) => {
              const pct = flow.total > 0 ? Math.round((amt / flow.total) * 100) : 0;
              return (
                <View key={src} style={s.sourceRow}>
                  <Text style={s.sourceName}>{SOURCE_LABELS[src] ?? src}</Text>
                  <View style={s.sourceBarWrap}>
                    <View style={[s.sourceBar, { width: `${pct}%` as any, backgroundColor: SOURCES[src] ?? BLUE }]} />
                  </View>
                  <Text style={[s.sourceAmt, { color: SOURCES[src] ?? BLUE }]}>₹{(amt as number).toLocaleString()}</Text>
                </View>
              );
            })}
          </Card>
        )}

        {/* Timeline */}
        {flow && flow.timeline.length > 0 && (
          <Card title="Recent Income Timeline">
            {flow.timeline.slice().reverse().map((item, i) => (
              <TouchableOpacity 
                key={i} 
                style={s.timelineRow}
                onLongPress={() => handleLongPress(item)}
                activeOpacity={0.7}
              >
                <View style={[s.timelineDot, { backgroundColor: SOURCES[item.source] ?? BLUE }]} />
                <View style={{ flex: 1 }}>
                  <Text style={s.timelineSource}>{SOURCE_LABELS[item.source] ?? item.source}</Text>
                  <Text style={s.timelineDate}>
                    {new Date(item.timestamp).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                  </Text>
                </View>
                <Text style={[s.timelineAmt, { color: SOURCES[item.source] ?? BLUE }]}>
                  +₹{item.amount.toLocaleString()}
                </Text>
              </TouchableOpacity>
            ))}
          </Card>
        )}

        {flow?.total === 0 && (
          <View style={s.emptyState}>
            <Text style={s.emptyIcon}>💸</Text>
            <Text style={s.emptyTitle}>No Income Logged Yet</Text>
            <Text style={s.emptyText}>Tap + to log your first income entry and FINAURA will smooth your cashflow.</Text>
          </View>
        )}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity style={s.fab} onPress={() => setShowAdd(true)} activeOpacity={0.85}>
        <Text style={s.fabIcon}>＋</Text>
      </TouchableOpacity>

      <AddIncomeModal visible={showAdd} onClose={() => setShowAdd(false)} onAdd={() => fetchFlow(true)} />

      {/* Edit Income Modal */}
      <Modal visible={!!editInc} transparent animationType="slide" onRequestClose={() => setEditInc(null)}>
        <TouchableOpacity style={m.overlay} activeOpacity={1} onPress={() => setEditInc(null)}>
          <View style={m.sheet} onStartShouldSetResponder={() => true}>
            <View style={m.handle} />
            <Text style={m.title}>Edit Income</Text>

            <Text style={m.label}>Amount (₹)</Text>
            <TextInput style={m.input} value={editAmount} onChangeText={setEditAmount}
              keyboardType="decimal-pad" placeholder="e.g. 15000" placeholderTextColor="#9CA3AF" />

            <Text style={m.label}>Source</Text>
            <View style={m.sourceRow}>
              {(['salary','gig','freelance','other'] as const).map((src) => (
                <TouchableOpacity key={src} style={[m.srcBtn, editSource === src && { borderColor: SOURCES[src], backgroundColor: SOURCES[src] + '18' }]}
                  onPress={() => setEditSource(src)} activeOpacity={0.8}>
                  <Text style={[m.srcTxt, editSource === src && { color: SOURCES[src], fontWeight: '700' }]}>{SOURCE_LABELS[src]}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={m.label}>Description</Text>
            <TextInput style={m.input} value={editDesc} onChangeText={setEditDesc}
              placeholder="e.g. March salary" placeholderTextColor="#9CA3AF" />

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity style={[m.addBtn, { flex: 1, backgroundColor: '#E2E8F0' }]} onPress={() => setEditInc(null)}>
                 <Text style={[m.addTxt, { color: '#475569' }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[m.addBtn, { flex: 1 }]} onPress={submitEdit} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={m.addTxt}>Save Changes</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const RED = '#EF4444';

const s = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: '#F4F6FA' },
  content: { padding: 16, paddingBottom: 96, gap: 16 },

  header: {
    backgroundColor: BLUE, borderRadius: 20, padding: 20,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    shadowColor: BLUE, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8,
  },
  headerLabel:  { fontSize: 13, color: 'rgba(255,255,255,0.75)', fontWeight: '500' },
  headerAmount: { fontSize: 30, fontWeight: '800', color: '#fff', letterSpacing: -1, marginTop: 4 },
  dailyPill:    { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: 12, alignItems: 'center' },
  dailyLabel:   { fontSize: 11, color: 'rgba(255,255,255,0.75)', fontWeight: '600' },
  dailyAmount:  { fontSize: 18, fontWeight: '800', color: '#fff', marginTop: 2 },

  volatilityBadge: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14, borderWidth: 1.5 },
  volatilityText:  { flex: 1, fontSize: 13, fontWeight: '600', lineHeight: 18 },

  card:      { backgroundColor: '#fff', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: '#E8ECF2', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 3 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 16 },

  sourceRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sourceName:   { width: 96, fontSize: 13, fontWeight: '600', color: '#374151' },
  sourceBarWrap: { flex: 1, height: 8, backgroundColor: '#F0F1F5', borderRadius: 99, overflow: 'hidden' },
  sourceBar:    { height: '100%', borderRadius: 99 },
  sourceAmt:    { width: 72, textAlign: 'right', fontSize: 13, fontWeight: '700' },

  timelineRow:   { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F0F1F5' },
  timelineDot:   { width: 10, height: 10, borderRadius: 5 },
  timelineSource: { fontSize: 14, fontWeight: '600', color: '#111827' },
  timelineDate:  { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  timelineAmt:   { fontSize: 15, fontWeight: '800' },

  emptyState: { alignItems: 'center', paddingVertical: 48 },
  emptyIcon:  { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 8 },
  emptyText:  { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 20, paddingHorizontal: 24 },

  fab:     { position: 'absolute', bottom: 24, right: 16, width: 56, height: 56, borderRadius: 28, backgroundColor: BLUE, alignItems: 'center', justifyContent: 'center', shadowColor: BLUE, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: 10 },
  fabIcon: { fontSize: 28, color: '#fff', lineHeight: 32 },
});
