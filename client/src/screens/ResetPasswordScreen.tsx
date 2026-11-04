import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useAuthStore } from '../store/useAuthStore';
import { evaluatePasswordStrength } from '../utils/authValidation';
import { Ionicons } from '@expo/vector-icons';
import { AuthButton } from '../components/auth/AuthShell';
import { Field } from '../components/ui/Field';
import { AnimatedBar } from '../components/motion/AnimatedBar';
import { createStyles, useTheme } from '../theme';

export function ResetPasswordScreen({ onBack, onComplete }: { onBack: () => void; onComplete: () => void }): React.ReactElement {
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const { resetPassword, loading, authError, fieldErrors, clearErrors } = useAuthStore();
  const { c } = useTheme();
  const styles = useStyles();

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
    <View>
      <Text style={styles.heading}>Set a new password</Text>
      <Text style={styles.subheading}>Paste the token from your email, then choose a new password.</Text>

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
        label="Reset token"
        icon="key-outline"
        placeholder="Paste 64-character token"
        value={token}
        onChangeText={setToken}
        autoCapitalize="none"
        autoCorrect={false}
        error={fieldErrors.token}
      />

      <Field
        label="New password"
        icon="lock-closed-outline"
        style={styles.passwordInput}
        placeholder="At least 8 characters"
        textContentType="newPassword"
        value={password}
        onChangeText={setPassword}
        secureTextEntry={!showPassword}
        error={fieldErrors.password}
        trailing={
          <TouchableOpacity
            style={styles.visibilityToggle}
            onPress={() => setShowPassword((prev) => !prev)}
            accessibilityRole="button"
            accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            activeOpacity={0.7}
          >
            <Ionicons
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={c.textSubtle}
            />
          </TouchableOpacity>
        }
      />

      {password ? (
        <View style={styles.strengthContainer}>
          <View style={styles.strengthTrack}>
            <AnimatedBar progress={strength.score / 4} color={strength.color} height={4} />
          </View>
          <Text style={[styles.strengthLabel, { color: strength.color }]}>{strength.label}</Text>
        </View>
      ) : null}

      <Field
        label="Confirm new password"
        icon="shield-checkmark-outline"
        style={styles.passwordInput}
        placeholder="Re-enter password"
        textContentType="newPassword"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry={!showConfirmPassword}
        onSubmitEditing={handleReset}
        error={fieldErrors.confirmPassword}
        trailing={
          <TouchableOpacity
            style={styles.visibilityToggle}
            onPress={() => setShowConfirmPassword((prev) => !prev)}
            accessibilityRole="button"
            accessibilityLabel={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            activeOpacity={0.7}
          >
            <Ionicons
              name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={c.textSubtle}
            />
          </TouchableOpacity>
        }
      />

      <AuthButton label="Update password" onPress={handleReset} loading={loading} />

      <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7} accessibilityRole="button">
        <Ionicons name="arrow-back" size={16} color={c.textMuted} />
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>
    </View>
  );
}

const useStyles = createStyles((c) => ({
  heading: {
    fontSize: 18,
    fontWeight: '700',
    color: c.text,
    marginBottom: 4,
  },
  subheading: {
    fontSize: 13,
    lineHeight: 19,
    color: c.textMuted,
    marginBottom: 18,
  },
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
  passwordInput: {
    paddingRight: 46,
  },
  visibilityToggle: {
    position: 'absolute',
    right: 14,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  strengthContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: -4,
    marginBottom: 14,
  },
  strengthTrack: {
    flex: 1,
  },
  strengthLabel: {
    fontSize: 12,
    fontWeight: '600',
    minWidth: 72,
    textAlign: 'right',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
  },
  backText: {
    fontSize: 14,
    fontWeight: '500',
    color: c.textMuted,
  },
}));
