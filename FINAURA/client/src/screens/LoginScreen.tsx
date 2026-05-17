import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { useAuthStore } from '../store/useAuthStore';
import { RegisterScreen } from './RegisterScreen';

export function LoginScreen(): React.ReactElement {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showRegister, setShowRegister] = useState(false);
  const { login, loading } = useAuthStore();

  if (showRegister) {
    return <RegisterScreen onBack={() => setShowRegister(false)} />;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>FINAURA</Text>
      <Text style={styles.subtitle}>Welcome back</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <TouchableOpacity style={styles.btn} onPress={() => login({ email, password })} disabled={loading}>
        <Text style={styles.btnText}>{loading ? 'Signing in...' : 'Sign In'}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => setShowRegister(true)}>
        <Text style={styles.link}>Create a new account</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#F4F6FA', justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: '800', color: '#111827' },
  subtitle: { fontSize: 14, color: '#6B7280', marginBottom: 20 },
  input: { height: 48, backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 12 },
  btn: { height: 48, backgroundColor: '#3B3BDE', borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  btnText: { color: '#fff', fontWeight: '700' },
  link: { color: '#3B3BDE', marginTop: 16, fontWeight: '600', textAlign: 'center' }
});
