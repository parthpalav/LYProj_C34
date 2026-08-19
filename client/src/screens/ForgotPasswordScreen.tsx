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
    clearErrors();
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
              style={[styles.input, fieldErrors.email && styles.inputError]}
              placeholder="you@example.com"
              placeholderTextColor="#9CA3AF"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
            {fieldErrors.email ? <Text style={styles.fieldError}>{fieldErrors.email}</Text> : null}
          </View>

          <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={loading} activeOpacity={0.8}>
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitBtnText}>Send Reset Link</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.manualTokenBtn} onPress={() => setShowResetForm(true)} activeOpacity={0.8}>
            <Text style={styles.manualTokenBtnText}>Already have a token? Enter it here</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.8}>
            <Text style={styles.backBtnText}>← Back to Sign In</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#F3F4F6'
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 6
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 20
  },
  inputGroup: {
    marginBottom: 16
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#F9FAFB'
  },
  inputError: {
    borderColor: '#EF4444'
  },
  fieldError: {
    color: '#EF4444',
    fontSize: 12,
    marginTop: 4
  },
  submitBtn: {
    backgroundColor: '#2563EB',
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700'
  },
  manualTokenBtn: {
    marginTop: 16,
    alignItems: 'center'
  },
  manualTokenBtnText: {
    color: '#2563EB',
    fontSize: 13,
    fontWeight: '600'
  },
  backBtn: {
    marginTop: 16,
    alignItems: 'center'
  },
  backBtnText: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '600'
  },
  errorBanner: {
    backgroundColor: '#FEE2E2',
    padding: 12,
    borderRadius: 10,
    marginBottom: 16
  },
  errorBannerText: {
    color: '#B91C1C',
    fontSize: 13,
    fontWeight: '500'
  },
  successBanner: {
    backgroundColor: '#DCFCE7',
    padding: 14,
    borderRadius: 12,
    marginBottom: 16
  },
  successBannerText: {
    color: '#15803D',
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 8
  },
  resetBtn: {
    backgroundColor: '#16A34A',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center'
  },
  resetBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700'
  }
});
