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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '../store/useStore';
import { useAuthStore } from '../store/useAuthStore';
import {
  updateUserDOB,
  updateUserRetirementAge,
  updateUserMonthlyIncome,
} from '../services/api';

// ── Design Tokens ─────────────────────────────────────────────
const BLUE = '#3B3BDE';
const BLUE_LIGHT = '#EEEEFF';
const GREEN = '#22C880';
const AMBER = '#F59E0B';
const BG = '#F4F6FA';
const CARD_BG = '#FFFFFF';
const TEXT_PRIMARY = '#111827';
const TEXT_SECONDARY = '#6B7280';
const TEXT_MUTED = '#9CA3AF';
const BORDER = '#E8ECF2';

// ── Helpers ───────────────────────────────────────────────────
function getInitials(name: string | undefined | null): string {
  if (!name) return '?';
  return name.split(' ').map((w) => w.charAt(0).toUpperCase()).slice(0, 2).join('');
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

function toDate(value: Date | string | null | undefined): Date {
  if (!value) return new Date(2000, 0, 1);
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? new Date(2000, 0, 1) : d;
}

// ── Stat Pill ─────────────────────────────────────────────────
function StatPill({ label, value, icon, color }: { label: string; value: string; icon: string; color: string }) {
  return (
    <View style={statStyles.pill}>
      <View style={[statStyles.iconCircle, { backgroundColor: color + '1A' }]}>
        <Ionicons name={icon as any} size={18} color={color} />
      </View>
      <View style={statStyles.textWrap}>
        <Text style={statStyles.value} numberOfLines={1}>{value}</Text>
        <Text style={statStyles.label}>{label}</Text>
      </View>
    </View>
  );
}
const statStyles = StyleSheet.create({
  pill: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: CARD_BG, borderRadius: 16, padding: 14, gap: 12, borderWidth: 1, borderColor: BORDER, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  iconCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  textWrap: { flex: 1 },
  value: { fontSize: 15, fontWeight: '700', color: TEXT_PRIMARY },
  label: { fontSize: 11, color: TEXT_MUTED, fontWeight: '500', marginTop: 2 },
});

// ── Info Row ──────────────────────────────────────────────────
function InfoRow({ icon, label, value, isLast }: { icon: string; label: string; value: string; isLast?: boolean }) {
  const isSet = value !== 'Not set';
  return (
    <View style={[infoStyles.row, !isLast && infoStyles.rowBorder]}>
      <View style={infoStyles.iconWrap}><Ionicons name={icon as any} size={18} color={BLUE} /></View>
      <View style={infoStyles.textCol}>
        <Text style={infoStyles.label}>{label}</Text>
        <Text style={[infoStyles.value, !isSet && infoStyles.valueMuted]}>{value}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={TEXT_MUTED} />
    </View>
  );
}
const infoStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, gap: 14 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  iconWrap: { width: 38, height: 38, borderRadius: 12, backgroundColor: BLUE_LIGHT, alignItems: 'center', justifyContent: 'center' },
  textCol: { flex: 1 },
  label: { fontSize: 12, color: TEXT_MUTED, fontWeight: '500', letterSpacing: 0.3 },
  value: { fontSize: 15, fontWeight: '600', color: TEXT_PRIMARY, marginTop: 2 },
  valueMuted: { color: TEXT_MUTED, fontStyle: 'italic' },
});

// ═══════════════════════════════════════════════════════════════
// MAIN SCREEN
// ═══════════════════════════════════════════════════════════════
export function ProfileScreen(): React.ReactElement {
  const user = useStore((s) => s.user);
  const setUser = useStore((s) => s.setUser);
  const logout = useAuthStore((s) => s.logout);
  const insets = useSafeAreaInsets();

  // Edit modal
  const [editVisible, setEditVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  // Typed edit state
  const [editDOB, setEditDOB] = useState<Date>(new Date(2000, 0, 1));
  const [editRetAge, setEditRetAge] = useState('');
  const [editIncome, setEditIncome] = useState('');

  // Date picker visibility (Android shows as dialog, iOS inline)
  const [showDatePicker, setShowDatePicker] = useState(false);

  const onboardingDone = user?.onboardingComplete ?? false;
  const statusColor = onboardingDone ? GREEN : AMBER;
  const statusLabel = onboardingDone ? 'Complete' : 'Pending';
  const statusIcon = onboardingDone ? 'checkmark-circle' : 'time';

  const openEditModal = () => {
    setEditDOB(toDate(user?.dateOfBirth));
    setEditRetAge(user?.retirementAge != null ? String(user.retirementAge) : '');
    setEditIncome(user?.monthlyIncome != null ? String(user.monthlyIncome) : '');
    setShowDatePicker(false);
    setEditVisible(true);
  };

  const onDateChange = (_event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (selectedDate) setEditDOB(selectedDate);
  };

  const handleSave = async () => {
    if (!user?.id) return;

    // Validate retirement age (integer)
    const retAge = editRetAge.trim() ? parseInt(editRetAge, 10) : null;
    if (editRetAge.trim() && (isNaN(retAge!) || retAge! < 40 || retAge! > 100)) {
      Alert.alert('Invalid Age', 'Retirement age must be an integer between 40 and 100.');
      return;
    }

    // Validate monthly income (float)
    const income = editIncome.trim() ? parseFloat(editIncome) : null;
    if (editIncome.trim() && (isNaN(income!) || income! < 0)) {
      Alert.alert('Invalid Income', 'Please enter a valid positive number.');
      return;
    }

    setSaving(true);
    try {
      // Save DOB (Date type)
      await updateUserDOB(user.id, editDOB);

      // Save retirement age (integer)
      if (retAge !== null) {
        await updateUserRetirementAge(user.id, retAge);
      }

      // Save monthly income (float)
      if (income !== null) {
        await updateUserMonthlyIncome(user.id, income);
      }

      // Update local store so it reflects immediately everywhere
      setUser({
        ...user,
        dateOfBirth: editDOB.toISOString(),
        retirementAge: retAge ?? user.retirementAge,
        monthlyIncome: income ?? user.monthlyIncome,
      });

      setEditVisible(false);
      Alert.alert('Saved ✓', 'Your profile has been updated.');
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.error || err?.message || 'Could not save changes.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={s.screen}>
      <ScrollView contentContainerStyle={[s.scroll, { paddingBottom: 40 + insets.bottom }]} showsVerticalScrollIndicator={false}>

        {/* ── Hero ── */}
        <View style={s.hero}>
          <View style={s.blobTopRight} />
          <View style={s.blobBottomLeft} />

          <TouchableOpacity style={s.editBtn} activeOpacity={0.75} onPress={openEditModal}>
            <Ionicons name="create-outline" size={18} color={BLUE} />
            <Text style={s.editBtnText}>Edit</Text>
          </TouchableOpacity>

          <View style={s.avatarOuter}>
            <View style={s.avatar}><Text style={s.avatarText}>{getInitials(user?.name)}</Text></View>
            <View style={s.onlineDot} />
          </View>

          <Text style={s.name}>{user?.name ?? 'Unknown User'}</Text>
          <Text style={s.email}>{user?.email ?? 'No email'}</Text>

          <View style={[s.statusBadge, { backgroundColor: statusColor + '1A', borderColor: statusColor + '33' }]}>
            <Ionicons name={statusIcon as any} size={14} color={statusColor} />
            <Text style={[s.statusText, { color: statusColor }]}>Onboarding {statusLabel}</Text>
          </View>
        </View>

        {/* ── Quick Stats ── */}
        <View style={s.statsRow}>
          <StatPill label="Monthly Income" value={formatCurrency(user?.monthlyIncome)} icon="wallet-outline" color={GREEN} />
          <StatPill label="Retire at" value={user?.retirementAge ? `Age ${user.retirementAge}` : 'Not set'} icon="flag-outline" color={BLUE} />
        </View>

        {/* ── Details Card ── */}
        <View style={s.sectionHeader}><Text style={s.sectionTitle}>Account Details</Text></View>
        <View style={s.card}>
          <InfoRow icon="person-outline" label="Full Name" value={user?.name ?? 'Not set'} />
          <InfoRow icon="mail-outline" label="Email Address" value={user?.email ?? 'Not set'} />
          <InfoRow icon="calendar-outline" label="Date of Birth" value={formatDOB(user?.dateOfBirth)} />
          <InfoRow icon="trending-up-outline" label="Income Type" value={user?.incomeType ? user.incomeType.charAt(0).toUpperCase() + user.incomeType.slice(1) : 'Not set'} />
          <InfoRow icon="cash-outline" label="Monthly Income" value={formatCurrency(user?.monthlyIncome)} />
          <InfoRow icon="hourglass-outline" label="Retirement Age" value={user?.retirementAge ? `${user.retirementAge} years` : 'Not set'} isLast />
        </View>

        {/* ── Preferences ── */}
        <View style={s.sectionHeader}><Text style={s.sectionTitle}>Preferences</Text></View>
        <View style={s.card}>
          <TouchableOpacity style={s.prefRow} activeOpacity={0.7}>
            <View style={[infoStyles.iconWrap, { backgroundColor: '#F3E8FF' }]}><Ionicons name="color-palette-outline" size={18} color="#7C3AED" /></View>
            <Text style={s.prefLabel}>Appearance</Text><Text style={s.prefValue}>System</Text>
            <Ionicons name="chevron-forward" size={16} color={TEXT_MUTED} />
          </TouchableOpacity>
          <View style={{ height: 1, backgroundColor: '#F3F4F6', marginLeft: 52 }} />
          <TouchableOpacity style={s.prefRow} activeOpacity={0.7}>
            <View style={[infoStyles.iconWrap, { backgroundColor: '#FEF3C7' }]}><Ionicons name="notifications-outline" size={18} color={AMBER} /></View>
            <Text style={s.prefLabel}>Notifications</Text><Text style={s.prefValue}>On</Text>
            <Ionicons name="chevron-forward" size={16} color={TEXT_MUTED} />
          </TouchableOpacity>
          <View style={{ height: 1, backgroundColor: '#F3F4F6', marginLeft: 52 }} />
          <TouchableOpacity style={s.prefRow} activeOpacity={0.7}>
            <View style={[infoStyles.iconWrap, { backgroundColor: '#ECFDF5' }]}><Ionicons name="shield-checkmark-outline" size={18} color={GREEN} /></View>
            <Text style={s.prefLabel}>Privacy</Text><Text style={s.prefValue}>Standard</Text>
            <Ionicons name="chevron-forward" size={16} color={TEXT_MUTED} />
          </TouchableOpacity>
        </View>

        {/* ── Sign Out ── */}
        <TouchableOpacity style={s.logoutBtn} activeOpacity={0.85} onPress={logout}>
          <Ionicons name="log-out-outline" size={20} color="#DC2626" />
          <Text style={s.logoutText}>Sign Out</Text>
        </TouchableOpacity>
        <Text style={s.version}>Finaura v1.0.0</Text>
      </ScrollView>

      {/* ═══════ Edit Profile Modal ═══════ */}
      <Modal visible={editVisible} transparent animationType="slide" onRequestClose={() => setEditVisible(false)}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={modal.overlay}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={modal.kwrap}>
              <View style={modal.sheet}>
                <View style={modal.handle} />

                <View style={modal.header}>
                  <Text style={modal.title}>Edit Profile</Text>
                  <TouchableOpacity onPress={() => setEditVisible(false)} style={modal.closeBtn}>
                    <Ionicons name="close" size={22} color={TEXT_SECONDARY} />
                  </TouchableOpacity>
                </View>
                <Text style={modal.subtitle}>Update your personal details below</Text>

                <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 20 }} keyboardShouldPersistTaps="handled">

                  {/* ── DOB — Date picker ── */}
                  <View style={ef.wrap}>
                    <Text style={ef.label}>Date of Birth</Text>
                    <TouchableOpacity style={ef.inputRow} activeOpacity={0.7} onPress={() => setShowDatePicker(true)}>
                      <View style={ef.iconWrap}><Ionicons name="calendar-outline" size={16} color={BLUE} /></View>
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

                  {/* ── Retirement Age — Integer ── */}
                  <View style={ef.wrap}>
                    <Text style={ef.label}>Retirement Age</Text>
                    <View style={ef.inputRow}>
                      <View style={ef.iconWrap}><Ionicons name="hourglass-outline" size={16} color={BLUE} /></View>
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

                  {/* ── Monthly Income — Float ── */}
                  <View style={ef.wrap}>
                    <Text style={ef.label}>Monthly Income</Text>
                    <View style={ef.inputRow}>
                      <View style={ef.iconWrap}><Ionicons name="cash-outline" size={16} color={BLUE} /></View>
                      <Text style={ef.prefix}>₹</Text>
                      <TextInput
                        style={ef.input}
                        value={editIncome}
                        onChangeText={(t) => setEditIncome(t.replace(/[^0-9.]/g, ''))}
                        placeholder="e.g. 50000.00"
                        placeholderTextColor={TEXT_MUTED}
                        keyboardType="decimal-pad"
                      />
                    </View>
                  </View>
                </ScrollView>

                {/* Actions */}
                <View style={modal.actions}>
                  <TouchableOpacity style={modal.cancelBtn} onPress={() => setEditVisible(false)} activeOpacity={0.8}>
                    <Text style={modal.cancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[modal.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} activeOpacity={0.85} disabled={saving}>
                    {saving ? <ActivityIndicator color="#fff" size="small" /> : (
                      <><Ionicons name="checkmark-circle-outline" size={18} color="#fff" /><Text style={modal.saveText}>Save Changes</Text></>
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
  hero: { alignItems: 'center', paddingTop: 28, paddingBottom: 24, position: 'relative', overflow: 'hidden' },
  blobTopRight: { position: 'absolute', top: -30, right: -20, width: 120, height: 120, borderRadius: 60, backgroundColor: BLUE, opacity: 0.06 },
  blobBottomLeft: { position: 'absolute', bottom: -10, left: -20, width: 80, height: 80, borderRadius: 40, backgroundColor: BLUE, opacity: 0.04 },
  editBtn: { position: 'absolute', top: 12, right: 4, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: BLUE_LIGHT, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: BLUE + '30', zIndex: 10 },
  editBtnText: { fontSize: 13, fontWeight: '700', color: BLUE },
  avatarOuter: { position: 'relative', marginBottom: 16 },
  avatar: { width: 88, height: 88, borderRadius: 44, backgroundColor: BLUE, alignItems: 'center', justifyContent: 'center', shadowColor: BLUE, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 14, elevation: 8 },
  avatarText: { fontSize: 32, fontWeight: '800', color: '#FFFFFF', letterSpacing: 1 },
  onlineDot: { position: 'absolute', bottom: 4, right: 4, width: 18, height: 18, borderRadius: 9, backgroundColor: GREEN, borderWidth: 3, borderColor: BG },
  name: { fontSize: 24, fontWeight: '800', color: TEXT_PRIMARY, letterSpacing: -0.3, marginBottom: 4 },
  email: { fontSize: 14, color: TEXT_SECONDARY, fontWeight: '500', marginBottom: 14 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  statusText: { fontSize: 12, fontWeight: '700' },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, paddingHorizontal: 4 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: TEXT_PRIMARY, letterSpacing: -0.2 },
  card: { backgroundColor: CARD_BG, borderRadius: 20, paddingHorizontal: 16, borderWidth: 1, borderColor: BORDER, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 3, marginBottom: 20 },
  prefRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 14 },
  prefLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: TEXT_PRIMARY },
  prefValue: { fontSize: 13, color: TEXT_MUTED, fontWeight: '500', marginRight: 4 },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 52, backgroundColor: '#FEF2F2', borderRadius: 16, borderWidth: 1.5, borderColor: '#FECACA', marginTop: 4 },
  logoutText: { color: '#DC2626', fontSize: 15, fontWeight: '700' },
  version: { textAlign: 'center', fontSize: 12, color: TEXT_MUTED, marginTop: 20, fontWeight: '500' },
});

// ── Edit Field Styles ─────────────────────────────────────────
const ef = StyleSheet.create({
  wrap: { marginBottom: 18 },
  label: { fontSize: 13, fontWeight: '600', color: TEXT_PRIMARY, marginBottom: 8, marginLeft: 2 },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F7F8FC', borderRadius: 14, borderWidth: 1.5, borderColor: BORDER, paddingHorizontal: 14, height: 52 },
  iconWrap: { marginRight: 10 },
  input: { flex: 1, fontSize: 15, color: TEXT_PRIMARY, paddingVertical: 0 },
  displayText: { flex: 1, fontSize: 15, color: TEXT_PRIMARY, fontWeight: '500' },
  suffix: { fontSize: 13, color: TEXT_MUTED, fontWeight: '500', marginLeft: 4 },
  prefix: { fontSize: 16, color: TEXT_PRIMARY, fontWeight: '600', marginRight: 4 },
  pickerWrap: { backgroundColor: '#F7F8FC', borderRadius: 14, borderWidth: 1, borderColor: BORDER, marginTop: 8, overflow: 'hidden' },
  doneBtn: { alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: BORDER },
  doneBtnText: { fontSize: 15, fontWeight: '700', color: BLUE },
});

// ── Modal Styles ──────────────────────────────────────────────
const modal = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  kwrap: { justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 24, paddingBottom: 32, maxHeight: '85%' },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#D1D5DB', alignSelf: 'center', marginTop: 12, marginBottom: 8 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  title: { fontSize: 22, fontWeight: '800', color: TEXT_PRIMARY },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  subtitle: { fontSize: 13, color: TEXT_SECONDARY, marginTop: 4 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  cancelBtn: { flex: 1, height: 50, borderRadius: 14, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  cancelText: { fontSize: 15, fontWeight: '600', color: TEXT_SECONDARY },
  saveBtn: { flex: 2, height: 50, borderRadius: 14, backgroundColor: BLUE, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, shadowColor: BLUE, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
  saveText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
