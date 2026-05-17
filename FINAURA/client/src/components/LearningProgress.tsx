import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export function LearningProgress({ progress }: { progress: number }): React.ReactElement {
  const pct = Math.max(0, Math.min(100, progress));
  return (
    <View>
      <Text style={styles.label}>Learning progress: {pct}%</Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 12, color: '#6B7280', marginBottom: 6 },
  track: { height: 8, backgroundColor: '#E5E7EB', borderRadius: 6, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: '#7C3AED' }
});
