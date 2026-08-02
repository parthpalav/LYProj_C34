import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../store/useAuthStore';
import { formatCurrency } from '../utils/formatCurrency';

const INCOME_TYPES = [
  { id: 'salaried', label: 'Salaried' },
  { id: 'freelancer', label: 'Freelance' },
  { id: 'business', label: 'Business' },
  { id: 'gig', label: 'Gig Economy' },
  { id: 'student', label: 'Student' },
];

export function ProfileScreen(): React.ReactElement {
  const insets = useSafeAreaInsets();
  const { user, logout, updateUserProfile, loading, authError, clearErrors } = useAuthStore();

  const [isEditing, setIsEditing] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [income, setIncome] = useState('');
  const [retirementAge, setRetirementAge] = useState('');
  const [retirementCorpusGoal, setRetirementCorpusGoal] = useState('');
  const [currentBalance, setCurrentBalance] = useState('');
  const [incomeType, setIncomeType] = useState('salaried');
  const [rent, setRent] = useState('');
  const [emi, setEmi] = useState('');
  const [bills, setBills] = useState('');
  const [family, setFamily] = useState('');

  const [focusedField, setFocusedField] = useState<string | null>(null);

  // Pre-populate existing user profile data when opening edit mode
  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setAge(user.age ? String(user.age) : '');
      setIncome(user.income ? String(user.income) : '');
      setRetirementAge(user.retirementAge ? String(user.retirementAge) : '');
      setRetirementCorpusGoal(user.retirementCorpusGoal ? String(user.retirementCorpusGoal) : '');
      setCurrentBalance(user.currentBalance ? String(user.currentBalance) : '');
      setIncomeType(user.incomeType || 'salaried');

      const obligations = user.fixedObligations || [];
      const rentItem = obligations.find(o => o.label.toLowerCase() === 'rent');
      const emiItem = obligations.find(o => o.label.toLowerCase() === 'emi');
      const billsItem = obligations.find(o => o.label.toLowerCase() === 'bills');
      const familyItem = obligations.find(o => o.label.toLowerCase() === 'family');

      setRent(rentItem ? String(rentItem.amount) : '');
      setEmi(emiItem ? String(emiItem.amount) : '');
      setBills(billsItem ? String(billsItem.amount) : '');
      setFamily(familyItem ? String(familyItem.amount) : '');
    }
  }, [user, isEditing]);

  const handleSaveProfile = async () => {
    clearErrors();
    const fixedObligations = [
      { label: 'Rent', amount: Number(rent || 0) },
      { label: 'EMI', amount: Number(emi || 0) },
      { label: 'Bills', amount: Number(bills || 0) },
      { label: 'Family', amount: Number(family || 0) },
    ].filter(o => o.amount > 0);

    const success = await updateUserProfile({
      name: name.trim(),
      age: Number(age),
      income: Number(income),
      incomeType,
      retirementAge: Number(retirementAge),
      retirementCorpusGoal: Number(retirementCorpusGoal),
      currentBalance: Number(currentBalance),
      fixedObligations
    });

    if (success) {
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        setIsEditing(false);
      }, 1500);
    }
  };

  const getObligationAmount = (label: string) => {
    const item = (user?.fixedObligations || []).find(o => o.label.toLowerCase() === label.toLowerCase());
    return item ? item.amount : 0;
  };

  return (
    <View style={[styles.rootContainer, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Profile Card Header */}
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <View style={styles.avatarContainer}>
              <Text style={styles.avatarText}>{user?.name ? user.name.charAt(0).toUpperCase() : 'U'}</Text>
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.userName}>{user?.name || 'User Profile'}</Text>
              <Text style={styles.userEmail}>{user?.email}</Text>
              <View style={styles.badgeRow}>
                <View style={[styles.statusBadge, user?.isEmailVerified ? styles.verifiedBadge : styles.unverifiedBadge]}>
                  <Text style={[styles.statusBadgeText, user?.isEmailVerified ? styles.verifiedBadgeText : styles.unverifiedBadgeText]}>
                    {user?.isEmailVerified ? 'Verified Account' : 'Email Unverified'}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={styles.editProfileBtn}
            onPress={() => setIsEditing(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.editProfileBtnText}>✏️ Edit Financial Profile</Text>
          </TouchableOpacity>
        </View>

        {/* Financial Summary Cards */}
        <View style={styles.card}>
          <Text style={styles.sectionHeader}>Financial Overview</Text>

          <View style={styles.gridRow}>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>Monthly Income</Text>
              <Text style={styles.gridValue}>{formatCurrency(user?.income || 0)}</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>Current Balance</Text>
              <Text style={styles.gridValue}>{formatCurrency(user?.currentBalance || 0)}</Text>
            </View>
          </View>

          <View style={styles.gridRow}>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>Employment Type</Text>
              <Text style={styles.gridValueCapital}>{user?.incomeType || 'Salaried'}</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>Age / Retirement</Text>
              <Text style={styles.gridValue}>{user?.age || '--'} yrs / {user?.retirementAge || '--'} yrs</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Retirement Corpus Goal</Text>
            <Text style={styles.detailValue}>{formatCurrency(user?.retirementCorpusGoal || 0)}</Text>
          </View>
        </View>

        {/* Fixed Monthly Obligations Breakdown */}
        <View style={styles.card}>
          <Text style={styles.sectionHeader}>Fixed Monthly Obligations</Text>
          <Text style={styles.sectionSubtitle}>Recurring monthly commitment overview</Text>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Rent / Housing</Text>
            <Text style={styles.detailValue}>{formatCurrency(getObligationAmount('Rent'))}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Loans / EMIs</Text>
            <Text style={styles.detailValue}>{formatCurrency(getObligationAmount('EMI'))}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Bills & Utilities</Text>
            <Text style={styles.detailValue}>{formatCurrency(getObligationAmount('Bills'))}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Family Support</Text>
            <Text style={styles.detailValue}>{formatCurrency(getObligationAmount('Family'))}</Text>
          </View>
        </View>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutBtn} onPress={logout} activeOpacity={0.8}>
          <Text style={styles.logoutBtnText}>Sign Out of Account</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal visible={isEditing} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setIsEditing(false)}>
        <KeyboardAvoidingView
          style={{ flex: 1, backgroundColor: '#F3F4F6' }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[styles.modalHeader, { paddingTop: Platform.OS === 'ios' ? 16 : insets.top + 16 }]}>
            <Text style={styles.modalTitle}>Edit Financial Profile</Text>
            <TouchableOpacity onPress={() => setIsEditing(false)} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>Close</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.modalScrollContent} keyboardShouldPersistTaps="handled">
            {saveSuccess ? (
              <View style={styles.successBanner}>
                <Text style={styles.successBannerText}>Profile updated successfully!</Text>
              </View>
            ) : null}

            {authError ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorBannerText}>{authError}</Text>
              </View>
            ) : null}

            {/* Personal Details */}
            <View style={styles.card}>
              <Text style={styles.sectionHeader}>Personal Information</Text>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Full Name</Text>
                <TextInput
                  style={[styles.input, focusedField === 'name' && styles.inputFocused]}
                  value={name}
                  onChangeText={setName}
                  onFocus={() => setFocusedField('name')}
                  onBlur={() => setFocusedField(null)}
                />
              </View>

              <View style={styles.row}>
                <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.label}>Current Age</Text>
                  <TextInput
                    style={[styles.input, focusedField === 'age' && styles.inputFocused]}
                    keyboardType="number-pad"
                    value={age}
                    onChangeText={setAge}
                    onFocus={() => setFocusedField('age')}
                    onBlur={() => setFocusedField(null)}
                  />
                </View>

                <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                  <Text style={styles.label}>Retirement Age</Text>
                  <TextInput
                    style={[styles.input, focusedField === 'retirementAge' && styles.inputFocused]}
                    keyboardType="number-pad"
                    value={retirementAge}
                    onChangeText={setRetirementAge}
                    onFocus={() => setFocusedField('retirementAge')}
                    onBlur={() => setFocusedField(null)}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Employment / Income Type</Text>
                <View style={styles.pillContainer}>
                  {INCOME_TYPES.map((type) => {
                    const isSelected = incomeType.toLowerCase() === type.id;
                    return (
                      <TouchableOpacity
                        key={type.id}
                        style={[styles.pill, isSelected && styles.pillSelected]}
                        onPress={() => setIncomeType(type.id)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.pillText, isSelected && styles.pillTextSelected]}>
                          {type.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </View>

            {/* Financial Details */}
            <View style={styles.card}>
              <Text style={styles.sectionHeader}>Income & Balance</Text>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Monthly Income (₹)</Text>
                <TextInput
                  style={[styles.input, focusedField === 'income' && styles.inputFocused]}
                  keyboardType="number-pad"
                  value={income}
                  onChangeText={setIncome}
                  onFocus={() => setFocusedField('income')}
                  onBlur={() => setFocusedField(null)}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Current Liquid Balance (₹)</Text>
                <TextInput
                  style={[styles.input, focusedField === 'currentBalance' && styles.inputFocused]}
                  keyboardType="number-pad"
                  value={currentBalance}
                  onChangeText={setCurrentBalance}
                  onFocus={() => setFocusedField('currentBalance')}
                  onBlur={() => setFocusedField(null)}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Retirement Corpus Goal (₹)</Text>
                <TextInput
                  style={[styles.input, focusedField === 'retirementCorpusGoal' && styles.inputFocused]}
                  keyboardType="number-pad"
                  value={retirementCorpusGoal}
                  onChangeText={setRetirementCorpusGoal}
                  onFocus={() => setFocusedField('retirementCorpusGoal')}
                  onBlur={() => setFocusedField(null)}
                />
              </View>
            </View>

            {/* Fixed Obligations */}
            <View style={styles.card}>
              <Text style={styles.sectionHeader}>Fixed Monthly Obligations (₹)</Text>

              <View style={styles.row}>
                <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.label}>Rent / Housing</Text>
                  <TextInput
                    style={[styles.input, focusedField === 'rent' && styles.inputFocused]}
                    keyboardType="number-pad"
                    value={rent}
                    onChangeText={setRent}
                    onFocus={() => setFocusedField('rent')}
                    onBlur={() => setFocusedField(null)}
                  />
                </View>

                <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                  <Text style={styles.label}>Loans / EMIs</Text>
                  <TextInput
                    style={[styles.input, focusedField === 'emi' && styles.inputFocused]}
                    keyboardType="number-pad"
                    value={emi}
                    onChangeText={setEmi}
                    onFocus={() => setFocusedField('emi')}
                    onBlur={() => setFocusedField(null)}
                  />
                </View>
              </View>

              <View style={styles.row}>
                <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.label}>Bills & Utilities</Text>
                  <TextInput
                    style={[styles.input, focusedField === 'bills' && styles.inputFocused]}
                    keyboardType="number-pad"
                    value={bills}
                    onChangeText={setBills}
                    onFocus={() => setFocusedField('bills')}
                    onBlur={() => setFocusedField(null)}
                  />
                </View>

                <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                  <Text style={styles.label}>Family Support</Text>
                  <TextInput
                    style={[styles.input, focusedField === 'family' && styles.inputFocused]}
                    keyboardType="number-pad"
                    value={family}
                    onChangeText={setFamily}
                    onFocus={() => setFocusedField('family')}
                    onBlur={() => setFocusedField(null)}
                  />
                </View>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.saveBtn, loading && styles.btnDisabled]}
              onPress={handleSaveProfile}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.saveBtnText}>Save Profile Changes</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  rootContainer: { flex: 1, backgroundColor: '#F3F4F6' },
  scrollContent: { paddingHorizontal: 20, paddingVertical: 16 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  avatarContainer: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#2563EB', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  avatarText: { color: '#FFFFFF', fontSize: 24, fontWeight: '800' },
  userInfo: { flex: 1 },
  userName: { fontSize: 20, fontWeight: '800', color: '#1E293B' },
  userEmail: { fontSize: 13, color: '#64748B', marginTop: 2 },
  badgeRow: { marginTop: 6, flexDirection: 'row' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
  verifiedBadge: { backgroundColor: '#D1FAE5' },
  unverifiedBadge: { backgroundColor: '#FEF3C7' },
  statusBadgeText: { fontSize: 11, fontWeight: '700' },
  verifiedBadgeText: { color: '#065F46' },
  unverifiedBadgeText: { color: '#92400E' },
  editProfileBtn: { marginTop: 16, backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE', paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  editProfileBtnText: { color: '#2563EB', fontSize: 14, fontWeight: '700' },
  sectionHeader: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 4 },
  sectionSubtitle: { fontSize: 12, color: '#6B7280', marginBottom: 12 },
  gridRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  gridItem: { flex: 1 },
  gridLabel: { fontSize: 12, color: '#64748B', fontWeight: '500' },
  gridValue: { fontSize: 16, fontWeight: '700', color: '#1E293B', marginTop: 2 },
  gridValueCapital: { fontSize: 16, fontWeight: '700', color: '#1E293B', marginTop: 2, textTransform: 'capitalize' },
  divider: { height: 1, backgroundColor: '#E5E7EB', marginVertical: 12 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  detailLabel: { fontSize: 14, color: '#4B5563', fontWeight: '500' },
  detailValue: { fontSize: 14, color: '#111827', fontWeight: '700' },
  logoutBtn: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FCA5A5', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginBottom: 24 },
  logoutBtnText: { color: '#DC2626', fontSize: 15, fontWeight: '700' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 16, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#1E293B' },
  closeBtn: { padding: 4 },
  closeBtnText: { color: '#2563EB', fontSize: 15, fontWeight: '700' },
  modalScrollContent: { paddingHorizontal: 20, paddingVertical: 16 },
  successBanner: { backgroundColor: '#D1FAE5', borderColor: '#6EE7B7', borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 16 },
  successBannerText: { color: '#065F46', fontSize: 13, textAlign: 'center', fontWeight: '700' },
  errorBanner: { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5', borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 16 },
  errorBannerText: { color: '#991B1B', fontSize: 13, textAlign: 'center', fontWeight: '500' },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  inputGroup: { marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input: { height: 48, backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 10, paddingHorizontal: 14, fontSize: 15, color: '#111827' },
  inputFocused: { borderColor: '#2563EB', backgroundColor: '#FFFFFF' },
  pillContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  pill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB' },
  pillSelected: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  pillText: { fontSize: 13, fontWeight: '600', color: '#4B5563' },
  pillTextSelected: { color: '#FFFFFF' },
  saveBtn: { height: 52, backgroundColor: '#2563EB', borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginTop: 8, marginBottom: 24 },
  btnDisabled: { backgroundColor: '#93C5FD' },
  saveBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' }
});
