import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { getFMI } from '../services/api';
import { FMIRecord } from '../types';

export function FmiScreen(): JSX.Element {
  const [history, setHistory] = useState<FMIRecord[]>([]);

  useEffect(() => {
    getFMI()
      .then(({ history: nextHistory }) => setHistory(nextHistory))
      .catch(console.error);
  }, []);

  const trend = useMemo(() => history.map((item: FMIRecord) => item.score), [history]);
  const latest = history[history.length - 1];

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>FMI Over Time</Text>
      <View style={styles.row}>
        {trend.map((score, idx) => (
          <View key={`${score}-${idx}`} style={styles.pointWrap}>
            <View style={[styles.point, { height: Math.max(12, score) }]} />
          </View>
        ))}
      </View>

      <Text style={styles.subtitle}>Contributing Factors</Text>
      {(latest?.factors ?? ['overspending', 'upcoming bills']).map((factor) => (
        <View key={factor} style={styles.factorCard}>
          <Text>{factor}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: '#f8fafc', minHeight: '100%' },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 12 },
  row: {
    height: 120,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 14
  },
  pointWrap: { width: 18, height: '100%', justifyContent: 'flex-end' },
  point: { width: '100%', backgroundColor: '#0284c7', borderRadius: 8 },
  subtitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  factorCard: { backgroundColor: '#ffffff', padding: 12, borderRadius: 10, marginBottom: 8 }
});
