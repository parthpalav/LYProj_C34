import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store/useAuthStore';
import { ResetPasswordScreen } from './ResetPasswordScreen';
import { AuthButton } from '../components/auth/AuthShell';
import { Field } from '../components/ui/Field';
import { createStyles, useTheme } from '../theme';
import { enterUp } from '../motion';

export function ForgotPasswordScreen({ onBack }: { onBack: () => void }): React.ReactElement {
  const [email, setEmail] = useState('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showResetForm, setShowResetForm] = useState(false);
  const { forgotPassword, loading, authError, fieldErrors, clearErrors } = useAuthStore();
  const { c } = useTheme();
  const styles = useStyles();

  const handleSubmit = async () => {
    if (loading) return;
    clearErrors();
    const res = await forgotPassword(email.trim());
    if (res.success) {
      setSuccessMessage(res.message);
    }
  };

  if (showResetForm) {
    return (
      <Animated.View entering={enterUp(0)}>
        <ResetPasswordScreen onBack={() => setShowResetForm(false)} onComplete={onBack} />
      </Animated.View>
    );
  }

  return (
    <View>
      {successMessage ? (
        <View style={[styles.banner, styles.successBanner]}>
          <Ionicons name="checkmark-circle" size={18} color={c.successStrong} />
          <Text style={[styles.bannerText, { color: c.successStrong }]}>{successMessage}</Text>
        </View>
      ) : null}

      {authError ? (
        <View style={[styles.banner, styles.errorBanner]}>
          <Ionicons name="alert-circle" size={18} color={c.danger} />
          <Text style={[styles.bannerText, { color: c.dangerStrong }]}>{authError}</Text>
        </View>
      ) : null}

      <Field
        label="Email address"
        icon="mail-outline"
        placeholder="you@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
        textContentType="emailAddress"
        value={email}
        onChangeText={setEmail}
        onSubmitEditing={handleSubmit}
        error={fieldErrors.email}
      />

      <AuthButton label="Send reset link" onPress={handleSubmit} loading={loading} disabled={!email.trim()} />

      <TouchableOpacity style={styles.secondaryBtn} onPress={() => setShowResetForm(true)} activeOpacity={0.7}>
        <Text style={styles.secondaryText}>I already have a reset token</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7} accessibilityRole="button">
        <Ionicons name="arrow-back" size={16} color={c.textMuted} />
        <Text style={styles.backText}>Back to sign in</Text>
      </TouchableOpacity>
    </View>
  );
}

const useStyles = createStyles((c) => ({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },
  successBanner: {
    backgroundColor: c.successSoft,
  },
  errorBanner: {
    backgroundColor: c.dangerSoft,
  },
  bannerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
  },
  secondaryBtn: {
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 4,
  },
  secondaryText: {
    fontSize: 14,
    fontWeight: '600',
    color: c.primary,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
  },
  backText: {
    fontSize: 14,
    fontWeight: '500',
    color: c.textMuted,
  },
}));
