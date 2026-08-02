import React, { useState } from 'react';
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
import { evaluatePasswordStrength } from '../utils/authValidation';

export function ResetPasswordScreen({
  onBack,
  onComplete
}: {
  onBack: () => void;
  onComplete: () => void;
}): React.ReactElement {
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const { resetPassword, loading, authError, fieldErrors, clearErrors } = useAuthStore();
  const strength = evaluatePasswordStrength(password);

  const handleSubmit = async () => {
    if (loading) return;
    const res = await resetPassword({ token: token.trim(), password, confirmPassword });
    if (res.success) {
      setSuccessMessage(res.message);
      setTimeout(() => {
        onComplete();
      }, 2000);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.title}>Set New Password</Text>
          <Text style={styles.subtitle}>Enter your reset token and choose a secure new password</Text>

          {successMessage ? (
            <View style={styles.successBanner}>
              <Text style={styles.successBannerText}>{successMessage}</Text>
              <Text style={styles.redirectText}>Redirecting to Sign In...</Text>
            </View>
          ) : null}

          {authError ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>{authError}</Text>
            </View>
          ) : null}

          {/* Reset Token */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Reset Token</Text>
            <TextInput
              style={[styles.input, fieldErrors.token ? styles.inputError : null]}
              placeholder="Paste reset token here"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="none"
              autoCorrect={false}
              value={token}
              onChangeText={(text) => { clearErrors(); setToken(text); }}
            />
            {fieldErrors.token ? <Text style={styles.fieldErrorText}>{fieldErrors.token}</Text> : null}
          </View>

          {/* New Password */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>New Password</Text>
            <View style={[styles.passwordContainer, fieldErrors.password ? styles.inputError : null]}>
              <TextInput
                style={styles.passwordInput}
                placeholder="At least 8 chars (A-z, 0-9, @#$)"
                placeholderTextColor="#9CA3AF"
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={(text) => { clearErrors(); setPassword(text); }}
              />
              <TouchableOpacity style={styles.toggleBtn} onPress={() => setShowPassword(!showPassword)}>
                <Text style={styles.toggleBtnText}>{showPassword ? 'Hide' : 'Show'}</Text>
              </TouchableOpacity>
            </View>
            {fieldErrors.password ? <Text style={styles.fieldErrorText}>{fieldErrors.password}</Text> : null}

            {password ? (
              <View style={styles.strengthContainer}>
                <View style={styles.strengthBarBg}>
                  <View
                    style={[
                      styles.strengthBarFill,
                      { width: `${(strength.score / 4) * 100}%`, backgroundColor: strength.color }
                    ]}
                  />
                </View>
                <Text style={[styles.strengthText, { color: strength.color }]}>
                  Strength: {strength.label}
                </Text>
              </View>
            ) : null}
          </View>

          {/* Confirm Password */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Confirm New Password</Text>
            <TextInput
              style={[styles.input, fieldErrors.confirmPassword ? styles.inputError : null]}
              placeholder="Re-enter new password"
              placeholderTextColor="#9CA3AF"
              secureTextEntry={!showPassword}
              value={confirmPassword}
              onChangeText={(text) => { clearErrors(); setConfirmPassword(text); }}
            />
            {fieldErrors.confirmPassword ? <Text style={styles.fieldErrorText}>{fieldErrors.confirmPassword}</Text> : null}
          </View>

          <TouchableOpacity
            style={[styles.btn, loading ? styles.btnDisabled : null]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.btnText}>Update Password</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={onBack} style={styles.backBtn}>
            <Text style={styles.backBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: { flexGrow: 1, justifyContent: 'center', backgroundColor: '#F3F4F6', padding: 20 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 3 },
  title: { fontSize: 24, fontWeight: '800', color: '#1E293B', textAlign: 'center' },
  subtitle: { fontSize: 13, color: '#64748B', textAlign: 'center', marginBottom: 20, fontWeight: '500' },
  successBanner: { backgroundColor: '#D1FAE5', borderColor: '#6EE7B7', borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 16 },
  successBannerText: { color: '#065F46', fontSize: 13, textAlign: 'center', fontWeight: '500' },
  redirectText: { color: '#047857', fontSize: 12, textAlign: 'center', fontWeight: '700', marginTop: 4 },
  errorBanner: { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5', borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 16 },
  errorBannerText: { color: '#991B1B', fontSize: 13, textAlign: 'center', fontWeight: '500' },
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input: { height: 48, backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 10, paddingHorizontal: 14, fontSize: 15, color: '#111827' },
  passwordContainer: { flexDirection: 'row', alignItems: 'center', height: 48, backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 10, paddingHorizontal: 14 },
  passwordInput: { flex: 1, fontSize: 15, color: '#111827' },
  toggleBtn: { paddingLeft: 8 },
  toggleBtnText: { color: '#4B5563', fontSize: 13, fontWeight: '600' },
  inputError: { borderColor: '#EF4444', backgroundColor: '#FEF2F2' },
  fieldErrorText: { color: '#DC2626', fontSize: 12, marginTop: 4, fontWeight: '500' },
  strengthContainer: { marginTop: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  strengthBarBg: { flex: 1, height: 4, backgroundColor: '#E5E7EB', borderRadius: 2, overflow: 'hidden', marginRight: 10 },
  strengthBarFill: { height: '100%', borderRadius: 2 },
  strengthText: { fontSize: 11, fontWeight: '700' },
  btn: { height: 50, backgroundColor: '#2563EB', borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginTop: 8 },
  btnDisabled: { backgroundColor: '#93C5FD' },
  btnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  backBtn: { marginTop: 16, alignItems: 'center' },
  backBtnText: { color: '#6B7280', fontSize: 14, fontWeight: '600' }
});
