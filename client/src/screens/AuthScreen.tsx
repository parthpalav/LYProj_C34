import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { registerUser, loginUser } from '../services/api';
import { useStore } from '../store/useStore';

interface Props {
  onAuthSuccess: () => void;
}

type AuthMode = 'signin' | 'signup';

export function AuthScreen({ onAuthSuccess }: Props): React.ReactElement {
  const { setUser } = useStore();
  const [mode, setMode] = useState<AuthMode>('signin');

  // Sign In fields
  const [signInEmail, setSignInEmail] = useState('');
  const [signInPassword, setSignInPassword] = useState('');
  const [signInPasswordVisible, setSignInPasswordVisible] = useState(false);

  // Sign Up fields
  const [signUpName, setSignUpName] = useState('');
  const [signUpEmail, setSignUpEmail] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');
  const [signUpConfirmPassword, setSignUpConfirmPassword] = useState('');
  const [signUpPasswordVisible, setSignUpPasswordVisible] = useState(false);
  const [signUpConfirmPasswordVisible, setSignUpConfirmPasswordVisible] = useState(false);

  const [loading, setLoading] = useState(false);

  // Animated underline for tab indicator
  const tabAnim = useRef(new Animated.Value(0)).current;

  const switchMode = (newMode: AuthMode) => {
    setMode(newMode);
    Animated.spring(tabAnim, {
      toValue: newMode === 'signin' ? 0 : 1,
      useNativeDriver: false,
      tension: 80,
      friction: 10,
    }).start();
  };

  const validateEmail = (email: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const handleSignIn = async () => {
    if (!signInEmail.trim() || !signInPassword.trim()) {
      Alert.alert('Missing Fields', 'Please fill in your email and password.');
      return;
    }
    if (!validateEmail(signInEmail)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }
    if (signInPassword.trim().length < 6) {
      Alert.alert('Invalid Password', 'Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    try {
      const user = await loginUser(signInEmail.trim(), signInPassword.trim());
      setUser({
        id: user.id,
        name: user.name,
        email: user.email,
        dateOfBirth: user.dateOfBirth,
        retirementAge: user.retirementAge,
        monthlyIncome: user.monthlyIncome,
        onboardingComplete: user.onboardingComplete,
        incomeType: user.incomeType,
        goals: user.goals,
      });
      onAuthSuccess();
    } catch (error: any) {
      const errorMsg = error?.response?.data?.error || error?.message || 'Login failed. Please try again.';
      Alert.alert('Login Failed', errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    if (!signUpName.trim() || !signUpEmail.trim() || !signUpPassword.trim() || !signUpConfirmPassword.trim()) {
      Alert.alert('Missing Fields', 'Please fill in all fields.');
      return;
    }
    if (!validateEmail(signUpEmail)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }
    if (signUpPassword.trim().length < 6) {
      Alert.alert('Weak Password', 'Password must be at least 6 characters.');
      return;
    }
    if (signUpPassword !== signUpConfirmPassword) {
      Alert.alert('Password Mismatch', 'Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const user = await registerUser({
        name: signUpName.trim(),
        email: signUpEmail.trim(),
        password: signUpPassword,
        incomeType: 'salary'
      });
      setUser({
        id: user.id,
        name: user.name,
        email: user.email,
        dateOfBirth: user.dateOfBirth,
        retirementAge: user.retirementAge,
        monthlyIncome: user.monthlyIncome,
        onboardingComplete: user.onboardingComplete || false,
        incomeType: user.incomeType,
        goals: user.goals,
      });
      onAuthSuccess();
    } catch (error: any) {
      const errorMsg = error?.response?.data?.error || error?.message || 'Sign up failed. Please try again.';
      Alert.alert('Sign Up Failed', errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const indicatorLeft = tabAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '50%'],
  });

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Brand Header ── */}
          <View style={styles.brandSection}>
            {/* Decorative blobs */}
            <View style={styles.blobTopRight} />
            <View style={styles.blobBottomLeft} />

            <View style={styles.logoRow}>
              <View style={styles.logoIcon}>
                <Text style={styles.logoIconText}>⟡</Text>
              </View>
              <Text style={styles.logoText}>Finaura</Text>
            </View>
            <Text style={styles.tagline}>Smart finances,{'\n'}effortlessly managed.</Text>
          </View>

          {/* ── Auth Card ── */}
          <View style={styles.card}>

            {/* Tab switcher */}
            <View style={styles.tabBar}>
              <View style={styles.tabTrack}>
                <Animated.View style={[styles.tabIndicator, { left: indicatorLeft }]} />
                <TouchableOpacity
                  style={styles.tabOption}
                  onPress={() => switchMode('signin')}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.tabLabel, mode === 'signin' && styles.tabLabelActive]}>
                    Sign In
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.tabOption}
                  onPress={() => switchMode('signup')}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.tabLabel, mode === 'signup' && styles.tabLabelActive]}>
                    Sign Up
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* ── Sign In ── */}
            {mode === 'signin' && (
              <View style={styles.formSection}>
                <Text style={styles.formTitle}>Welcome back! 👋</Text>
                <Text style={styles.formSubtitle}>Sign in to your Finaura account</Text>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Email</Text>
                  <View style={styles.inputWrapper}>
                    <Text style={styles.inputIcon}>✉</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="you@example.com"
                      placeholderTextColor="#A0AEC0"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      value={signInEmail}
                      onChangeText={setSignInEmail}
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Password</Text>
                  <View style={styles.inputWrapper}>
                    <Text style={styles.inputIcon}>🔒</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="Your password"
                      placeholderTextColor="#A0AEC0"
                      secureTextEntry={!signInPasswordVisible}
                      value={signInPassword}
                      onChangeText={setSignInPassword}
                    />
                    <TouchableOpacity
                      onPress={() => setSignInPasswordVisible(!signInPasswordVisible)}
                      style={styles.eyeBtn}
                    >
                      <Text style={styles.eyeIcon}>{signInPasswordVisible ? '🙈' : '👁'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <TouchableOpacity style={styles.forgotBtn} activeOpacity={0.7}>
                  <Text style={styles.forgotText}>Forgot password?</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.primaryBtn, loading && styles.primaryBtnDisabled]}
                  onPress={handleSignIn}
                  activeOpacity={0.85}
                  disabled={loading}
                >
                  <Text style={styles.primaryBtnText}>
                    {loading ? 'Signing in…' : 'Sign In'}
                  </Text>
                </TouchableOpacity>

                <View style={styles.dividerRow}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerLabel}>or continue with</Text>
                  <View style={styles.dividerLine} />
                </View>

                <View style={styles.socialRow}>
                  <TouchableOpacity style={styles.socialBtn} activeOpacity={0.8}>
                    <Text style={styles.socialBtnText}>G  Google</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.socialBtn} activeOpacity={0.8}>
                    <Text style={styles.socialBtnText}>  Apple</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.switchRow}>
                  <Text style={styles.switchText}>New to Finaura? </Text>
                  <TouchableOpacity onPress={() => switchMode('signup')} activeOpacity={0.7}>
                    <Text style={styles.switchLink}>Create an account</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* ── Sign Up ── */}
            {mode === 'signup' && (
              <View style={styles.formSection}>
                <Text style={styles.formTitle}>Create account 🚀</Text>
                <Text style={styles.formSubtitle}>Start your financial journey today</Text>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Full Name</Text>
                  <View style={styles.inputWrapper}>
                    <Text style={styles.inputIcon}>👤</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="Jane Doe"
                      placeholderTextColor="#A0AEC0"
                      autoCapitalize="words"
                      value={signUpName}
                      onChangeText={setSignUpName}
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Email</Text>
                  <View style={styles.inputWrapper}>
                    <Text style={styles.inputIcon}>✉</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="you@example.com"
                      placeholderTextColor="#A0AEC0"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      value={signUpEmail}
                      onChangeText={setSignUpEmail}
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Password</Text>
                  <View style={styles.inputWrapper}>
                    <Text style={styles.inputIcon}>🔒</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="Min. 6 characters"
                      placeholderTextColor="#A0AEC0"
                      secureTextEntry={!signUpPasswordVisible}
                      value={signUpPassword}
                      onChangeText={setSignUpPassword}
                    />
                    <TouchableOpacity
                      onPress={() => setSignUpPasswordVisible(!signUpPasswordVisible)}
                      style={styles.eyeBtn}
                    >
                      <Text style={styles.eyeIcon}>{signUpPasswordVisible ? '🙈' : '👁'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Confirm Password</Text>
                  <View style={styles.inputWrapper}>
                    <Text style={styles.inputIcon}>🔒</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="Re-enter password"
                      placeholderTextColor="#A0AEC0"
                      secureTextEntry={!signUpConfirmPasswordVisible}
                      value={signUpConfirmPassword}
                      onChangeText={setSignUpConfirmPassword}
                    />
                    <TouchableOpacity
                      onPress={() => setSignUpConfirmPasswordVisible(!signUpConfirmPasswordVisible)}
                      style={styles.eyeBtn}
                    >
                      <Text style={styles.eyeIcon}>{signUpConfirmPasswordVisible ? '🙈' : '👁'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <Text style={styles.termsText}>
                  By signing up, you agree to our{' '}
                  <Text style={styles.termsLink}>Terms of Service</Text>
                  {' '}and{' '}
                  <Text style={styles.termsLink}>Privacy Policy</Text>.
                </Text>

                <TouchableOpacity
                  style={[styles.primaryBtn, loading && styles.primaryBtnDisabled]}
                  onPress={handleSignUp}
                  activeOpacity={0.85}
                  disabled={loading}
                >
                  <Text style={styles.primaryBtnText}>
                    {loading ? 'Creating account…' : 'Create Account'}
                  </Text>
                </TouchableOpacity>

                <View style={styles.switchRow}>
                  <Text style={styles.switchText}>Already have an account? </Text>
                  <TouchableOpacity onPress={() => switchMode('signin')} activeOpacity={0.7}>
                    <Text style={styles.switchLink}>Sign in</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>

          <Text style={styles.footerText}>© 2025 Finaura · All rights reserved</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Design Tokens ─────────────────────────────────────────────────────────────
const BRAND_BLUE = '#3B3BDE';
const BRAND_BLUE_DARK = '#2D2DB0';
const BRAND_BLUE_LIGHT = '#EEEEFF';
const BG_COLOR = '#F0F2FF';
const CARD_BG = '#FFFFFF';
const TEXT_PRIMARY = '#1A1A2E';
const TEXT_SECONDARY = '#6B7280';
const INPUT_BG = '#F7F8FC';
const INPUT_BORDER = '#E2E8F0';
const BORDER_RADIUS = 16;

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: BG_COLOR,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 32,
  },

  // ── Brand Section ──
  brandSection: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 40,
    overflow: 'hidden',
    position: 'relative',
  },
  blobTopRight: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: BRAND_BLUE,
    opacity: 0.07,
  },
  blobBottomLeft: {
    position: 'absolute',
    bottom: 0,
    left: -30,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: BRAND_BLUE,
    opacity: 0.05,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  logoIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: BRAND_BLUE,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    shadowColor: BRAND_BLUE,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  logoIconText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
  },
  logoText: {
    fontSize: 26,
    fontWeight: '800',
    color: TEXT_PRIMARY,
    letterSpacing: 0.4,
  },
  tagline: {
    fontSize: 28,
    fontWeight: '800',
    color: TEXT_PRIMARY,
    lineHeight: 38,
    letterSpacing: -0.5,
  },

  // ── Auth Card ──
  card: {
    marginHorizontal: 16,
    backgroundColor: CARD_BG,
    borderRadius: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 8,
    overflow: 'hidden',
  },

  // ── Tab Bar ──
  tabBar: {
    padding: 8,
    backgroundColor: CARD_BG,
  },
  tabTrack: {
    flexDirection: 'row',
    backgroundColor: BRAND_BLUE_LIGHT,
    borderRadius: 14,
    height: 48,
    position: 'relative',
    overflow: 'hidden',
  },
  tabIndicator: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    width: '50%',
    backgroundColor: BRAND_BLUE,
    borderRadius: 11,
    shadowColor: BRAND_BLUE,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  tabOption: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  tabLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: BRAND_BLUE,
  },
  tabLabelActive: {
    color: '#FFFFFF',
  },

  // ── Form Section ──
  formSection: {
    padding: 24,
    paddingTop: 20,
  },
  formTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: TEXT_PRIMARY,
    marginBottom: 4,
  },
  formSubtitle: {
    fontSize: 14,
    color: TEXT_SECONDARY,
    marginBottom: 24,
  },

  // ── Input ──
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: TEXT_PRIMARY,
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: INPUT_BG,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: INPUT_BORDER,
    paddingHorizontal: 14,
    height: 52,
  },
  inputIcon: {
    fontSize: 16,
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    color: TEXT_PRIMARY,
    paddingVertical: 0,
  },
  eyeBtn: {
    padding: 4,
  },
  eyeIcon: {
    fontSize: 16,
  },

  // ── Forgot ──
  forgotBtn: {
    alignSelf: 'flex-end',
    marginTop: -6,
    marginBottom: 20,
  },
  forgotText: {
    fontSize: 13,
    fontWeight: '600',
    color: BRAND_BLUE,
  },

  // ── Primary Button ──
  primaryBtn: {
    height: 54,
    borderRadius: 27,
    backgroundColor: BRAND_BLUE,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    shadowColor: BRAND_BLUE,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  primaryBtnDisabled: {
    opacity: 0.6,
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },

  // ── Divider ──
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
    gap: 8,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: INPUT_BORDER,
  },
  dividerLabel: {
    fontSize: 12,
    color: TEXT_SECONDARY,
    fontWeight: '500',
  },

  // ── Social Buttons ──
  socialRow: {
    flexDirection: 'row',
    gap: 10,
  },
  socialBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: INPUT_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CARD_BG,
  },
  socialBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },

  // ── Switch Row ──
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  switchText: {
    fontSize: 14,
    color: TEXT_SECONDARY,
  },
  switchLink: {
    fontSize: 14,
    fontWeight: '700',
    color: BRAND_BLUE,
  },

  // ── Terms ──
  termsText: {
    fontSize: 12,
    color: TEXT_SECONDARY,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
    marginTop: 4,
  },
  termsLink: {
    color: BRAND_BLUE,
    fontWeight: '600',
  },

  // ── Footer ──
  footerText: {
    textAlign: 'center',
    fontSize: 12,
    color: '#B0B7C3',
    marginTop: 24,
    fontWeight: '500',
  },
});
