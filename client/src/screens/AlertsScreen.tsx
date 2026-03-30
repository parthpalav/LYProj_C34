import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { getAlerts } from '../services/api';
import { useStore } from '../store/useStore';

export function AlertsScreen(): React.ReactElement {
  const { alerts, setAlerts } = useStore();
  const [refreshing, setRefreshing] = useState(false);

  const fetchAlerts = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      const data = await getAlerts();
      setAlerts(data);
    } catch (e) {
      console.error(e);
    } finally {
      setRefreshing(false);
    }
  }, [setAlerts]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  return (
    <View style={styles.container}>
      <FlatList
        data={alerts}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchAlerts(true)}
            tintColor="#3B3BDE"
            colors={['#3B3BDE']}
          />
        }
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
