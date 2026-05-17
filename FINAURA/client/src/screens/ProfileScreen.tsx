import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useAuthStore } from '../store/useAuthStore';
import { formatCurrency } from '../utils/formatCurrency';

export function ProfileScreen(): React.ReactElement {
  const { user, logout } = useAuthStore();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profile</Text>
      <Text style={styles.row}>Name: {user?.name}</Text>
      <Text style={styles.row}>Email: {user?.email}</Text>
      <Text style={styles.row}>Monthly Income: {formatCurrency(user?.income || 0)}</Text>

      <TouchableOpacity style={styles.btn} onPress={logout}>
        <Text style={styles.btnText}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F6FA', padding: 16 },
  title: { fontSize: 20, fontWeight: '800', color: '#111827', marginBottom: 12 },
  row: { fontSize: 13, color: '#374151', marginBottom: 6 },
  btn: { marginTop: 16, backgroundColor: '#EF4444', padding: 12, borderRadius: 10, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700' }
});
