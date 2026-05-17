import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export function BottomNav({ label }: { label: string }): React.ReactElement {
  return (
    <View style={styles.wrap}>
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingVertical: 8, paddingHorizontal: 12 },
  text: { fontSize: 11, fontWeight: '700', color: '#1F2937' }
});
