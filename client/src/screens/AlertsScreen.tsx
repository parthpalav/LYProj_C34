import React, { useEffect } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { getAlerts } from '../services/api';
import { useStore } from '../store/useStore';

export function AlertsScreen(): JSX.Element {
  const { alerts, setAlerts } = useStore();

  useEffect(() => {
    getAlerts().then(setAlerts).catch(console.error);
  }, [setAlerts]);

  return (
    <View style={styles.container}>
      <FlatList
        data={alerts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.type}>{item.type.toUpperCase()} - {item.severity.toUpperCase()}</Text>
            <Text style={styles.msg}>{item.message}</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', padding: 16 },
  card: { backgroundColor: '#ffffff', borderRadius: 12, padding: 12, marginBottom: 10 },
  type: { fontSize: 12, color: '#0f766e', fontWeight: '700', marginBottom: 4 },
  msg: { color: '#334155' }
});
