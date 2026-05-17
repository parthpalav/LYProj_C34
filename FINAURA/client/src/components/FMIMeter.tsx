import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export function FMIMeter({ score }: { score: number }): React.ReactElement {
  const pct = Math.min(100, Math.max(0, score));
  const color = pct >= 80 ? '#22C55E' : pct >= 55 ? '#F59E0B' : '#EF4444';
  return (
    <View>
      <Text style={styles.score}>{pct}</Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  score: { fontSize: 28, fontWeight: '800', color: '#111827', marginBottom: 8 },
  track: { height: 10, borderRadius: 8, backgroundColor: '#E5E7EB', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 8 }
});
