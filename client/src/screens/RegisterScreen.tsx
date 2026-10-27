import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useAuthStore } from '../store/useAuthStore';
import { evaluatePasswordStrength } from '../utils/authValidation';
import { Ionicons } from '@expo/vector-icons';
import { AuthButton } from '../components/auth/AuthShell';
import { AuthInput } from '../components/auth/AuthInput';
import { createStyles, useTheme } from '../theme';
import { timing } from '../motion';

interface Props {
  onBack?: () => void;
  /** Error banner owned by the auth shell (shakes on new errors). */
  errorBanner?: React.ReactNode;
}

/** One of four strength segments; fills with the strength color. */
function StrengthSegment({ filled, color }: { filled: boolean; color: string }) {
  const styles = useStyles();
  const fill = useSharedValue(filled ? 1 : 0);
  useEffect(() => {
    fill.value = withTiming(filled ? 1 : 0, timing());
  }, [filled, fill]);
  const fillStyle = useAnimatedStyle(() => ({ opacity: fill.value }));
  return (
    <View style={styles.segment}>
      <Animated.View style={[styles.segmentFill, { backgroundColor: color }, fillStyle]} />
    </View>
  );
}

export function RegisterScreen({ errorBanner }: Props): React.ReactElement {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { register, loading, fieldErrors, clearErrors } = useAuthStore();
  const { c } = useTheme();
  const styles = useStyles();

  const strength = evaluatePasswordStrength(password);

  const handleRegister = () => {
    if (!name.trim() || !email.trim() || !password.trim()) return;
    clearErrors();
    register({
      name: name.trim(),
      email: email.trim(),
      password,
      confirmPassword
    });
  };

  return (
    <View>
      {errorBanner}

      <AuthInput
        label="Full name"
        icon="person-outline"
        placeholder="Your full name"
        textContentType="name"
        autoComplete="name"
        value={name}
        onChangeText={setName}
        editable={!loading}
        error={fieldErrors.name}
      />

      <AuthInput
        label="Email"
        icon="mail-outline"
        placeholder="you@example.com"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="emailAddress"
        autoComplete="email"
        value={email}
        onChangeText={setEmail}
        editable={!loading}
        error={fieldErrors.email}
      />

      <AuthInput
        label="Password"
        icon="lock-closed-outline"
        style={styles.passwordInput}
        placeholder="At least 8 characters"
        textContentType="newPassword"
        secureTextEntry={!showPassword}
        value={password}
        onChangeText={setPassword}
        editable={!loading}
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
        <View style={styles.strengthContainer} accessibilityLabel={`Password strength: ${strength.label}`}>
          <View style={styles.strengthTrack}>
            {[1, 2, 3, 4].map((i) => (
              <StrengthSegment key={i} filled={strength.score >= i} color={strength.color} />
            ))}
          </View>
          <Text style={[styles.strengthLabel, { color: strength.color }]}>{strength.label}</Text>
        </View>
      ) : null}

      <AuthInput
        label="Confirm password"
        icon="shield-checkmark-outline"
        style={styles.passwordInput}
        placeholder="Re-enter password"
        textContentType="newPassword"
        secureTextEntry={!showConfirmPassword}
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        editable={!loading}
        onSubmitEditing={handleRegister}
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

      <AuthButton
        label="Create account"
        onPress={handleRegister}
        loading={loading}
        disabled={!name.trim() || !email.trim() || !password.trim() || !confirmPassword.trim()}
      />
    </View>
  );
}

const useStyles = createStyles((c) => ({
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
    flexDirection: 'row',
    gap: 4,
  },
  segment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    backgroundColor: c.surfaceAlt,
  },
  segmentFill: {
    flex: 1,
  },
  strengthLabel: {
    fontSize: 12,
    fontWeight: '600',
    minWidth: 72,
    textAlign: 'right',
  },
}));
