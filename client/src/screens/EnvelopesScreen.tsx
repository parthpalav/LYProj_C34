import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getEnvelopes, simulateMicroSavings } from '../services/api';
import { EnvelopeData } from '../types';
import { formatCurrency } from '../utils/format';

export function EnvelopesScreen(): JSX.Element {
  const [envelope, setEnvelope] = useState<EnvelopeData | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    getEnvelopes().then(setEnvelope).catch(console.error);
  }, []);

  const handleSimulate = async () => {
    const response = await simulateMicroSavings();
    setMessage(response.message);
    const latest = await getEnvelopes();
    setEnvelope(latest);
  };

  if (!envelope) {
    return <View style={styles.container} />;
  }

  const savingsPercent = Math.min(100, (envelope.savings / envelope.targetSavings) * 100);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Envelope Allocation</Text>
      {(['rent', 'food', 'savings'] as const).map((key) => (
        <View key={key} style={styles.row}>
          <Text style={styles.label}>{key.toUpperCase()}</Text>
          <Text>{formatCurrency(envelope[key])}</Text>
        </View>
      ))}

      <Text style={styles.subtitle}>Savings Progress</Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${savingsPercent}%` }]} />
      </View>

      <Pressable style={styles.button} onPress={handleSimulate}>
        <Text style={styles.buttonText}>Simulate Micro-Savings</Text>
      </Pressable>

      {message ? <Text style={styles.message}>{message}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: '#f8fafc', minHeight: '100%' },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 12 },
  subtitle: { marginTop: 12, fontWeight: '700', marginBottom: 6 },
  row: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  label: { fontWeight: '700' },
  track: { height: 12, backgroundColor: '#e2e8f0', borderRadius: 999, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: '#0ea5e9' },
  button: {
    marginTop: 14,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    backgroundColor: '#0f766e'
  },
  buttonText: { color: '#ffffff', fontWeight: '700' },
  message: { marginTop: 10, color: '#166534' }
});
