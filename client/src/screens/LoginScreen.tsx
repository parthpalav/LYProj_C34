import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Animated, Easing, ActivityIndicator,
  Dimensions, Image,
} from 'react-native';
import { useAuthStore } from '../store/useAuthStore';
import { RegisterScreen } from './RegisterScreen';
import { ForgotPasswordScreen } from './ForgotPasswordScreen';

const finauraLogo = require('../assets/finaura_logo.png');

const BLUE = '#3B3BDE';

export function LoginScreen(): React.ReactElement {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showRegister, setShowRegister] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const { login, loading, authError, fieldErrors, clearErrors } = useAuthStore();

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const logoScale = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.spring(logoScale, { toValue: 1, friction: 5, tension: 40, useNativeDriver: true }),
    ]).start();
  }, [fadeAnim, slideAnim, logoScale]);

  if (showRegister) {
    return <RegisterScreen onBack={() => { setShowRegister(false); clearErrors(); }} />;
  }

  if (showForgotPassword) {
    return <ForgotPasswordScreen onBack={() => { setShowForgotPassword(false); clearErrors(); }} />;
  }

  const handleLogin = () => {
    if (!email.trim() || !password.trim()) return;
    clearErrors();
    login({ email: email.trim().toLowerCase(), password });
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Animated.View style={[styles.inner, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        {/* Logo */}
        <Animated.View style={[styles.logoWrap, { transform: [{ scale: logoScale }] }]}>
          <Image source={finauraLogo} style={styles.logoImage} resizeMode="contain" />
        </Animated.View>

        <Text style={styles.title}>FINAURA</Text>
        <Text style={styles.subtitle}>Your Autonomous Financial Digital Twin</Text>

        {/* Error Banner */}
        {authError ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{authError}</Text>
          </View>
        ) : null}

        {/* Email */}
        <View style={styles.inputWrap}>
          <Text style={styles.inputLabel}>Email</Text>
          <TextInput
            style={[styles.input, fieldErrors.email && styles.inputError]}
            placeholder="you@example.com"
            placeholderTextColor="#9CA3AF"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            editable={!loading}
          />
          {fieldErrors.email ? <Text style={styles.fieldError}>{fieldErrors.email}</Text> : null}
        </View>

        {/* Password */}
        <View style={styles.inputWrap}>
          <View style={styles.passwordLabelRow}>
            <Text style={styles.inputLabel}>Password</Text>
            <TouchableOpacity onPress={() => { clearErrors(); setShowForgotPassword(true); }}>
              <Text style={styles.forgotText}>Forgot?</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            style={[styles.input, fieldErrors.password && styles.inputError]}
            placeholder="••••••••"
            placeholderTextColor="#9CA3AF"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            editable={!loading}
            onSubmitEditing={handleLogin}
          />
          {fieldErrors.password ? <Text style={styles.fieldError}>{fieldErrors.password}</Text> : null}
        </View>

        {/* Sign In Button */}
        <TouchableOpacity
          style={[styles.btn, loading && styles.btnDisabled]}
          activeOpacity={0.85}
          onPress={handleLogin}
          disabled={loading || !email.trim() || !password.trim()}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>Sign In</Text>
          )}
        </TouchableOpacity>

        {/* Register Link */}
        <TouchableOpacity
          style={styles.linkWrap}
          onPress={() => { clearErrors(); setShowRegister(true); }}
          disabled={loading}
        >
          <Text style={styles.linkText}>Don't have an account? </Text>
          <Text style={styles.linkBold}>Create one</Text>
        </TouchableOpacity>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F6FA',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  inner: {
    alignItems: 'center',
  },
  logoWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: BLUE,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  logoImage: { width: 58, height: 58, borderRadius: 29 },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: '#111827',
    letterSpacing: 2,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 32,
    textAlign: 'center',
  },
  errorBanner: {
    width: '100%',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 18,
  },
  inputWrap: {
    width: '100%',
    marginBottom: 16,
  },
  passwordLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  forgotText: {
    fontSize: 12,
    color: BLUE,
    fontWeight: '700',
    marginBottom: 6,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    height: 52,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 16,
    fontSize: 15,
    color: '#111827',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  inputError: {
    borderColor: '#EF4444',
  },
  fieldError: {
    color: '#EF4444',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },
  btn: {
    width: '100%',
    height: 54,
    backgroundColor: BLUE,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: BLUE,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  btnDisabled: {
    opacity: 0.7,
  },
  btnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  linkWrap: {
    flexDirection: 'row',
    marginTop: 24,
  },
  linkText: {
    color: '#6B7280',
    fontSize: 14,
  },
  linkBold: {
    color: BLUE,
    fontSize: 14,
    fontWeight: '700',
  },
});
