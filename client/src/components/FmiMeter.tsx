import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { RiskLevel } from '../types';

interface Props {
  score: number;
  risk: RiskLevel;
}

export function FmiMeter({ score, risk }: Props): React.ReactElement {
  const normalized = Math.max(0, Math.min(100, score));
  const riskColor = risk === 'high' ? '#dc2626' : risk === 'medium' ? '#f59e0b' : '#16a34a';

  return (
    <View style={styles.wrapper}>
      <Text style={styles.title}>FMI Score</Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${normalized}%`, backgroundColor: riskColor }]} />
      </View>
      <View style={styles.row}>
        <Text style={styles.score}>{score}</Text>
        <Text style={[styles.risk, { color: riskColor }]}>{risk.toUpperCase()} RISK</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12
  },
  title: { fontSize: 16, fontWeight: '700', marginBottom: 10 },
  track: {
    height: 10,
    backgroundColor: '#e5e7eb',
    borderRadius: 999,
    overflow: 'hidden'
  },
  fill: {
    height: '100%',
    borderRadius: 999
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  score: { fontSize: 22, fontWeight: '700' },
  risk: { fontSize: 13, fontWeight: '600' }
});
