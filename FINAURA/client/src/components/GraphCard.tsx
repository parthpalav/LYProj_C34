import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export function GraphCard({ title, children }: { title: string; children: React.ReactNode }): React.ReactElement {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      <View style={{ marginTop: 8 }}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 14, borderRadius: 14, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB' },
  title: { fontWeight: '700', color: '#111827' }
});
