import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '../store/useStore';
import { useAuthStore } from '../store/useAuthStore';
import { updateUserProfileApi } from '../services/api';
import { User } from '../types';

// ── Design Tokens ─────────────────────────────────────────────
const BLUE = '#2563EB';
const BLUE_LIGHT = '#EFF6FF';
const GREEN = '#10B981';
const AMBER = '#F59E0B';
const PURPLE = '#7C3AED';
const BG = '#F8FAFC';
const CARD_BG = '#FFFFFF';
const TEXT_PRIMARY = '#0F172A';
const TEXT_SECONDARY = '#475569';
const TEXT_MUTED = '#94A3B8';
const BORDER = '#E2E8F0';

// Defaults matching system financial policy
const DEFAULT_RETURN_RATE = 0.08;
const DEFAULT_INFLATION_RATE = 0.06;
const DEFAULT_WITHDRAWAL_RATE = 0.04;
const DEFAULT_LIFESTYLE_RATIO = 0.80;
const DEFAULT_EMERGENCY_MONTHS = 6;

// ── Helpers ───────────────────────────────────────────────────
function getInitials(name: string | undefined | null): string {
  if (!name) return '?';
  return name
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('');
}

function formatDOB(value: Date | string | null | undefined): string {
  if (!value) return 'Not set';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not set';
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'Not set';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
}

function formatPercent(value: number | null | undefined, fallback: number): string {
  const rate = value != null && Number.isFinite(value) ? value : fallback;
  return `${(rate * 100).toFixed(1)}% p.a.`;
}

function formatRatio(value: number | null | undefined, fallback: number): string {
  const ratio = value != null && Number.isFinite(value) ? value : fallback;
  return `${Math.round(ratio * 100)}%`;
}

function toDate(value: Date | string | null | undefined): Date {
  if (!value) return new Date(2000, 0, 1);
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? new Date(2000, 0, 1) : d;
}

// ── Stat Pill Component ───────────────────────────────────────
function StatPill({ label, value, icon, color }: { label: string; value: string; icon: string; color: string }) {
  return (
    <View style={statStyles.pill}>
      <View style={[statStyles.iconCircle, { backgroundColor: `${color}18` }]}>
        <Ionicons name={icon as any} size={18} color={color} />
      </View>
      <View style={statStyles.textWrap}>
        <Text style={statStyles.value} numberOfLines={1}>
          {value}
        </Text>
        <Text style={statStyles.label}>{label}</Text>
      </View>
    </View>
  );
}

const statStyles = StyleSheet.create({
  pill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD_BG,
    borderRadius: 16,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: BORDER,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  iconCircle: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  textWrap: { flex: 1 },
  value: { fontSize: 15, fontWeight: '700', color: TEXT_PRIMARY },
  label: { fontSize: 11, color: TEXT_MUTED, fontWeight: '600', marginTop: 2 },
});

// ── Info Row Component ────────────────────────────────────────
function InfoRow({
  icon,
  label,
  value,
  helperText,
  isLast,
  iconColor = BLUE,
}: {
  icon: string;
  label: string;
  value: string;
  helperText?: string;
  isLast?: boolean;
  iconColor?: string;
}) {
  const isSet = value !== 'Not set';
  return (
    <View style={[infoStyles.row, !isLast && infoStyles.rowBorder]}>
      <View style={[infoStyles.iconWrap, { backgroundColor: `${iconColor}14` }]}>
        <Ionicons name={icon as any} size={18} color={iconColor} />
      </View>
      <View style={infoStyles.textCol}>
        <Text style={infoStyles.label}>{label}</Text>
        <Text style={[infoStyles.value, !isSet && infoStyles.valueMuted]}>{value}</Text>
        {helperText ? <Text style={infoStyles.helperText}>{helperText}</Text> : null}
      </View>
    </View>
  );
}

const infoStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 14, gap: 14 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  iconWrap: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  textCol: { flex: 1 },
  label: { fontSize: 12, color: TEXT_MUTED, fontWeight: '600', letterSpacing: 0.3 },
  value: { fontSize: 15, fontWeight: '700', color: TEXT_PRIMARY, marginTop: 2 },
  valueMuted: { color: TEXT_MUTED, fontStyle: 'italic', fontWeight: '500' },
  helperText: { fontSize: 11, color: TEXT_SECONDARY, marginTop: 3, lineHeight: 15 },
});

// ═══════════════════════════════════════════════════════════════
// MAIN SCREEN
// ═══════════════════════════════════════════════════════════════
export function ProfileScreen(): React.ReactElement {
  const navigation = useNavigation();
  const user = useStore((s) => s.user);
  const setUser = useStore((s) => s.setUser);
  const logout = useAuthStore((s) => s.logout);
  const insets = useSafeAreaInsets();

  // Edit modal
  const [editVisible, setEditVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  // Typed edit state
  const [editName, setEditName] = useState('');
  const [editDOB, setEditDOB] = useState<Date>(new Date(2000, 0, 1));
  const [editIncome, setEditIncome] = useState('');
  const [editRetAge, setEditRetAge] = useState('');
  const [editCorpusGoal, setEditCorpusGoal] = useState('');
  const [editReturnRate, setEditReturnRate] = useState('');
  const [editInflationRate, setEditInflationRate] = useState('');
  const [editWithdrawalRate, setEditWithdrawalRate] = useState('');
  const [editLifestyleRatio, setEditLifestyleRatio] = useState('');
  const [editEmergencyMonths, setEditEmergencyMonths] = useState('');

  // Date picker visibility
  const [showDatePicker, setShowDatePicker] = useState(false);

  const onboardingDone = user?.onboardingComplete ?? false;
  const statusColor = onboardingDone ? GREEN : AMBER;
  const statusLabel = onboardingDone ? 'Complete' : 'Pending';
  const statusIcon = onboardingDone ? 'checkmark-circle' : 'time';

  const openEditModal = () => {
    setEditName(user?.name || '');
    setEditDOB(toDate(user?.dateOfBirth));
    setEditIncome(user?.monthlyIncome != null ? String(user.monthlyIncome) : '');
    setEditRetAge(user?.retirementAge != null ? String(user.retirementAge) : '');
    setEditCorpusGoal(user?.retirementCorpusGoal != null && user.retirementCorpusGoal > 0 ? String(user.retirementCorpusGoal) : '');
    setEditReturnRate(String(Math.round((user?.expectedReturnRate ?? DEFAULT_RETURN_RATE) * 100)));
    setEditInflationRate(String(Math.round((user?.expectedInflationRate ?? DEFAULT_INFLATION_RATE) * 100)));
    setEditWithdrawalRate(String(Math.round((user?.expectedWithdrawalRate ?? DEFAULT_WITHDRAWAL_RATE) * 100)));
    setEditLifestyleRatio(String(Math.round((user?.lifestyleAdjustmentRatio ?? DEFAULT_LIFESTYLE_RATIO) * 100)));
    setEditEmergencyMonths(String(user?.emergencyFundTargetMonths ?? DEFAULT_EMERGENCY_MONTHS));
    setShowDatePicker(false);
    setEditVisible(true);
  };

  const onDateChange = (_event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (selectedDate) setEditDOB(selectedDate);
  };

  const handleSave = async () => {
    if (!user?.id) return;

    // Validate name
    if (!editName.trim()) {
      Alert.alert('Invalid Name', 'Name cannot be blank.');
      return;
    }

    // Validate retirement age
    const retAge = editRetAge.trim() ? parseInt(editRetAge, 10) : null;
    if (editRetAge.trim() && (isNaN(retAge!) || retAge! < 40 || retAge! > 100)) {
      Alert.alert('Invalid Retirement Age', 'Retirement age must be an integer between 40 and 100.');
      return;
    }

    // Validate monthly income
    const income = editIncome.trim() ? parseFloat(editIncome) : null;
    if (editIncome.trim() && (isNaN(income!) || income! < 0)) {
      Alert.alert('Invalid Income', 'Declared monthly income must be a valid non-negative number.');
      return;
    }

    // Validate retirement corpus goal
    const corpusGoal = editCorpusGoal.trim() ? parseFloat(editCorpusGoal) : null;
    if (editCorpusGoal.trim() && (isNaN(corpusGoal!) || corpusGoal! < 0)) {
      Alert.alert('Invalid Corpus Goal', 'Personal retirement corpus goal must be non-negative.');
      return;
    }

    // Validate expected return rate (% input -> decimal fraction)
    const retRatePct = editReturnRate.trim() ? parseFloat(editReturnRate) : 8;
    if (isNaN(retRatePct) || retRatePct < 0 || retRatePct > 100) {
      Alert.alert('Invalid Return Rate', 'Expected return rate must be between 0% and 100%.');
      return;
    }
    const expectedReturnRate = retRatePct / 100;

    // Validate inflation rate (% input -> decimal fraction)
    const infRatePct = editInflationRate.trim() ? parseFloat(editInflationRate) : 6;
    if (isNaN(infRatePct) || infRatePct < 0 || infRatePct > 100) {
      Alert.alert('Invalid Inflation Rate', 'Expected inflation rate must be between 0% and 100%.');
      return;
    }
    const expectedInflationRate = infRatePct / 100;

    // Validate withdrawal rate (% input -> decimal fraction)
    const swrPct = editWithdrawalRate.trim() ? parseFloat(editWithdrawalRate) : 4;
    if (isNaN(swrPct) || swrPct <= 0 || swrPct > 100) {
      Alert.alert('Invalid Withdrawal Rate', 'Safe withdrawal rate must be between 1% and 100%.');
      return;
    }
    const expectedWithdrawalRate = swrPct / 100;

    // Validate lifestyle spending ratio (% input -> decimal fraction)
    const lifestylePct = editLifestyleRatio.trim() ? parseFloat(editLifestyleRatio) : 80;
    if (isNaN(lifestylePct) || lifestylePct <= 0 || lifestylePct > 200) {
      Alert.alert('Invalid Lifestyle Spending Ratio', 'Lifestyle spending ratio must be between 1% and 200%.');
      return;
    }
    const lifestyleAdjustmentRatio = lifestylePct / 100;

    // Validate emergency fund target months
    const efMonths = editEmergencyMonths.trim() ? parseInt(editEmergencyMonths, 10) : 6;
    if (isNaN(efMonths) || efMonths < 0 || efMonths > 36) {
      Alert.alert('Invalid Emergency Fund Target', 'Emergency fund target must be between 0 and 36 months.');
      return;
    }

    setSaving(true);
    try {
      const payload: Partial<User> = {
        name: editName.trim(),
        dateOfBirth: editDOB.toISOString(),
        retirementAge: retAge ?? undefined,
        monthlyIncome: income ?? undefined,
        retirementCorpusGoal: corpusGoal ?? 0,
        expectedReturnRate,
        expectedInflationRate,
        expectedWithdrawalRate,
        lifestyleAdjustmentRatio,
        emergencyFundTargetMonths: efMonths,
      };

      const response = await updateUserProfileApi(payload);

      if (response && response.user) {
        setUser(response.user);
      } else {
        setUser({
          ...user,
          ...payload,
        });
      }

      setEditVisible(false);
      Alert.alert('Assumptions Saved ✓', 'Your personal and financial planning assumptions have been updated.');
    } catch (err: any) {
      Alert.alert('Save Error', err?.response?.data?.error || err?.message || 'Could not save profile updates.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={s.screen}>
      <ScrollView contentContainerStyle={[s.scroll, { paddingBottom: 40 + insets.bottom }]} showsVerticalScrollIndicator={false}>
        {/* ── Hero ────────────────────────────────────────────── */}
        <View style={s.hero}>
          <TouchableOpacity
            style={s.editBtn}
            activeOpacity={0.75}
            onPress={openEditModal}
            accessibilityLabel="Edit Profile and Financial Planning Assumptions"
          >
            <Ionicons name="create-outline" size={18} color={BLUE} />
            <Text style={s.editBtnText}>Edit Assumptions</Text>
          </TouchableOpacity>

          <View style={s.avatarOuter}>
            <View style={s.avatar}>
              <Text style={s.avatarText}>{getInitials(user?.name)}</Text>
            </View>
            <View style={s.onlineDot} />
          </View>

          <Text style={s.name}>{user?.name ?? 'Valued Member'}</Text>
          <Text style={s.email}>{user?.email ?? 'No email'}</Text>

          <View style={[s.statusBadge, { backgroundColor: `${statusColor}18`, borderColor: `${statusColor}40` }]}>
            <Ionicons name={statusIcon as any} size={14} color={statusColor} />
            <Text style={[s.statusText, { color: statusColor }]}>Onboarding {statusLabel}</Text>
          </View>
        </View>

        {/* ── Quick Stats ─────────────────────────────────────── */}
        <View style={s.statsRow}>
          <StatPill label="Declared Income" value={formatCurrency(user?.monthlyIncome)} icon="wallet-outline" color={GREEN} />
          <StatPill label="Retirement Age" value={user?.retirementAge ? `Age ${user.retirementAge}` : 'Not set'} icon="flag-outline" color={BLUE} />
        </View>

        {/* ── SECTION A: Personal Details ─────────────────────── */}
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>A. Personal Details</Text>
        </View>
        <View style={s.card}>
          <InfoRow icon="person-outline" label="Full Name" value={user?.name ?? 'Not set'} />
          <InfoRow icon="mail-outline" label="Email Address (Account ID)" value={user?.email ?? 'Not set'} helperText="Account email is permanent for security." />
          <InfoRow icon="calendar-outline" label="Date of Birth" value={formatDOB(user?.dateOfBirth)} isLast />
        </View>

        {/* ── SECTION B: Financial Baselines ──────────────────── */}
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>B. Financial Baselines</Text>
        </View>
        <View style={s.card}>
          <InfoRow
            icon="cash-outline"
            label="Declared Monthly Income"
            value={formatCurrency(user?.monthlyIncome)}
            helperText="Used as a planning baseline. Actual receipts are logged separately in Income Streams."
            iconColor={GREEN}
          />
          <InfoRow
            icon="trending-up-outline"
            label="Income Employment Type"
            value={user?.incomeType ? user.incomeType.charAt(0).toUpperCase() + user.incomeType.slice(1) : 'Salaried'}
            iconColor={BLUE}
          />
          <InfoRow
            icon="card-outline"
            label="Current Cash Balance"
            value={formatCurrency(user?.currentBalance)}
            helperText="Managed automatically via transaction & income logging."
            iconColor={PURPLE}
            isLast
          />
        </View>

        {/* ── SECTION C: Retirement & Forecast Assumptions ─────── */}
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>C. Retirement & Forecast Assumptions</Text>
        </View>
        <View style={s.card}>
          <InfoRow
            icon="hourglass-outline"
            label="Target Retirement Age"
            value={user?.retirementAge ? `${user.retirementAge} years` : 'Not set'}
            helperText="Defines your investment horizon for Monte Carlo projections."
            iconColor={BLUE}
          />
          <InfoRow
            icon="trophy-outline"
            label="Personal Retirement Corpus Goal"
            value={user?.retirementCorpusGoal && user.retirementCorpusGoal > 0 ? formatCurrency(user.retirementCorpusGoal) : 'Not set (Using FIRE Requirement)'}
            helperText="Your personal target. FINAURA also calculates estimated FIRE requirement separately."
            iconColor={AMBER}
          />
          <InfoRow
            icon="stats-chart-outline"
            label="Expected Investment Return Rate"
            value={formatPercent(user?.expectedReturnRate, DEFAULT_RETURN_RATE)}
            helperText="Long-term annual investment return assumption before shocks."
            iconColor={GREEN}
          />
          <InfoRow
            icon="pie-chart-outline"
            label="Expected Inflation Rate"
            value={formatPercent(user?.expectedInflationRate, DEFAULT_INFLATION_RATE)}
            helperText="Assumed annual inflation for purchasing power projections."
            iconColor={AMBER}
          />
          <InfoRow
            icon="arrow-down-circle-outline"
            label="Safe Withdrawal Rate (SWR)"
            value={formatPercent(user?.expectedWithdrawalRate, DEFAULT_WITHDRAWAL_RATE)}
            helperText="Annual withdrawal percentage from accumulated corpus during retirement."
            iconColor={BLUE}
          />
          <InfoRow
            icon="restaurant-outline"
            label="Lifestyle Spending Ratio"
            value={formatRatio(user?.lifestyleAdjustmentRatio, DEFAULT_LIFESTYLE_RATIO)}
            helperText="Estimated post-retirement living spend relative to current lifestyle."
            iconColor={PURPLE}
          />
          <InfoRow
            icon="shield-checkmark-outline"
            label="Emergency Fund Target"
            value={`${user?.emergencyFundTargetMonths ?? DEFAULT_EMERGENCY_MONTHS} months`}
            helperText="Target buffer for essential living expenses."
            iconColor={GREEN}
            isLast
          />
        </View>

        {/* ── SECTION D: Financial Data & Accounts ─────────────── */}
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>D. Financial Data & Navigation</Text>
        </View>
        <View style={s.card}>
          <TouchableOpacity
            style={infoStyles.row}
            onPress={() => (navigation as any).navigate('Assets')}
            activeOpacity={0.7}
            accessibilityLabel="Manage Financial Assets and Holdings"
          >
            <View style={[infoStyles.iconWrap, { backgroundColor: '#ECFDF5' }]}>
              <Ionicons name="pie-chart-outline" size={18} color="#059669" />
            </View>
            <View style={infoStyles.textCol}>
              <Text style={infoStyles.label}>Financial Assets & Holdings</Text>
              <Text style={infoStyles.value}>FD, Mutual Funds, Stocks & PF ↗</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={TEXT_MUTED} />
          </TouchableOpacity>

          <View style={{ height: 1, backgroundColor: '#F1F5F9', marginLeft: 50 }} />

          <TouchableOpacity
            style={infoStyles.row}
            onPress={() => (navigation as any).navigate('IncomeFlow')}
            activeOpacity={0.7}
            accessibilityLabel="Manage Income Streams and History"
          >
            <View style={[infoStyles.iconWrap, { backgroundColor: '#ECFDF5' }]}>
              <Ionicons name="wallet-outline" size={18} color="#059669" />
            </View>
            <View style={infoStyles.textCol}>
              <Text style={infoStyles.label}>Income Streams & History</Text>
              <Text style={infoStyles.value}>View, Log & Manage Receipts ↗</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={TEXT_MUTED} />
          </TouchableOpacity>

          <View style={{ height: 1, backgroundColor: '#F1F5F9', marginLeft: 50 }} />

          <TouchableOpacity
            style={infoStyles.row}
            onPress={() => (navigation as any).navigate('Liabilities')}
            activeOpacity={0.7}
            accessibilityLabel="View and Manage User Liabilities"
          >
            <View style={[infoStyles.iconWrap, { backgroundColor: '#EFF6FF' }]}>
              <Ionicons name="calendar-outline" size={18} color={BLUE} />
            </View>
            <View style={infoStyles.textCol}>
              <Text style={infoStyles.label}>Recurring Liabilities</Text>
              <Text style={infoStyles.value}>View & Manage Commitments ↗</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={TEXT_MUTED} />
          </TouchableOpacity>

          <View style={{ height: 1, backgroundColor: '#F1F5F9', marginLeft: 50 }} />

          <TouchableOpacity
            style={infoStyles.row}
            onPress={() => (navigation as any).navigate('Envelopes')}
            activeOpacity={0.7}
            accessibilityLabel="View Spending Envelopes"
          >
            <View style={[infoStyles.iconWrap, { backgroundColor: '#F5F3FF' }]}>
              <Ionicons name="layers-outline" size={18} color={PURPLE} />
            </View>
            <View style={infoStyles.textCol}>
              <Text style={infoStyles.label}>Spending Envelopes</Text>
              <Text style={infoStyles.value}>Needs, Wants & Savings ↗</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={TEXT_MUTED} />
          </TouchableOpacity>
        </View>

        {/* ── Sign Out ────────────────────────────────────────── */}
        <TouchableOpacity
          style={s.logoutBtn}
          activeOpacity={0.85}
          onPress={logout}
          accessibilityLabel="Sign Out of FINAURA Account"
        >
          <Ionicons name="log-out-outline" size={20} color="#DC2626" />
          <Text style={s.logoutText}>Sign Out</Text>
        </TouchableOpacity>
        <Text style={s.version}>FINAURA v1.0.0 — Enterprise Financial Intelligence</Text>
      </ScrollView>

      {/* ═══════ Edit Assumptions Modal ═══════ */}
      <Modal visible={editVisible} transparent animationType="slide" onRequestClose={() => setEditVisible(false)}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={modal.overlay}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={modal.kwrap}>
              <View style={modal.sheet}>
                <View style={modal.handle} />

                <View style={modal.header}>
                  <Text style={modal.title}>Edit Planning Assumptions</Text>
                  <TouchableOpacity
                    onPress={() => setEditVisible(false)}
                    style={modal.closeBtn}
                    accessibilityLabel="Close Edit Modal"
                  >
                    <Ionicons name="close" size={22} color={TEXT_SECONDARY} />
                  </TouchableOpacity>
                </View>
                <Text style={modal.subtitle}>
                  Adjust your baseline planning values. Forecasts will update automatically.
                </Text>

                <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 16 }} keyboardShouldPersistTaps="handled">
                  {/* Name */}
                  <View style={ef.wrap}>
                    <Text style={ef.label}>Full Name</Text>
                    <View style={ef.inputRow}>
                      <View style={ef.iconWrap}>
                        <Ionicons name="person-outline" size={16} color={BLUE} />
                      </View>
                      <TextInput
                        style={ef.input}
                        value={editName}
                        onChangeText={setEditName}
                        placeholder="Your full name"
                        placeholderTextColor={TEXT_MUTED}
                      />
                    </View>
                  </View>

                  {/* DOB — Date picker */}
                  <View style={ef.wrap}>
                    <Text style={ef.label}>Date of Birth</Text>
                    <TouchableOpacity style={ef.inputRow} activeOpacity={0.7} onPress={() => setShowDatePicker(true)}>
                      <View style={ef.iconWrap}>
                        <Ionicons name="calendar-outline" size={16} color={BLUE} />
                      </View>
                      <Text style={[ef.displayText, !user?.dateOfBirth && { color: TEXT_MUTED }]}>
                        {formatDOB(editDOB)}
                      </Text>
                      <Ionicons name="chevron-down" size={16} color={TEXT_MUTED} />
                    </TouchableOpacity>

                    {showDatePicker && (
                      <View style={ef.pickerWrap}>
                        <DateTimePicker
                          value={editDOB}
                          mode="date"
                          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                          maximumDate={new Date()}
                          minimumDate={new Date(1940, 0, 1)}
                          onChange={onDateChange}
                          themeVariant="light"
                        />
                        {Platform.OS === 'ios' && (
                          <TouchableOpacity style={ef.doneBtn} onPress={() => setShowDatePicker(false)}>
                            <Text style={ef.doneBtnText}>Done</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    )}
                  </View>

                  {/* Declared Monthly Income */}
                  <View style={ef.wrap}>
                    <Text style={ef.label}>Declared Monthly Income (₹)</Text>
                    <View style={ef.inputRow}>
                      <View style={ef.iconWrap}>
                        <Ionicons name="wallet-outline" size={16} color={GREEN} />
                      </View>
                      <Text style={ef.prefix}>₹</Text>
                      <TextInput
                        style={ef.input}
                        value={editIncome}
                        onChangeText={(t) => setEditIncome(t.replace(/[^0-9.]/g, ''))}
                        placeholder="e.g. 80000"
                        placeholderTextColor={TEXT_MUTED}
                        keyboardType="decimal-pad"
                      />
                    </View>
                  </View>

                  {/* Retirement Age */}
                  <View style={ef.wrap}>
                    <Text style={ef.label}>Target Retirement Age (Years)</Text>
                    <View style={ef.inputRow}>
                      <View style={ef.iconWrap}>
                        <Ionicons name="hourglass-outline" size={16} color={BLUE} />
                      </View>
                      <TextInput
                        style={ef.input}
                        value={editRetAge}
                        onChangeText={(t) => setEditRetAge(t.replace(/[^0-9]/g, ''))}
                        placeholder="e.g. 60"
                        placeholderTextColor={TEXT_MUTED}
                        keyboardType="number-pad"
                        maxLength={3}
                      />
                      <Text style={ef.suffix}>years</Text>
                    </View>
                  </View>

                  {/* Personal Retirement Corpus Goal */}
                  <View style={ef.wrap}>
                    <Text style={ef.label}>Personal Retirement Corpus Goal (₹)</Text>
                    <View style={ef.inputRow}>
                      <View style={ef.iconWrap}>
                        <Ionicons name="trophy-outline" size={16} color={AMBER} />
                      </View>
                      <Text style={ef.prefix}>₹</Text>
                      <TextInput
                        style={ef.input}
                        value={editCorpusGoal}
                        onChangeText={(t) => setEditCorpusGoal(t.replace(/[^0-9.]/g, ''))}
                        placeholder="e.g. 20000000 (Optional)"
                        placeholderTextColor={TEXT_MUTED}
                        keyboardType="decimal-pad"
                      />
                    </View>
                  </View>

                  {/* Expected Return Rate */}
                  <View style={ef.wrap}>
                    <Text style={ef.label}>Expected Investment Return Rate (% p.a.)</Text>
                    <View style={ef.inputRow}>
                      <View style={ef.iconWrap}>
                        <Ionicons name="stats-chart-outline" size={16} color={GREEN} />
                      </View>
                      <TextInput
                        style={ef.input}
                        value={editReturnRate}
                        onChangeText={(t) => setEditReturnRate(t.replace(/[^0-9.]/g, ''))}
                        placeholder="e.g. 8"
                        placeholderTextColor={TEXT_MUTED}
                        keyboardType="decimal-pad"
                      />
                      <Text style={ef.suffix}>%</Text>
                    </View>
                  </View>

                  {/* Expected Inflation Rate */}
                  <View style={ef.wrap}>
                    <Text style={ef.label}>Expected Inflation Rate (% p.a.)</Text>
                    <View style={ef.inputRow}>
                      <View style={ef.iconWrap}>
                        <Ionicons name="pie-chart-outline" size={16} color={AMBER} />
                      </View>
                      <TextInput
                        style={ef.input}
                        value={editInflationRate}
                        onChangeText={(t) => setEditInflationRate(t.replace(/[^0-9.]/g, ''))}
                        placeholder="e.g. 6"
                        placeholderTextColor={TEXT_MUTED}
                        keyboardType="decimal-pad"
                      />
                      <Text style={ef.suffix}>%</Text>
                    </View>
                  </View>

                  {/* Safe Withdrawal Rate */}
                  <View style={ef.wrap}>
                    <Text style={ef.label}>Retirement Withdrawal Assumption (% SWR)</Text>
                    <View style={ef.inputRow}>
                      <View style={ef.iconWrap}>
                        <Ionicons name="arrow-down-circle-outline" size={16} color={BLUE} />
                      </View>
                      <TextInput
                        style={ef.input}
                        value={editWithdrawalRate}
                        onChangeText={(t) => setEditWithdrawalRate(t.replace(/[^0-9.]/g, ''))}
                        placeholder="e.g. 4"
                        placeholderTextColor={TEXT_MUTED}
                        keyboardType="decimal-pad"
                      />
                      <Text style={ef.suffix}>%</Text>
                    </View>
                  </View>

                  {/* Lifestyle Adjustment Ratio */}
                  <View style={ef.wrap}>
                    <Text style={ef.label}>Lifestyle Spending Ratio (% of current lifestyle)</Text>
                    <View style={ef.inputRow}>
                      <View style={ef.iconWrap}>
                        <Ionicons name="restaurant-outline" size={16} color={PURPLE} />
                      </View>
                      <TextInput
                        style={ef.input}
                        value={editLifestyleRatio}
                        onChangeText={(t) => setEditLifestyleRatio(t.replace(/[^0-9.]/g, ''))}
                        placeholder="e.g. 80"
                        placeholderTextColor={TEXT_MUTED}
                        keyboardType="decimal-pad"
                      />
                      <Text style={ef.suffix}>%</Text>
                    </View>
                  </View>

                  {/* Emergency Fund Target Months */}
                  <View style={[ef.wrap, { marginBottom: 28 }]}>
                    <Text style={ef.label}>Emergency Fund Target (Months)</Text>
                    <View style={ef.inputRow}>
                      <View style={ef.iconWrap}>
                        <Ionicons name="shield-checkmark-outline" size={16} color={GREEN} />
                      </View>
                      <TextInput
                        style={ef.input}
                        value={editEmergencyMonths}
                        onChangeText={(t) => setEditEmergencyMonths(t.replace(/[^0-9]/g, ''))}
                        placeholder="e.g. 6"
                        placeholderTextColor={TEXT_MUTED}
                        keyboardType="number-pad"
                        maxLength={2}
                      />
                      <Text style={ef.suffix}>months</Text>
                    </View>
                  </View>
                </ScrollView>

                {/* Actions */}
                <View style={modal.actions}>
                  <TouchableOpacity
                    style={modal.cancelBtn}
                    onPress={() => setEditVisible(false)}
                    activeOpacity={0.8}
                    accessibilityLabel="Cancel Editing"
                  >
                    <Text style={modal.cancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[modal.saveBtn, saving && { opacity: 0.6 }]}
                    onPress={handleSave}
                    activeOpacity={0.85}
                    disabled={saving}
                    accessibilityLabel="Save Planning Assumptions"
                  >
                    {saving ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <>
                        <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />
                        <Text style={modal.saveText}>Save Assumptions</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </KeyboardAvoidingView>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

// ── Main Styles ───────────────────────────────────────────────
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  scroll: { paddingHorizontal: 16 },
  hero: { alignItems: 'center', paddingTop: 28, paddingBottom: 20, position: 'relative' },
  editBtn: {
    position: 'absolute',
    top: 12,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: BLUE_LIGHT,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: `${BLUE}30`,
    zIndex: 10,
  },
  editBtnText: { fontSize: 12, fontWeight: '700', color: BLUE },
  avatarOuter: { position: 'relative', marginBottom: 12 },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: BLUE,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: BLUE,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
  avatarText: { fontSize: 28, fontWeight: '800', color: '#FFFFFF', letterSpacing: 1 },
  onlineDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: GREEN,
    borderWidth: 2.5,
    borderColor: BG,
  },
  name: { fontSize: 22, fontWeight: '800', color: TEXT_PRIMARY, letterSpacing: -0.3, marginBottom: 2 },
  email: { fontSize: 13, color: TEXT_SECONDARY, fontWeight: '500', marginBottom: 12 },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  statusText: { fontSize: 11, fontWeight: '700' },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  sectionHeader: { marginBottom: 8, paddingHorizontal: 4 },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: TEXT_PRIMARY, letterSpacing: 0.2, textTransform: 'uppercase' },
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 20,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: BORDER,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 20,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    backgroundColor: '#FEF2F2',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#FECACA',
    marginTop: 4,
  },
  logoutText: { color: '#DC2626', fontSize: 15, fontWeight: '700' },
  version: { textAlign: 'center', fontSize: 11, color: TEXT_MUTED, marginTop: 16, fontWeight: '500' },
});

// ── Edit Field Styles ─────────────────────────────────────────
const ef = StyleSheet.create({
  wrap: { marginBottom: 16 },
  label: { fontSize: 12, fontWeight: '700', color: TEXT_PRIMARY, marginBottom: 6, marginLeft: 2 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: BORDER,
    paddingHorizontal: 12,
    height: 48,
  },
  iconWrap: { marginRight: 10 },
  input: { flex: 1, fontSize: 14, color: TEXT_PRIMARY, paddingVertical: 0 },
  displayText: { flex: 1, fontSize: 14, color: TEXT_PRIMARY, fontWeight: '600' },
  suffix: { fontSize: 12, color: TEXT_MUTED, fontWeight: '600', marginLeft: 4 },
  prefix: { fontSize: 14, color: TEXT_PRIMARY, fontWeight: '700', marginRight: 4 },
  pickerWrap: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    marginTop: 8,
    overflow: 'hidden',
  },
  doneBtn: { alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: BORDER },
  doneBtnText: { fontSize: 14, fontWeight: '700', color: BLUE },
});

// ── Modal Styles ──────────────────────────────────────────────
const modal = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  kwrap: { justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingBottom: 32,
    maxHeight: '90%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  title: { fontSize: 20, fontWeight: '800', color: TEXT_PRIMARY },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtitle: { fontSize: 12, color: TEXT_SECONDARY, marginTop: 4, lineHeight: 16 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 12 },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: { fontSize: 14, fontWeight: '700', color: TEXT_SECONDARY },
  saveBtn: {
    flex: 2,
    height: 48,
    borderRadius: 14,
    backgroundColor: BLUE,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: BLUE,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  saveText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
});
