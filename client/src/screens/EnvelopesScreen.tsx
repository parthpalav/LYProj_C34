import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, TouchableOpacity, ActivityIndicator, TextInput, KeyboardAvoidingView } from 'react-native';
import { getEnvelopes, simulateMicroSavings, getRoundupPreview } from '../services/api';
import { EnvelopeData } from '../types';

const BLUE  = '#3B3BDE';
const GREEN = '#22C880';
const AMBER = '#F59E0B';
const PURPLE= '#7C3AED';

function EnvelopeCard({ title, amount, target, color, icon }: { title: string, amount: number, target?: number, color: string, icon: string }) {
  const pct = target ? Math.min(100, Math.round((amount / target) * 100)) : 0;
  
  return (
    <View style={s.envCard}>
      <View style={[s.envIconWrap, { backgroundColor: color + '1A' }]}>
        <Text style={s.envIcon}>{icon}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.envTitle}>{title}</Text>
        <Text style={[s.envAmount, { color }]}>₹{amount.toLocaleString()}</Text>
        {target && (
          <View style={s.trackRow}>
            <View style={s.trackBg}>
              <View style={[s.trackFg, { width: `${pct}%`, backgroundColor: color }]} />
            </View>
            <Text style={s.trackPct}>{pct}%</Text>
          </View>
        )}
      </View>
    </View>
  );
}

export function EnvelopesScreen(): React.ReactElement {
  const [envelope, setEnvelope] = useState<EnvelopeData | null>(null);
  const [loading, setLoading]   = useState(true);
  const [previewAmount, setPreviewAmount] = useState('');
  const [previewText, setPreviewText]   = useState('');
  const [simMsg, setSimMsg]         = useState('');
  const [simLoading, setSimLoading] = useState(false);

  const fetchData = async () => {
    try {
      const [env, rPreview] = await Promise.all([
        getEnvelopes(),
        getRoundupPreview()
      ]);
      setEnvelope(env);
      setPreviewAmount(String(rPreview.amount));
      setPreviewText(rPreview.previewText);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSimulate = async () => {
    if (!previewAmount || isNaN(Number(previewAmount)) || Number(previewAmount) <= 0) return;
    
    setSimLoading(true);
    setSimMsg('');
    try {
      const response = await simulateMicroSavings(Number(previewAmount));
      setSimMsg(response.message);
      await fetchData(); // Refresh vault and fetch new preview
    } catch (e) {
      console.error(e);
      setSimMsg('Failed to apply roundup.');
    } finally {
      setSimLoading(false);
      setTimeout(() => setSimMsg(''), 5000);
    }
  };

  if (loading || !envelope) {
    return (
      <View style={{ flex: 1, backgroundColor: '#F4F6FA', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={BLUE} />
      </View>
    );
  }

  const savingsTotal = envelope.savings;
  const savingsPct   = Math.round((savingsTotal / envelope.targetSavings) * 100);

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      
      <View style={s.header}>
        <Text style={s.headerTitle}>Total Savings Vault</Text>
        <Text style={s.headerAmount}>₹{savingsTotal.toLocaleString()}</Text>
        <View style={s.vaultTrack}>
          <View style={[s.vaultFill, { width: `${savingsPct}%` }]} />
        </View>
        <Text style={s.vaultSub}>Target: ₹{envelope.targetSavings.toLocaleString()} ({savingsPct}%)</Text>
      </View>

      <Text style={s.sectionTitle}>Active Envelopes</Text>
      
      <EnvelopeCard title="Rent & Utilities" amount={envelope.rent} color={BLUE} icon="🏠" />
      <EnvelopeCard title="Food & Groceries" amount={envelope.food} color={AMBER} icon="🍔" />
      <EnvelopeCard title="Investments & Savings" amount={envelope.savings} target={envelope.targetSavings} color={GREEN} icon="📈" />
      
      <KeyboardAvoidingView behavior="padding">
        <View style={s.actionCard}>
          <View style={s.actionHeader}>
            <Text style={s.actionIcon}>💡</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.actionTitle}>Spare Change Roundups</Text>
              <Text style={s.actionDesc}>{previewText || 'Automatically round up spare change from your recent transactions and vault it.'}</Text>
            </View>
          </View>
          
          <View style={s.editRow}>
            <Text style={s.editLabel}>Transfer Amount (₹):</Text>
            <TextInput 
              style={s.editInput} 
              value={previewAmount} 
              onChangeText={setPreviewAmount} 
              keyboardType="numeric" 
            />
          </View>
          
          <TouchableOpacity style={s.btn} onPress={handleSimulate} disabled={simLoading} activeOpacity={0.8}>
            {simLoading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Vault ₹{previewAmount} Now</Text>}
          </TouchableOpacity>
          
          {!!simMsg && (
            <View style={s.msgBox}>
              <Text style={s.msgText}>✅ {simMsg}</Text>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen:       { flex: 1, backgroundColor: '#F4F6FA' },
  content:      { padding: 16, gap: 16, paddingBottom: 40 },
  
  header:       { backgroundColor: BLUE, borderRadius: 20, padding: 24, shadowColor: BLUE, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8, alignItems: 'center' },
  headerTitle:  { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase', letterSpacing: 1 },
  headerAmount: { fontSize: 40, fontWeight: '800', color: '#fff', letterSpacing: -1, marginTop: 4, marginBottom: 16 },
  vaultTrack:   { width: '100%', height: 6, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 3, overflow: 'hidden' },
  vaultFill:    { height: '100%', backgroundColor: '#fff', borderRadius: 3 },
  vaultSub:     { fontSize: 13, color: 'rgba(255,255,255,0.9)', marginTop: 8, fontWeight: '500' },
  
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#111827', marginTop: 8, marginBottom: -4 },
  
  envCard:      { backgroundColor: '#fff', borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1, borderColor: '#F0F1F5', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 },
  envIconWrap:  { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  envIcon:      { fontSize: 22 },
  envTitle:     { fontSize: 14, fontWeight: '700', color: '#374151' },
  envAmount:    { fontSize: 18, fontWeight: '800', marginTop: 2 },
  
  trackRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  trackBg:      { flex: 1, height: 6, backgroundColor: '#F0F1F5', borderRadius: 3, overflow: 'hidden' },
  trackFg:      { height: '100%', borderRadius: 3 },
  trackPct:     { fontSize: 11, fontWeight: '700', color: '#9CA3AF', width: 28, textAlign: 'right' },
  
  actionCard:   { backgroundColor: '#fff', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#E8ECF2', marginTop: 8 },
  actionHeader: { flexDirection: 'row', gap: 12, marginBottom: 16, paddingRight: 24 },
  actionIcon:   { fontSize: 24 },
  actionTitle:  { fontSize: 15, fontWeight: '800', color: '#111827', marginBottom: 4 },
  actionDesc:   { fontSize: 13, color: '#6B7280', lineHeight: 18 },
  editRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F9FAFB', padding: 12, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: '#F3F4F6' },
  editLabel:    { fontSize: 13, fontWeight: '600', color: '#4B5563' },
  editInput:    { fontSize: 16, fontWeight: '800', color: BLUE, padding: 0, textAlign: 'right', minWidth: 60 },
  btn:          { backgroundColor: BLUE, borderRadius: 12, height: 48, alignItems: 'center', justifyContent: 'center' },
  btnText:      { fontSize: 14, fontWeight: '700', color: '#fff' },
  
  msgBox:       { backgroundColor: '#ECFDF5', padding: 12, borderRadius: 10, marginTop: 12, borderWidth: 1, borderColor: '#6EE7B7' },
  msgText:      { fontSize: 13, fontWeight: '600', color: '#065F46' },
});
