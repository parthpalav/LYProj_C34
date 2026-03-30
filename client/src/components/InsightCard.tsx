import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface Props {
  text: string;
}

export function InsightCard({ text }: Props): React.ReactElement {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>Insight</Text>
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ecfeff',
    borderColor: '#99f6e4',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10
  },
  label: { color: '#0f766e', fontWeight: '700', marginBottom: 5 },
  text: { color: '#134e4a' }
});
