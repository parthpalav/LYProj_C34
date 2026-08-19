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

export function ResetPasswordScreen({ onBack, onComplete }: { onBack: () => void; onComplete: () => void }): React.ReactElement {
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const { resetPassword, loading, authError, fieldErrors, clearErrors } = useAuthStore();
  const strength = evaluatePasswordStrength(password);

  const handleReset = async () => {
    if (loading) return;
    clearErrors();
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
          <Text style={styles.subtitle}>Enter the token sent to your email and your new password</Text>

          {successMessage ? (
            <View style={styles.successBanner}>
              <Text style={styles.successBannerText}>{successMessage}</Text>
            </View>
          ) : null}

          {authError ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>{authError}</Text>
            </View>
          ) : null}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Reset Token</Text>
            <TextInput
              style={[styles.input, fieldErrors.token && styles.inputError]}
              placeholder="Paste 64-character token"
              placeholderTextColor="#9CA3AF"
              value={token}
              onChangeText={setToken}
              autoCapitalize="none"
            />
            {fieldErrors.token ? <Text style={styles.fieldError}>{fieldErrors.token}</Text> : null}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>New Password</Text>
            <TextInput
              style={[styles.input, fieldErrors.password && styles.inputError]}
              placeholder="Min. 8 chars, mixed case, number & symbol"
              placeholderTextColor="#9CA3AF"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
            {password ? (
              <View style={styles.strengthContainer}>
                <View style={[styles.strengthBar, { backgroundColor: strength.color, width: `${(strength.score / 4) * 100}%` }]} />
                <Text style={[styles.strengthLabel, { color: strength.color }]}>{strength.label}</Text>
              </View>
            ) : null}
            {fieldErrors.password ? <Text style={styles.fieldError}>{fieldErrors.password}</Text> : null}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Confirm New Password</Text>
            <TextInput
              style={[styles.input, fieldErrors.confirmPassword && styles.inputError]}
              placeholder="Re-enter password"
              placeholderTextColor="#9CA3AF"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
            />
            {fieldErrors.confirmPassword ? <Text style={styles.fieldError}>{fieldErrors.confirmPassword}</Text> : null}
          </View>

          <TouchableOpacity style={styles.submitBtn} onPress={handleReset} disabled={loading} activeOpacity={0.8}>
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitBtnText}>Update Password</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.8}>
            <Text style={styles.backBtnText}>← Back</Text>
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
  strengthContainer: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  strengthBar: {
    height: 4,
    borderRadius: 2,
    flex: 1
  },
  strengthLabel: {
    fontSize: 11,
    fontWeight: '600'
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
    padding: 12,
    borderRadius: 10,
    marginBottom: 16
  },
  successBannerText: {
    color: '#15803D',
    fontSize: 13,
    fontWeight: '500'
  }
});
