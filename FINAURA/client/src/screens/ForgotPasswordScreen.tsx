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
import { ResetPasswordScreen } from './ResetPasswordScreen';

export function ForgotPasswordScreen({ onBack }: { onBack: () => void }): React.ReactElement {
  const [email, setEmail] = useState('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showResetForm, setShowResetForm] = useState(false);

  const { forgotPassword, loading, authError, fieldErrors, clearErrors } = useAuthStore();

  const handleSubmit = async () => {
    if (loading) return;
    const res = await forgotPassword(email.trim());
    if (res.success) {
      setSuccessMessage(res.message);
    }
  };

  if (showResetForm) {
    return <ResetPasswordScreen onBack={() => setShowResetForm(false)} onComplete={onBack} />;
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.title}>Reset Password</Text>
          <Text style={styles.subtitle}>Enter your email to receive a password reset token</Text>

          {successMessage ? (
            <View style={styles.successBanner}>
              <Text style={styles.successBannerText}>{successMessage}</Text>
              <TouchableOpacity style={styles.resetBtn} onPress={() => setShowResetForm(true)}>
                <Text style={styles.resetBtnText}>I have a reset token → Enter Token</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {authError ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>{authError}</Text>
            </View>
          ) : null}

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
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
            />
            {fieldErrors.email ? <Text style={styles.fieldErrorText}>{fieldErrors.email}</Text> : null}
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
              <Text style={styles.btnText}>Send Reset Link</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setShowResetForm(true)} style={styles.tokenLinkBtn}>
            <Text style={styles.tokenLinkText}>Already have a token? Enter reset token</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={onBack} style={styles.backBtn}>
            <Text style={styles.backBtnText}>Back to Sign In</Text>
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
  successBannerText: { color: '#065F46', fontSize: 13, textAlign: 'center', fontWeight: '500', marginBottom: 8 },
  resetBtn: { backgroundColor: '#059669', paddingVertical: 8, borderRadius: 6, alignItems: 'center' },
  resetBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  errorBanner: { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5', borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 16 },
  errorBannerText: { color: '#991B1B', fontSize: 13, textAlign: 'center', fontWeight: '500' },
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input: { height: 48, backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 10, paddingHorizontal: 14, fontSize: 15, color: '#111827' },
  inputError: { borderColor: '#EF4444', backgroundColor: '#FEF2F2' },
  fieldErrorText: { color: '#DC2626', fontSize: 12, marginTop: 4, fontWeight: '500' },
  btn: { height: 50, backgroundColor: '#2563EB', borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginTop: 8 },
  btnDisabled: { backgroundColor: '#93C5FD' },
  btnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  tokenLinkBtn: { marginTop: 16, alignItems: 'center' },
  tokenLinkText: { color: '#2563EB', fontSize: 13, fontWeight: '600' },
  backBtn: { marginTop: 12, alignItems: 'center' },
  backBtnText: { color: '#6B7280', fontSize: 14, fontWeight: '600' }
});
