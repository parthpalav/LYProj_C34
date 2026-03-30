import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, ActivityIndicator } from 'react-native';
import { getFMI } from '../services/api';
import { FMIRecord } from '../types';

const BLUE  = '#3B3BDE';
const GREEN = '#22C880';
const AMBER = '#F59E0B';
const RED   = '#EF4444';

function Gauge({ score }: { score: number }) {
  const color = score >= 70 ? GREEN : score >= 45 ? AMBER : RED;
  const rotation = -90 + (score / 100) * 180;
  
  return (
    <View style={g.container}>
      {/* Background Arc */}
      <View style={g.arcWrap}>
        <View style={g.arcBg} />
        {/* Foreground Arc - tricky in vanilla RN, we use a half circle rotated */}
        <View style={[g.arcFg, { borderColor: color, transform: [{ rotate: `${rotation}deg` }] }]} />
      </View>
      <View style={g.scoreWrap}>
        <Text style={[g.scoreText, { color }]}>{Math.round(score)}</Text>
        <Text style={g.scoreLabel}>/ 100</Text>
      </View>
      <Text style={g.status}>
        {score >= 70 ? 'Optimal' : score >= 45 ? 'Fair' : 'Needs Attention'}
      </Text>
    </View>
  );
}

const g = StyleSheet.create({
  container: { alignItems: 'center', marginVertical: 20 },
  arcWrap:   { width: 240, height: 120, overflow: 'hidden', alignItems: 'center', position: 'relative' },
  arcBg:     { width: 240, height: 240, borderRadius: 120, borderWidth: 24, borderColor: '#F0F1F5', position: 'absolute' },
  arcFg:     { width: 240, height: 240, borderRadius: 120, borderWidth: 24, borderTopColor: 'transparent', borderRightColor: 'transparent', position: 'absolute' },
  scoreWrap: { position: 'absolute', bottom: 10, alignItems: 'center' },
  scoreText: { fontSize: 48, fontWeight: '800', letterSpacing: -2 },
  scoreLabel:{ fontSize: 13, fontWeight: '700', color: '#9CA3AF', marginTop: -8 },
  status:    { fontSize: 16, fontWeight: '700', color: '#374151', marginTop: 12 },
});

export function FmiScreen(): React.ReactElement {
  const [history,    setHistory]    = useState<FMIRecord[]>([]);
  const [current,    setCurrent]    = useState<FMIRecord | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading,    setLoading]    = useState(true);

  const fetchFmi = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      const data = await getFMI();
      setCurrent(data.current);
      setHistory(data.history);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchFmi(); }, [fetchFmi]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#F4F6FA', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={BLUE} />
      </View>
    );
  }

  const score = current?.score ?? 50;
  
  // Create simple sparkline data
  const maxScore = Math.max(...history.map(h => h.score), 100);
  
  return (
    <ScrollView 
      style={s.screen} 
      contentContainerStyle={s.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchFmi(true)} tintColor={BLUE} />}
    >
      <View style={s.card}>
        <Text style={s.cardTitle}>Financial Mood Index</Text>
        <Text style={s.cardSub}>Real-time measure of your financial health</Text>
        
        <Gauge score={score} />
      </View>

      <View style={s.card}>
        <Text style={s.cardTitle}>FMI Trend (Last 7 Days)</Text>
        <View style={s.chart}>
          {history.slice(-7).map((h, i) => {
            const hPct = (h.score / maxScore) * 100;
            const barColor = h.score >= 70 ? GREEN : h.score >= 45 ? AMBER : RED;
            return (
              <View key={i} style={s.barWrap}>
                <Text style={s.barVal}>{Math.round(h.score)}</Text>
                <View style={[s.bar, { height: `${hPct}%` as any, backgroundColor: barColor }]} />
              </View>
            );
          })}
        </View>
      </View>

      {current?.factors && current.factors.length > 0 && (
        <View style={s.card}>
          <Text style={s.cardTitle}>Contributing Factors</Text>
          <View style={{ gap: 10, marginTop: 12 }}>
            {current.factors.map((f, i) => (
              <View key={i} style={s.factorRow}>
                <View style={s.factorDot} />
                <Text style={s.factorText}>{f}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Info Card */}
      <View style={s.infoCard}>
        <Text style={s.infoTitle}>💡 What is FMI?</Text>
        <Text style={s.infoText}>
          The Financial Mood Index (FMI) is a dynamic score from 0-100 that reflects your current financial well-being. It continuously learns from your spending patterns, upcoming bills, and behavioral signals to predict financial stress before it happens.
        </Text>
      </View>
      
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen:    { flex: 1, backgroundColor: '#F4F6FA' },
  content:   { padding: 16, paddingBottom: 32, gap: 16 },
  
  card:      { backgroundColor: '#fff', borderRadius: 20, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2, borderWidth: 1, borderColor: '#F0F1F5' },
  cardTitle: { fontSize: 16, fontWeight: '800', color: '#111827' },
  cardSub:   { fontSize: 13, color: '#6B7280', marginTop: 4 },
  
  chart:     { height: 160, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 20, paddingTop: 20 },
  barWrap:   { alignItems: 'center', width: 28, height: '100%', justifyContent: 'flex-end' },
  barVal:    { fontSize: 10, fontWeight: '700', color: '#6B7280', marginBottom: 6 },
  bar:       { width: 14, borderRadius: 7, backgroundColor: BLUE, minHeight: 4 },
  
  factorRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#F9FAFB', padding: 12, borderRadius: 12 },
  factorDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: BLUE },
  factorText:{ flex: 1, fontSize: 14, fontWeight: '500', color: '#374151' },
  
  infoCard:  { backgroundColor: '#EEF2FF', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#C7D2FE' },
  infoTitle: { fontSize: 15, fontWeight: '700', color: '#4338CA', marginBottom: 8 },
  infoText:  { fontSize: 13, color: '#4F46E5', lineHeight: 20 },
});
