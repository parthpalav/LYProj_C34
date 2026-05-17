import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { useAuthStore } from '../store/useAuthStore';

export function RegisterScreen({ onBack }: { onBack?: () => void }): React.ReactElement {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { register, loading } = useAuthStore();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create Account</Text>
      <TextInput style={styles.input} placeholder="Name" value={name} onChangeText={setName} />
      <TextInput style={styles.input} placeholder="Email" autoCapitalize="none" value={email} onChangeText={setEmail} />
      <TextInput style={styles.input} placeholder="Password" secureTextEntry value={password} onChangeText={setPassword} />

      <TouchableOpacity style={styles.btn} onPress={() => register({ name, email, password })} disabled={loading}>
        <Text style={styles.btnText}>{loading ? 'Creating...' : 'Register'}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onBack}>
        <Text style={styles.link}>Back to Sign In</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#F4F6FA', justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '800', color: '#111827', marginBottom: 16 },
  input: { height: 48, backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 12 },
  btn: { height: 48, backgroundColor: '#3B3BDE', borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  btnText: { color: '#fff', fontWeight: '700' },
  link: { color: '#3B3BDE', marginTop: 16, fontWeight: '600', textAlign: 'center' }
});
