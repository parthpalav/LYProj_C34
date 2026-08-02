import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView
} from 'react-native';
import { useAuthStore } from '../store/useAuthStore';
import { RegisterScreen } from './RegisterScreen';
import { ForgotPasswordScreen } from './ForgotPasswordScreen';

export function LoginScreen(): React.ReactElement {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [activeTab, setActiveTab] = useState<'login' | 'register' | 'forgot'>('login');

  const passwordRef = useRef<TextInput>(null);

  const { login, loading, authError, fieldErrors, clearErrors } = useAuthStore();

  const handleLogin = async () => {
    if (loading) return;
    await login({ email: email.trim(), password });
  };

  if (activeTab === 'register') {
    return <RegisterScreen onBack={() => { clearErrors(); setActiveTab('login'); }} />;
  }

  if (activeTab === 'forgot') {
    return <ForgotPasswordScreen onBack={() => { clearErrors(); setActiveTab('login'); }} />;
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.brandTitle}>FINAURA</Text>
          <Text style={styles.brandSubtitle}>Secure Financial Intelligence</Text>

          {authError ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>{authError}</Text>
            </View>
          ) : null}

          {/* Email Field */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email Address</Text>
            <TextInput
              style={[styles.input, fieldErrors.email ? styles.inputError : null]}
              placeholder="name@example.com"
              placeholderTextColor="#9CA3AF"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              value={email}
              onChangeText={(text) => { clearErrors(); setEmail(text); }}
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
            />
            {fieldErrors.email ? <Text style={styles.fieldErrorText}>{fieldErrors.email}</Text> : null}
          </View>

          {/* Password Field */}
          <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Password</Text>
              <TouchableOpacity onPress={() => { clearErrors(); setActiveTab('forgot'); }}>
                <Text style={styles.forgotLink}>Forgot password?</Text>
              </TouchableOpacity>
            </View>
            <View style={[styles.passwordContainer, fieldErrors.password ? styles.inputError : null]}>
              <TextInput
                ref={passwordRef}
                style={styles.passwordInput}
                placeholder="Enter password"
                placeholderTextColor="#9CA3AF"
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={(text) => { clearErrors(); setPassword(text); }}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />
              <TouchableOpacity
                style={styles.toggleBtn}
                onPress={() => setShowPassword(!showPassword)}
                activeOpacity={0.7}
              >
                <Text style={styles.toggleBtnText}>{showPassword ? 'Hide' : 'Show'}</Text>
              </TouchableOpacity>
            </View>
            {fieldErrors.password ? <Text style={styles.fieldErrorText}>{fieldErrors.password}</Text> : null}
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.btn, loading ? styles.btnDisabled : null]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.btnText}>Sign In</Text>
            )}
          </TouchableOpacity>

          {/* Signup Switch */}
          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => { clearErrors(); setActiveTab('register'); }}>
              <Text style={styles.signupLink}>Create account</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: { flexGrow: 1, justifyContent: 'center', backgroundColor: '#F3F4F6', padding: 20 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 3 },
  brandTitle: { fontSize: 30, fontWeight: '900', color: '#1E293B', textAlign: 'center', letterSpacing: 1 },
  brandSubtitle: { fontSize: 13, color: '#64748B', textAlign: 'center', marginBottom: 24, fontWeight: '500' },
  errorBanner: { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5', borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 16 },
  errorBannerText: { color: '#991B1B', fontSize: 13, textAlign: 'center', fontWeight: '500' },
  inputGroup: { marginBottom: 16 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  forgotLink: { fontSize: 13, fontWeight: '600', color: '#3B82F6' },
  input: { height: 48, backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 10, paddingHorizontal: 14, fontSize: 15, color: '#111827' },
  passwordContainer: { flexDirection: 'row', alignItems: 'center', height: 48, backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 10, paddingHorizontal: 14 },
  passwordInput: { flex: 1, fontSize: 15, color: '#111827' },
  toggleBtn: { paddingLeft: 8 },
  toggleBtnText: { color: '#4B5563', fontSize: 13, fontWeight: '600' },
  inputError: { borderColor: '#EF4444', backgroundColor: '#FEF2F2' },
  fieldErrorText: { color: '#DC2626', fontSize: 12, marginTop: 4, fontWeight: '500' },
  btn: { height: 50, backgroundColor: '#2563EB', borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginTop: 8 },
  btnDisabled: { backgroundColor: '#93C5FD' },
  btnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  footerRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
  footerText: { color: '#6B7280', fontSize: 14 },
  signupLink: { color: '#2563EB', fontSize: 14, fontWeight: '700' }
});
