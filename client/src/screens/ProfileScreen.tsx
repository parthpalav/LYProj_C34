import React, { useState } from 'react';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import Animated from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '../store/useStore';
import { useAuthStore } from '../store/useAuthStore';
import { useThemeStore } from '../store/useThemeStore';
import { toast } from '../store/useCelebrationStore';
import { updateUserProfileApi } from '../services/api';
import { User } from '../types';
import { createStyles, radius, typeScale, useTheme } from '../theme';
import { enterUp } from '../motion';
import { formatCurrency } from '../utils/format';
import { Card } from '../components/ui/Card';
import { Chip, ListRow, SectionHeader } from '../components/ui/Bits';
import { Button } from '../components/ui/Button';
import { Field } from '../components/ui/Field';
import { DateField, formatDay } from '../components/ui/DateField';
import { LargeTitle, ScreenHeader, useHeaderHeight, useScrollHeader } from '../components/ui/ScreenHeader';

// Defaults matching system financial policy
const DEFAULT_RETURN_RATE = 0.08;
const DEFAULT_INFLATION_RATE = 0.06;
const DEFAULT_WITHDRAWAL_RATE = 0.04;
const DEFAULT_LIFESTYLE_RATIO = 0.80;
const DEFAULT_EMERGENCY_MONTHS = 6;

function getInitials(name: string | undefined | null): string {
  if (!name) return '?';
  return name.split(' ').map((w) => w.charAt(0).toUpperCase()).slice(0, 2).join('');
}

function toDate(value: Date | string | null | undefined): Date {
  if (!value) return new Date(2000, 0, 1);
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? new Date(2000, 0, 1) : d;
}

const pct = (value: number | null | undefined, fallback: number) => `${Math.round((value ?? fallback) * 100)}%`;

/** Validates the assumptions form; returns the payload or the first problem in plain words. */
function readAssumptions(f: Record<string, string>): { error: string } | { payload: Partial<User> } {
  if (!f.name.trim()) return { error: 'Name cannot be blank.' };
  const retAge = f.retAge.trim() ? parseInt(f.retAge, 10) : null;
  if (f.retAge.trim() && (isNaN(retAge!) || retAge! < 40 || retAge! > 100)) return { error: 'Retirement age must be a whole number between 40 and 100.' };
  const income = f.income.trim() ? parseFloat(f.income) : null;
  if (f.income.trim() && (isNaN(income!) || income! < 0)) return { error: 'Declared monthly income must be zero or more.' };
  const corpus = f.corpus.trim() ? parseFloat(f.corpus) : null;
  if (f.corpus.trim() && (isNaN(corpus!) || corpus! < 0)) return { error: 'Retirement corpus goal must be zero or more.' };
  const ret = f.ret.trim() ? parseFloat(f.ret) : 8;
  if (isNaN(ret) || ret < 0 || ret > 100) return { error: 'Expected return must be between 0% and 100%.' };
  const inf = f.inf.trim() ? parseFloat(f.inf) : 6;
  if (isNaN(inf) || inf < 0 || inf > 100) return { error: 'Inflation must be between 0% and 100%.' };
  const swr = f.swr.trim() ? parseFloat(f.swr) : 4;
  if (isNaN(swr) || swr <= 0 || swr > 100) return { error: 'Safe withdrawal rate must be between 1% and 100%.' };
  const life = f.life.trim() ? parseFloat(f.life) : 80;
  if (isNaN(life) || life <= 0 || life > 200) return { error: 'Retirement lifestyle must be between 1% and 200% of today.' };
  const ef = f.ef.trim() ? parseInt(f.ef, 10) : 6;
  if (isNaN(ef) || ef < 0 || ef > 36) return { error: 'Emergency fund target must be between 0 and 36 months.' };
  return {
    payload: {
      name: f.name.trim(),
      retirementAge: retAge ?? undefined,
      monthlyIncome: income ?? undefined,
      retirementCorpusGoal: corpus ?? 0,
      expectedReturnRate: ret / 100,
      expectedInflationRate: inf / 100,
      expectedWithdrawalRate: swr / 100,
      lifestyleAdjustmentRatio: life / 100,
      emergencyFundTargetMonths: ef,
    },
  };
}

export function ProfileScreen(): React.ReactElement {
  const { c } = useTheme();
  const s = useSStyles();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { y, onScroll } = useScrollHeader();
  const storeUser = useStore((st) => st.user);
  const authUser = useAuthStore((st) => st.user);
  const user = storeUser || authUser;
  const setStoreUser = useStore((st) => st.setUser);
  const setAuthUser = useAuthStore((st) => st.setUser);
  const logout = useAuthStore((st) => st.logout);
  const themeMode = useThemeStore((st) => st.mode);
  const setThemeMode = useThemeStore((st) => st.setMode);

  const [editVisible, setEditVisible] = useState(false);
  const [editError, setEditError] = useState('');
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarRenderKey, setAvatarRenderKey] = useState(0);
  const [form, setForm] = useState<Record<string, string>>({});
  const [editDOB, setEditDOB] = useState<Date>(new Date(2000, 0, 1));
  const set = (key: string) => (v: string) => { setForm((f) => ({ ...f, [key]: v })); setEditError(''); };

  const shownAvatar = user?.avatarLocalUri || user?.avatar || null;

  const openEditModal = () => {
    setForm({
      name: user?.name || '',
      income: user?.monthlyIncome != null ? String(user.monthlyIncome) : '',
      retAge: user?.retirementAge != null ? String(user.retirementAge) : '',
      corpus: user?.retirementCorpusGoal != null && user.retirementCorpusGoal > 0 ? String(user.retirementCorpusGoal) : '',
      ret: String(Math.round((user?.expectedReturnRate ?? DEFAULT_RETURN_RATE) * 100)),
      inf: String(Math.round((user?.expectedInflationRate ?? DEFAULT_INFLATION_RATE) * 100)),
      swr: String(Math.round((user?.expectedWithdrawalRate ?? DEFAULT_WITHDRAWAL_RATE) * 100)),
      life: String(Math.round((user?.lifestyleAdjustmentRatio ?? DEFAULT_LIFESTYLE_RATIO) * 100)),
      ef: String(user?.emergencyFundTargetMonths ?? DEFAULT_EMERGENCY_MONTHS),
    });
    setEditDOB(toDate(user?.dateOfBirth));
    setEditError('');
    setEditVisible(true);
  };

  const persistAvatar = async (avatar: string | null, localUri: string | null) => {
    const base = (user ?? {}) as User;
    const previous = base.avatar ?? null;
    const previousLocal = base.avatarLocalUri ?? null;
    const apply = (next: User) => {
      setStoreUser(next);
      setAuthUser(next);
      setAvatarRenderKey((k) => k + 1); // force <Image> to remount so it repaints
    };

    // Optimistic: show the picked local file immediately (RN renders file:// reliably,
    // unlike swapping one big data: URI for another on a mounted <Image>)
    apply({ ...base, avatar, avatarLocalUri: localUri } as User);

    try {
      const response = await updateUserProfileApi({ avatar });
      const serverUser = response?.user;
      // Keep our avatar even if an older server build doesn't echo the field back
      apply((serverUser
        ? { ...serverUser, avatar: serverUser.avatar ?? avatar, avatarLocalUri: localUri }
        : { ...base, avatar, avatarLocalUri: localUri }) as User);
      toast(avatar ? 'Photo updated' : 'Photo removed');
    } catch (err: any) {
      // Roll back on failure
      apply({ ...base, avatar: previous, avatarLocalUri: previousLocal } as User);
      const status = err?.response?.status;
      toast('Photo not saved', {
        tone: 'error',
        subtitle: status === 413 ? 'That photo is too large. Try a smaller one or crop it tighter.' : 'Check your connection and try again.',
      });
    }
  };

  const handlePickAvatar = async () => {
    if (avatarBusy) return;

    const hasPhoto = !!(user?.avatarLocalUri || user?.avatar);
    const choose = () =>
      new Promise<'library' | 'remove' | 'cancel'>((resolve) => {
        const options: Array<{ text: string; style?: 'cancel' | 'destructive'; onPress?: () => void }> = [
          { text: 'Choose from Library', onPress: () => resolve('library') },
        ];
        if (hasPhoto) options.push({ text: 'Remove Photo', style: 'destructive', onPress: () => resolve('remove') });
        options.push({ text: 'Cancel', style: 'cancel', onPress: () => resolve('cancel') });
        Alert.alert('Profile Picture', undefined, options, { cancelable: true, onDismiss: () => resolve('cancel') });
      });

    const action = await choose();
    if (action === 'cancel') return;

    setAvatarBusy(true);
    try {
      if (action === 'remove') {
        await persistAvatar(null, null);
        return;
      }

      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        toast('Photo access is off', { tone: 'warning', subtitle: 'Allow photo library access in Settings to set a profile picture.' });
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.35,
        base64: true,
      });
      if (result.canceled) return;

      const asset = result.assets?.[0];
      if (!asset?.base64) {
        toast("Couldn't read that photo", { tone: 'error', subtitle: 'Please try another one.' });
        return;
      }

      const mime = asset.mimeType || 'image/jpeg';
      const dataUri = `data:${mime};base64,${asset.base64}`;
      if (dataUri.length > 3_800_000) {
        toast('That photo is too large', { tone: 'warning', subtitle: 'Pick a smaller one or crop it tighter.' });
        return;
      }

      await persistAvatar(dataUri, asset.uri ?? null);
    } finally {
      setAvatarBusy(false);
    }
  };

  const handleSave = async () => {
    if (!user?.id) return;
    const read = readAssumptions(form);
    if ('error' in read) {
      setEditError(read.error);
      return;
    }
    const payload = { ...read.payload, dateOfBirth: editDOB.toISOString() };
    try {
      const response = await updateUserProfileApi(payload);
      const updated = (response?.user ?? { ...(user || {}), ...payload }) as User;
      setStoreUser(updated);
      setAuthUser(updated);
      setEditVisible(false);
      toast('Assumptions saved', { subtitle: 'Your forecasts will use the new values.' });
    } catch (err: any) {
      setEditError(err?.response?.data?.error || "Couldn't save. Check your connection and try again.");
    }
  };

  const confirmSignOut = () => {
    Alert.alert('Sign out of FINAURA?', 'You can sign back in any time with your email and password.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => logout() },
    ]);
  };

  const assumptionsSummary = [
    user?.retirementAge ? `retire at ${user.retirementAge}` : null,
    `${pct(user?.expectedReturnRate, DEFAULT_RETURN_RATE)} return`,
    `${pct(user?.expectedInflationRate, DEFAULT_INFLATION_RATE)} inflation`,
  ].filter(Boolean).join(' · ');

  const links: { icon: React.ComponentProps<typeof Ionicons>['name']; tint: string; title: string; subtitle: string; route: string }[] = [
    { icon: 'pie-chart', tint: c.info, title: 'Assets', subtitle: 'Investments, deposits and savings', route: 'Assets' },
    { icon: 'wallet', tint: c.purple, title: 'Income streams', subtitle: 'Salary and other receipts', route: 'IncomeFlow' },
    { icon: 'flag', tint: c.success, title: 'Savings goals', subtitle: 'What you are saving towards', route: 'Goals' },
    { icon: 'calendar', tint: c.warning, title: 'Bills', subtitle: 'Recurring payments and auto-deductions', route: 'Liabilities' },
    { icon: 'people', tint: c.chart[3], title: 'Family & household', subtitle: 'Shared view, private transactions', route: 'Family' },
  ];

  return (
    <View style={s.screen}>
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingTop: headerHeight, paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
      >
        <LargeTitle title="You" />

        <View style={s.body}>
          {/* Profile card */}
          <Animated.View entering={enterUp(0)}>
            <Card variant="hero" style={s.profile}>
              <Pressable onPress={handlePickAvatar} disabled={avatarBusy} accessibilityRole="button" accessibilityLabel="Change profile picture">
                <View style={s.avatar}>
                  {shownAvatar ? (
                    <Image key={avatarRenderKey} source={{ uri: shownAvatar }} style={s.avatarImg} />
                  ) : (
                    <Text style={s.avatarInitials}>{getInitials(user?.name)}</Text>
                  )}
                  {avatarBusy && <View style={s.avatarBusy}><ActivityIndicator color="#FFFFFF" /></View>}
                </View>
                <View style={s.cameraBadge}>
                  <Ionicons name="camera" size={13} color={c.primary} />
                </View>
              </Pressable>
              <Text style={s.name} numberOfLines={1}>{user?.name || 'Your name'}</Text>
              <Text style={s.email} numberOfLines={1}>{user?.email}</Text>
              <View style={s.facts}>
                <View style={s.fact}>
                  <Text style={s.factValue}>{user?.monthlyIncome ? formatCurrency(user.monthlyIncome) : '—'}</Text>
                  <Text style={s.factLabel}>Declared income / mo</Text>
                </View>
                <View style={s.factDivider} />
                <View style={s.fact}>
                  <Text style={s.factValue}>{user?.retirementAge ?? '—'}</Text>
                  <Text style={s.factLabel}>Retirement age</Text>
                </View>
              </View>
            </Card>
          </Animated.View>

          <SectionHeader title="Planning" />
          <Card padded={false} style={s.group}>
            <View style={s.groupInner}>
              <ListRow icon="options" tint={c.primary} title="Planning assumptions" subtitle={assumptionsSummary} onPress={openEditModal} />
            </View>
          </Card>

          <SectionHeader title="Your money" />
          <Card padded={false} style={s.group}>
            <View style={s.groupInner}>
              {links.map((l, i) => (
                <View key={l.route} style={i > 0 && s.divider}>
                  <ListRow icon={l.icon} tint={l.tint} title={l.title} subtitle={l.subtitle} onPress={() => navigation.navigate(l.route)} />
                </View>
              ))}
            </View>
          </Card>

          <SectionHeader title="Appearance" />
          <View style={s.segment} accessibilityRole="radiogroup">
            {(['light', 'dark', 'system'] as const).map((m) => (
              <Chip
                key={m}
                label={m === 'system' ? 'Automatic' : m === 'light' ? 'Light' : 'Dark'}
                icon={m === 'light' ? 'sunny-outline' : m === 'dark' ? 'moon-outline' : 'phone-portrait-outline'}
                selected={themeMode === m}
                onPress={() => setThemeMode(m)}
                style={s.flex}
              />
            ))}
          </View>

          <SectionHeader title="Account" />
          <Card padded={false} style={s.group}>
            <View style={s.groupInner}>
              <ListRow icon="mail" tint={c.textMuted} title={user?.email || 'Email'} subtitle="Your sign-in email can't be changed" />
              <View style={s.divider}>
                <ListRow icon="gift" tint={c.textMuted} title="Date of birth" subtitle={user?.dateOfBirth ? formatDay(toDate(user.dateOfBirth)) : 'Not set'} onPress={openEditModal} />
              </View>
            </View>
          </Card>

          <Button label="Sign out" icon="log-out-outline" variant="destructive" onPress={confirmSignOut} style={s.signOut} accessibilityLabel="Sign Out of FINAURA Account" />
          <Text style={s.version}>FINAURA {Constants.expoConfig?.version ?? ''}</Text>
        </View>
      </Animated.ScrollView>

      <ScreenHeader title="You" y={y} onBack={() => navigation.goBack()} />

      {/* Planning assumptions editor */}
      <Modal visible={editVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setEditVisible(false)}>
        <KeyboardAvoidingView style={s.sheet} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={s.sheetHeader}>
            <Pressable onPress={() => setEditVisible(false)} hitSlop={10} accessibilityRole="button">
              <Text style={s.sheetCancel}>Cancel</Text>
            </Pressable>
            <Text style={s.sheetTitle}>Planning assumptions</Text>
            <View style={s.sheetSpacer} />
          </View>
          <ScrollView contentContainerStyle={s.sheetBody} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={s.sheetIntro}>Forecasts, retirement odds and your health score use these values.</Text>

            <Text style={s.group1}>About you</Text>
            <Field label="Full name" icon="person-outline" value={form.name} onChangeText={set('name')} />
            <DateField label="Date of birth" value={editDOB} onChange={setEditDOB} maximumDate={new Date()} />
            <Field
              label="Declared monthly income (₹)"
              icon="cash-outline"
              value={form.income}
              onChangeText={set('income')}
              keyboardType="numeric"
              hint="A planning baseline. Actual receipts are logged separately in Income Streams."
            />

            <Text style={s.group1}>Retirement</Text>
            <Field label="Target retirement age" icon="hourglass-outline" value={form.retAge} onChangeText={set('retAge')} keyboardType="number-pad" />
            <Field label="Personal corpus goal (₹)" icon="trophy-outline" value={form.corpus} onChangeText={set('corpus')} keyboardType="numeric" hint="Optional. Leave blank to use FINAURA's estimate." />
            <Field label="Lifestyle in retirement (% of today)" icon="cafe-outline" value={form.life} onChangeText={set('life')} keyboardType="numeric" />

            <Text style={s.group1}>Market assumptions</Text>
            <View style={s.row2}>
              <View style={s.flex}><Field label="Return %" value={form.ret} onChangeText={set('ret')} keyboardType="numeric" /></View>
              <View style={s.flex}><Field label="Inflation %" value={form.inf} onChangeText={set('inf')} keyboardType="numeric" /></View>
            </View>
            <View style={s.row2}>
              <View style={s.flex}><Field label="Safe withdrawal %" value={form.swr} onChangeText={set('swr')} keyboardType="numeric" /></View>
              <View style={s.flex}><Field label="Emergency fund (months)" value={form.ef} onChangeText={set('ef')} keyboardType="number-pad" /></View>
            </View>

            {!!editError && <Text style={s.error} accessibilityRole="alert">{editError}</Text>}
            <Button label="Save assumptions" icon="checkmark-circle-outline" onPress={handleSave} style={s.save} />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const useSStyles = createStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.bg },
  flex: { flex: 1 },
  body: { paddingHorizontal: 16 },
  profile: { alignItems: 'center', paddingVertical: 24 },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarInitials: { fontSize: 30, fontWeight: '800', color: c.onAurora },
  avatarBusy: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.35)' },
  cameraBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  name: { ...typeScale.title, color: c.onAurora, marginTop: 14 },
  email: { ...typeScale.caption, color: c.onAuroraMuted, marginTop: 2 },
  facts: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    marginTop: 20,
    paddingVertical: 12,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  fact: { flex: 1, alignItems: 'center' },
  factDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.2)' },
  factValue: { ...typeScale.headline, color: c.onAurora, fontVariant: ['tabular-nums'] },
  factLabel: { fontSize: 11, color: c.onAuroraMuted, marginTop: 2 },
  group: { paddingHorizontal: 14, paddingVertical: 4 },
  groupInner: {},
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
  segment: { flexDirection: 'row', gap: 8 },
  signOut: { marginTop: 28 },
  version: { ...typeScale.caption, color: c.textSubtle, textAlign: 'center', marginTop: 14 },
  sheet: { flex: 1, backgroundColor: c.bg },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  sheetCancel: { fontSize: 16, color: c.primary, width: 64 },
  sheetTitle: { ...typeScale.headline, color: c.text },
  sheetSpacer: { width: 64 },
  sheetBody: { padding: 20, paddingBottom: 48 },
  sheetIntro: { ...typeScale.body, color: c.textMuted, marginBottom: 6 },
  group1: { ...typeScale.overline, color: c.textSubtle, marginTop: 18, marginBottom: 10 },
  row2: { flexDirection: 'row', gap: 12 },
  error: { fontSize: 13, color: c.danger, textAlign: 'center', marginTop: 8 },
  save: { marginTop: 16 },
}));
