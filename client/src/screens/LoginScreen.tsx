import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import Animated from 'react-native-reanimated';
import { useAuthStore } from '../store/useAuthStore';
import { RegisterScreen } from './RegisterScreen';
import { ForgotPasswordScreen } from './ForgotPasswordScreen';
import { Ionicons } from '@expo/vector-icons';
import { AuthButton, AuthMode, AuthShell } from '../components/auth/AuthShell';
import { Field } from '../components/ui/Field';
import { useShake } from '../components/motion/useShake';
import { createStyles, useTheme } from '../theme';
import { enterUp } from '../motion';

const COPY = {
  login: { title: 'Welcome back.', subtitle: 'Sign in to your financial twin.' },
  register: { title: 'Money, with clarity.', subtitle: 'Create your FINAURA account in under a minute.' },
  forgot: { title: 'Reset password.', subtitle: "We'll email you a secure reset token." },
};

export function LoginScreen(): React.ReactElement {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const { login, loading, authError, fieldErrors, clearErrors } = useAuthStore();
  const { c } = useTheme();
  const styles = useStyles();
  const { style: shakeStyle, shake } = useShake();

  useEffect(() => {
    if (authError) shake();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authError]);

  const view = showForgotPassword ? 'forgot' : showRegister ? 'register' : 'login';

  const switchMode = (mode: AuthMode) => {
    clearErrors();
    setShowRegister(mode === 'register');
  };

  const handleLogin = () => {
    if (!email.trim() || !password.trim()) return;
    clearErrors();
    login({ email: email.trim().toLowerCase(), password });
  };

  const errorBanner = authError ? (
    <Animated.View style={[styles.errorBanner, shakeStyle]}>
      <Ionicons name="alert-circle" size={18} color={c.danger} />
      <Text style={styles.errorText}>{authError}</Text>
    </Animated.View>
  ) : null;

  return (
    <AuthShell
      title={COPY[view].title}
      subtitle={COPY[view].subtitle}
      mode={view === 'forgot' ? undefined : view}
      onModeChange={switchMode}
    >
      {/* Keyed so each form fades in when the mode changes */}
      <Animated.View key={view} entering={enterUp(0)}>
        {view === 'register' ? (
          <RegisterScreen onBack={() => { setShowRegister(false); clearErrors(); }} errorBanner={errorBanner} />
        ) : view === 'forgot' ? (
          <ForgotPasswordScreen onBack={() => { setShowForgotPassword(false); clearErrors(); }} />
        ) : (
          <View>
            {errorBanner}

            <Field
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

            <Field
              label="Password"
              icon="lock-closed-outline"
              labelAction={
                <TouchableOpacity onPress={() => { clearErrors(); setShowForgotPassword(true); }} hitSlop={8}>
                  <Text style={styles.forgotText}>Forgot?</Text>
                </TouchableOpacity>
              }
              style={styles.passwordInput}
              placeholder="Your password"
              textContentType="password"
              autoComplete="password"
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
              editable={!loading}
              onSubmitEditing={handleLogin}
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

            <AuthButton
              label="Sign in"
              onPress={handleLogin}
              loading={loading}
              disabled={!email.trim() || !password.trim()}
            />
          </View>
        )}
      </Animated.View>
    </AuthShell>
  );
}

const useStyles = createStyles((c) => ({
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: c.dangerSoft,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: c.dangerStrong,
  },
  forgotText: {
    fontSize: 13,
    fontWeight: '600',
    color: c.primary,
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
}));
