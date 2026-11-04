import React, { useCallback, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated from 'react-native-reanimated';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createPaymentMethod, deletePaymentMethod, getPaymentMethods, updatePaymentMethod } from '../services/api';
import { toast } from '../store/useCelebrationStore';
import { enterUp, exitFade, listLayout } from '../motion';
import { PaymentMethod, PaymentMethodKind, PaymentMethodPayload } from '../types';
import { createStyles, typeScale, useTheme } from '../theme';
import { formatCurrency } from '../utils/format';
import { PAYMENT_KIND_LABEL, ordinalDay, paymentMethodLabel } from '../utils/paymentMethods';
import { Card } from '../components/ui/Card';
import { EmptyState, ErrorState, IconTile } from '../components/ui/Bits';
import { Button } from '../components/ui/Button';
import { Field } from '../components/ui/Field';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { LargeTitle, ScreenHeader, useHeaderHeight, useScrollHeader } from '../components/ui/ScreenHeader';
import { SkeletonCard } from '../components/motion/Skeleton';

const EMPTY = { kind: 'upi' as PaymentMethodKind, nickname: '', last4: '', upiId: '', creditLimit: '', statementDay: '', dueDay: '', used: '', billedUnpaid: '' };
const KINDS = (Object.keys(PAYMENT_KIND_LABEL) as PaymentMethodKind[]).map((k) => ({ key: k, label: PAYMENT_KIND_LABEL[k] }));

/** UPI IDs and cards the user pays with. Only a nickname and the last 4 digits are ever stored. */
export function PaymentMethodsScreen() {
  const { c } = useTheme();
  const styles = useStyles();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { y, onScroll } = useScrollHeader();
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PaymentMethod | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setMethods(await getPaymentMethods());
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const active = methods.filter((m) => m.status === 'active');
  const set = (key: keyof typeof EMPTY) => (value: string) => { setForm((p) => ({ ...p, [key]: value })); setFormError(''); };
  const digits = (key: keyof typeof EMPTY) => (v: string) => set(key)(v.replace(/[^0-9]/g, ''));
  const decimal = (key: keyof typeof EMPTY) => (v: string) => set(key)(v.replace(/[^0-9.]/g, ''));

  const openAdd = () => { setEditing(null); setForm(EMPTY); setFormError(''); setOpen(true); };
  const openEdit = (m: PaymentMethod) => {
    setEditing(m);
    setForm({
      kind: m.kind,
      nickname: m.nickname,
      last4: m.last4 ?? '',
      upiId: m.upiId ?? '',
      creditLimit: m.creditLimit != null ? String(m.creditLimit) : '',
      statementDay: m.statementDay != null ? String(m.statementDay) : '',
      dueDay: m.dueDay != null ? String(m.dueDay) : '',
      used: '',
      billedUnpaid: '',
    });
    setFormError('');
    setOpen(true);
  };

  const save = async () => {
    const payload: PaymentMethodPayload = { kind: form.kind, nickname: form.nickname.trim() };
    if (!payload.nickname) return setFormError('Give this payment method a nickname.');
    if (form.kind === 'upi') {
      payload.upiId = form.upiId.trim();
    } else {
      if (!/^\d{4}$/.test(form.last4)) return setFormError('Enter the last 4 digits of the card.');
      payload.last4 = form.last4;
    }
    if (form.kind === 'credit_card') {
      const limit = Number(form.creditLimit);
      const stmt = Number(form.statementDay);
      const due = Number(form.dueDay);
      if (!Number.isFinite(limit) || limit <= 0) return setFormError('Enter a credit limit greater than ₹0.');
      if (!Number.isInteger(stmt) || stmt < 1 || stmt > 31) return setFormError('Statement day must be a date from 1 to 31.');
      if (!Number.isInteger(due) || due < 1 || due > 31) return setFormError('Due day must be a date from 1 to 31.');
      Object.assign(payload, { creditLimit: limit, statementDay: stmt, dueDay: due });
      if (!editing) {
        const used = Number(form.used || 0);
        const billedUnpaid = Number(form.billedUnpaid || 0);
        if (!Number.isFinite(used) || used < 0) return setFormError('Amount already used must be ₹0 or more.');
        if (used > limit) return setFormError('Amount already used cannot be more than the credit limit.');
        if (!Number.isFinite(billedUnpaid) || billedUnpaid < 0) return setFormError('Unpaid statement amount must be ₹0 or more.');
        if (billedUnpaid > used) return setFormError('Unpaid statement amount cannot be more than the amount already used.');
        if (used > 0) Object.assign(payload, { used, billedUnpaid });
      }
    }
    setSaving(true);
    try {
      if (editing) {
        const { kind: _kind, ...changes } = payload;
        await updatePaymentMethod(editing.id, changes);
      } else {
        await createPaymentMethod(payload);
      }
      setOpen(false);
      toast(editing ? 'Payment method updated' : 'Payment method added', { subtitle: payload.nickname });
      load();
    } catch (err: any) {
      setFormError(err?.response?.data?.error || "Couldn't save. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  const remove = (m: PaymentMethod) => {
    const cardNote = m.kind === 'credit_card' ? ' A credit card can only be removed once its outstanding balance is paid off.' : '';
    Alert.alert(`Remove ${m.nickname}?`, `It will no longer appear when you record an expense. Past transactions keep their label.${cardNote}`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await deletePaymentMethod(m.id);
            toast('Payment method removed', { tone: 'info', subtitle: m.nickname });
            load();
          } catch (err: any) {
            toast("Couldn't remove it", { tone: 'error', subtitle: err?.response?.data?.error });
          }
        },
      },
    ]);
  };

  const body = () => {
    if (loading) return <View style={styles.body}>{[0, 1].map((i) => <SkeletonCard key={i} style={styles.gap} />)}</View>;
    if (loadFailed && !methods.length) return <ErrorState onRetry={load} />;
    if (!active.length) {
      return (
        <EmptyState
          emoji="💳"
          title="No payment methods yet"
          message="Expenses come out of your bank balance until you add UPI or a card."
          actionLabel="Add a method"
          onAction={openAdd}
        />
      );
    }
    return (
      <View style={styles.body}>
        {active.map((m, i) => (
          <Animated.View key={m.id} entering={enterUp(i)} exiting={exitFade} layout={listLayout}>
            <Card style={styles.gap}>
              <View style={styles.row}>
                <IconTile icon={m.kind === 'upi' ? 'phone-portrait' : 'card'} tint={m.kind === 'credit_card' ? c.purple : c.primary} />
                <View style={styles.flex}>
                  <Text style={styles.title} numberOfLines={1}>{paymentMethodLabel(m)}</Text>
                  <Text style={styles.sub}>
                    {PAYMENT_KIND_LABEL[m.kind]}
                    {m.kind === 'credit_card' && m.credit && ` · ${formatCurrency(m.credit.available)} of ${formatCurrency(m.credit.creditLimit)} available`}
                  </Text>
                  {m.kind === 'credit_card' && m.statementDay != null && m.dueDay != null && (
                    <Text style={styles.sub}>Statement {ordinalDay(m.statementDay)}, due {ordinalDay(m.dueDay)}</Text>
                  )}
                </View>
              </View>
              <View style={styles.actions}>
                <Pressable style={styles.action} onPress={() => openEdit(m)} accessibilityRole="button" accessibilityLabel={`Edit ${m.nickname}`}>
                  <Ionicons name="create-outline" size={16} color={c.textMuted} />
                  <Text style={[styles.actionText, { color: c.textMuted }]}>Edit</Text>
                </Pressable>
                <Pressable style={styles.action} onPress={() => remove(m)} accessibilityRole="button" accessibilityLabel={`Remove ${m.nickname}`}>
                  <Ionicons name="trash-outline" size={16} color={c.danger} />
                  <Text style={[styles.actionText, { color: c.danger }]}>Remove</Text>
                </Pressable>
              </View>
            </Card>
          </Animated.View>
        ))}
        <Text style={styles.footnote}>Credit cards also appear under Bills with their limit, due date and a Pay bill button.</Text>
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingTop: headerHeight, paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} progressViewOffset={headerHeight} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
      >
        <LargeTitle
          title="Payment methods"
          subtitle="UPI and cards. Pick one when you log an expense."
          right={
            <Pressable style={styles.addBtn} onPress={openAdd} accessibilityRole="button" accessibilityLabel="Add payment method">
              <Ionicons name="add" size={22} color={c.onPrimary} />
            </Pressable>
          }
        />
        {body()}
      </Animated.ScrollView>
      <ScreenHeader title="Payment methods" y={y} onBack={() => navigation.goBack()} />

      <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Pressable onPress={() => setOpen(false)} hitSlop={10} accessibilityRole="button">
              <Text style={styles.sheetCancel}>Cancel</Text>
            </Pressable>
            <Text style={styles.sheetTitle}>{editing ? 'Edit method' : 'New method'}</Text>
            <View style={styles.sheetSpacer} />
          </View>
          <ScrollView contentContainerStyle={styles.sheetBody} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={styles.intro}>Only a nickname and the last 4 digits are saved. Never enter a full card number or CVV.</Text>
            {editing ? (
              <Text style={styles.label}>{PAYMENT_KIND_LABEL[form.kind]}</Text>
            ) : (
              <SegmentedControl segments={KINDS} value={form.kind} onChange={(k) => { setForm((p) => ({ ...p, kind: k })); setFormError(''); }} accessibilityLabel="Type" style={styles.kinds} />
            )}
            <Field label="Nickname" icon="pricetag-outline" value={form.nickname} onChangeText={set('nickname')} maxLength={50} placeholder={form.kind === 'upi' ? 'e.g. GPay' : 'e.g. HDFC Regalia'} />
            {form.kind === 'upi' ? (
              <Field label="UPI ID" icon="at-outline" value={form.upiId} onChangeText={set('upiId')} placeholder="name@okhdfc" autoCapitalize="none" autoCorrect={false} />
            ) : (
              <Field label="Last 4 digits" icon="keypad-outline" value={form.last4} onChangeText={digits('last4')} keyboardType="number-pad" maxLength={4} placeholder="1234" />
            )}
            {form.kind === 'credit_card' && (
              <>
                <Field label="Credit limit (₹)" icon="cash-outline" value={form.creditLimit} onChangeText={decimal('creditLimit')} keyboardType="decimal-pad" />
                <View style={styles.row2}>
                  <View style={styles.flex}><Field label="Statement day" value={form.statementDay} onChangeText={digits('statementDay')} keyboardType="number-pad" placeholder="e.g. 20" hint="Bill is generated" /></View>
                  <View style={styles.flex}><Field label="Payment due day" value={form.dueDay} onChangeText={digits('dueDay')} keyboardType="number-pad" placeholder="e.g. 10" hint="Bill must be paid" /></View>
                </View>
                {!editing && (
                  <>
                    <Field label="Already used (₹, optional)" icon="trending-down-outline" value={form.used} onChangeText={decimal('used')} keyboardType="decimal-pad" placeholder="0" hint="Total owed on the card right now" />
                    <Field label="Unpaid from last statement (₹)" icon="document-text-outline" value={form.billedUnpaid} onChangeText={decimal('billedUnpaid')} keyboardType="decimal-pad" placeholder="0" hint="Part of it already billed and not yet paid" />
                  </>
                )}
              </>
            )}
            {!!formError && <Text style={styles.error} accessibilityRole="alert">{formError}</Text>}
            <Button label={editing ? 'Save changes' : 'Add method'} onPress={save} loading={saving} style={styles.save} />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const useStyles = createStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.bg },
  flex: { flex: 1 },
  body: { paddingHorizontal: 16 },
  gap: { marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  row2: { flexDirection: 'row', gap: 12 },
  title: { fontSize: 15, fontWeight: '600', color: c.text },
  sub: { fontSize: 12, color: c.textMuted, marginTop: 2 },
  footnote: { ...typeScale.caption, color: c.textSubtle, textAlign: 'center', marginTop: 4 },
  addBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: c.primary, marginBottom: 4 },
  actions: { flexDirection: 'row', marginTop: 12, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
  action: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 4 },
  actionText: { fontSize: 13, fontWeight: '600' },
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
  intro: { ...typeScale.caption, color: c.textMuted, marginBottom: 14 },
  label: { ...typeScale.overline, color: c.textSubtle, marginBottom: 14 },
  kinds: { marginBottom: 16 },
  error: { fontSize: 13, color: c.danger, textAlign: 'center', marginTop: 8 },
  save: { marginTop: 16 },
}));
