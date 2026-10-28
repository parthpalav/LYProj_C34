import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated from 'react-native-reanimated';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getLiabilities, createLiability, updateLiability, deleteLiability, getLiabilitiesPaymentsSummary, getLiabilityTransactions } from '../services/api';
import { toast } from '../store/useCelebrationStore';
import { enterUp, exitFade, listLayout } from '../motion';
import { Liability, LiabilityPaymentSummary, LiabilityPaymentHistoryResponse, Transaction } from '../types';
import { createStyles, radius, tabular, typeScale, useTheme } from '../theme';
import { formatCurrency, monthlyEquivalent } from '../utils/format';
import { dueDatesWithin, nextDue } from '../utils/bills';
import { Card } from '../components/ui/Card';
import { Badge, Chip, EmptyState, ErrorState, IconTile, MoneyText, SectionHeader } from '../components/ui/Bits';
import { Button } from '../components/ui/Button';
import { Field } from '../components/ui/Field';
import { DateField } from '../components/ui/DateField';
import { LargeTitle, ScreenHeader, useHeaderHeight, useScrollHeader } from '../components/ui/ScreenHeader';
import { SkeletonCard } from '../components/motion/Skeleton';

const VALID_CATEGORIES = [
  'Food & Dining', 'Groceries', 'Transport & Travel', 'Housing',
  'Utilities & Bills', 'Debt & Loan Payments', 'Shopping', 'Entertainment',
  'Health', 'Education', 'Personal Care', 'Insurance', 'Investments', 'Misc'
];
const VALID_TYPES: ('Need' | 'Want' | 'Investment')[] = ['Need', 'Want', 'Investment'];
const FREQUENCIES = ['daily', 'weekly', 'monthly', 'yearly'] as const;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const STRIP_DAYS = 14;

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const shortDate = (d: Date) => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

function relativeDue(d: Date): string {
  const today = new Date();
  const diff = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / 86400000);
  if (diff === 0) return 'Due today';
  if (diff === 1) return 'Due tomorrow';
  if (diff < 7) return `Due in ${diff} days`;
  return `Due ${shortDate(d)}`;
}

export function LiabilitiesScreen() {
  const { c } = useTheme();
  const styles = useStyles();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { y, onScroll } = useScrollHeader();
  const [liabilities, setLiabilities] = useState<Liability[]>([]);
  const [paymentSummaries, setPaymentSummaries] = useState<Record<string, LiabilityPaymentSummary>>({});
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState('');

  // Form State
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Utilities & Bills');
  const [type, setType] = useState<'Need' | 'Want' | 'Investment'>('Need');
  const [autoDeduct, setAutoDeduct] = useState(false);
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('monthly');
  const [startDate, setStartDate] = useState(new Date());
  const [dayOfWeek, setDayOfWeek] = useState(0);
  const [dayOfMonth, setDayOfMonth] = useState('1');
  const [monthOfYear, setMonthOfYear] = useState(1);

  // Payment History Modal State
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [selectedLiabilityForHistory, setSelectedLiabilityForHistory] = useState<Liability | null>(null);
  const [historyData, setHistoryData] = useState<LiabilityPaymentHistoryResponse | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyPage, setHistoryPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [liabilitiesData, summariesData] = await Promise.all([
        getLiabilities(),
        getLiabilitiesPaymentsSummary().catch(() => ({})),
      ]);
      setLiabilities(liabilitiesData);
      setPaymentSummaries(summariesData || {});
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

  const openAddModal = () => {
    setEditingId(null);
    setName('');
    setAmount('');
    setCategory('Utilities & Bills');
    setType('Need');
    setAutoDeduct(false);
    setFrequency('monthly');
    setStartDate(new Date());
    setDayOfWeek(new Date().getDay());
    setDayOfMonth(String(new Date().getDate()));
    setMonthOfYear(new Date().getMonth() + 1);
    setFormError('');
    setModalVisible(true);
  };

  const openEditModal = (liability: Liability) => {
    setEditingId(liability.id);
    setName(liability.name);
    setAmount(String(liability.amount));
    setCategory(liability.category);
    setType(liability.type);
    setAutoDeduct(liability.autoDeduct);
    setFrequency(liability.frequency);
    setStartDate(liability.startDate ? new Date(liability.startDate) : new Date());
    setDayOfWeek(liability.dayOfWeek ?? 0);
    setDayOfMonth(String(liability.dayOfMonth || 1));
    setMonthOfYear(liability.monthOfYear || 1);
    setFormError('');
    setModalVisible(true);
  };

  const handleSave = async () => {
    const amt = Number(amount);
    if (!name.trim()) return setFormError('Give the bill a name, like Rent or Netflix.');
    if (!amount || isNaN(amt) || amt <= 0) return setFormError('Enter an amount greater than zero.');
    const dom = parseInt(dayOfMonth, 10);
    if ((frequency === 'monthly' || frequency === 'yearly') && (isNaN(dom) || dom < 1 || dom > 31)) {
      return setFormError('Day of month must be between 1 and 31.');
    }

    const payload: Partial<Liability> = {
      name: name.trim(),
      amount: amt,
      category,
      type,
      autoDeduct,
      frequency,
      startDate: startDate.toISOString(),
    };
    if (frequency === 'weekly') payload.dayOfWeek = dayOfWeek;
    if (frequency === 'monthly') payload.dayOfMonth = dom;
    if (frequency === 'yearly') {
      payload.dayOfMonth = dom;
      payload.monthOfYear = monthOfYear;
    }

    try {
      if (editingId) await updateLiability(editingId, payload);
      else await createLiability(payload);
      setModalVisible(false);
      fetchData();
      toast(editingId ? 'Bill updated' : 'Bill added', { subtitle: `${name.trim()} · ${formatCurrency(amt)} ${frequency}` });
    } catch (e: any) {
      setFormError(e?.response?.data?.error || "Couldn't save. Check your connection and try again.");
    }
  };

  const handleDelete = (item: Liability) => {
    Alert.alert(`Remove ${item.name}?`, 'Past payments stay in your history. Future auto-deductions stop.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteLiability(item.id);
            fetchData();
            toast('Bill removed', { tone: 'info', subtitle: item.name });
          } catch {
            toast("Couldn't remove that bill", { tone: 'error' });
          }
        },
      },
    ]);
  };

  // ── History ─────────────────────────────────────────────────
  const loadHistory = async (id: string, page: number = 1) => {
    try {
      if (page === 1) setHistoryLoading(true);
      else setLoadingMore(true);
      setHistoryError(null);
      const res = await getLiabilityTransactions(id, page, 20);
      setHistoryData((prev) => (page === 1 || !prev ? res : { ...res, transactions: [...prev.transactions, ...res.transactions] }));
      setHistoryPage(page);
    } catch (e: any) {
      setHistoryError(e?.response?.data?.message || "Couldn't load payment history.");
    } finally {
      setHistoryLoading(false);
      setLoadingMore(false);
    }
  };

  const openHistoryModal = (liability: Liability) => {
    setSelectedLiabilityForHistory(liability);
    setHistoryModalVisible(true);
    setHistoryPage(1);
    setHistoryData(null);
    loadHistory(liability.id, 1);
  };

  const loadMoreHistory = () => {
    if (!selectedLiabilityForHistory || !historyData || loadingMore) return;
    if (historyData.pagination.page < historyData.pagination.totalPages) loadHistory(selectedLiabilityForHistory.id, historyPage + 1);
  };

  // ── Derivations ─────────────────────────────────────────────
  const activeLiabilities = useMemo(() => liabilities.filter((l) => l.status === 'active' || !l.status), [liabilities]);

  const totalMonthlyCommitments = useMemo(
    () => activeLiabilities.reduce((sum, curr) => sum + monthlyEquivalent(curr.amount, curr.frequency), 0),
    [activeLiabilities],
  );

  // Every bill falling in the next 30 days, soonest first.
  const upcoming = useMemo(
    () => activeLiabilities
      .flatMap((l) => dueDatesWithin(l, 30).map((date) => ({ l, date })))
      .sort((a, b) => a.date.getTime() - b.date.getTime()),
    [activeLiabilities],
  );
  const dueNext30 = upcoming.reduce((s, u) => s + u.l.amount, 0);
  const strip = useMemo(() => Array.from({ length: STRIP_DAYS }, (_, i) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + i);
    return { date: d, items: upcoming.filter((u) => sameDay(u.date, d)) };
  }), [upcoming]);
  const listed = selectedDay ? upcoming.filter((u) => sameDay(u.date, selectedDay)) : upcoming.slice(0, 5);

  const body = () => {
    if (loading) return <View style={styles.body}>{[0, 1].map((i) => <SkeletonCard key={i} style={styles.skeleton} />)}</View>;
    if (loadFailed && !liabilities.length) return <ErrorState onRetry={fetchData} />;
    if (activeLiabilities.length === 0) {
      return (
        <EmptyState
          emoji="📅"
          title="No bills yet"
          message="Add rent, EMIs, subscriptions or insurance to see what's due and when."
          actionLabel="Add a bill"
          onAction={openAddModal}
        />
      );
    }
    return (
      <View style={styles.body}>
        {/* Overview */}
        <Animated.View entering={enterUp(0)}>
          <Card variant="hero">
            <Text style={styles.heroLabel}>Every month</Text>
            <MoneyText value={Math.round(totalMonthlyCommitments)} style={styles.heroValue} />
            <View style={styles.heroRow}>
              <View style={styles.heroStat}>
                <Text style={styles.heroStatValue}>{activeLiabilities.length}</Text>
                <Text style={styles.heroStatLabel}>Active Liabilities</Text>
              </View>
              <View style={styles.heroStat}>
                <Text style={styles.heroStatValue}>{formatCurrency(dueNext30)}</Text>
                <Text style={styles.heroStatLabel}>Due in 30 days</Text>
              </View>
            </View>
          </Card>
        </Animated.View>

        {/* Due-date strip */}
        <SectionHeader title="Coming up" action={selectedDay ? 'Show all' : undefined} onAction={() => setSelectedDay(null)} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
          {strip.map(({ date, items }, i) => {
            const selected = selectedDay ? sameDay(selectedDay, date) : false;
            return (
              <Pressable
                key={i}
                onPress={() => setSelectedDay(selected ? null : date)}
                style={[styles.dayCell, i === 0 && styles.dayToday, selected && styles.daySelected]}
                accessibilityRole="button"
                accessibilityLabel={`${date.toDateString()}, ${items.length} bill${items.length === 1 ? '' : 's'} due`}
              >
                <Text style={[styles.dayName, selected && styles.dayTextOn]}>{WEEKDAYS[date.getDay()]}</Text>
                <Text style={[styles.dayNum, selected && styles.dayTextOn]}>{date.getDate()}</Text>
                <View style={styles.dots}>
                  {items.slice(0, 3).map((_, k) => <View key={k} style={[styles.dot, selected && styles.dotOn]} />)}
                </View>
              </Pressable>
            );
          })}
        </ScrollView>

        <Card padded={false} style={styles.upcomingCard}>
          {listed.length === 0 ? (
            <Text style={styles.noneDue}>{selectedDay ? `Nothing due on ${shortDate(selectedDay)}.` : 'Nothing due in the next 30 days.'}</Text>
          ) : (
            listed.map(({ l, date }, i) => (
              <View key={`${l.id}-${date.getTime()}`} style={[styles.upcomingRow, i > 0 && styles.divider]}>
                <View style={styles.datePill}>
                  <Text style={styles.datePillDay}>{date.getDate()}</Text>
                  <Text style={styles.datePillMonth}>{MONTHS[date.getMonth()]}</Text>
                </View>
                <View style={styles.flex}>
                  <Text style={styles.rowTitle} numberOfLines={1}>{l.name}</Text>
                  <Text style={styles.rowSub}>{relativeDue(date)}{l.autoDeduct ? ' · auto-deducts' : ''}</Text>
                </View>
                <Text style={styles.rowAmount}>{formatCurrency(l.amount)}</Text>
              </View>
            ))
          )}
        </Card>

        {/* All bills */}
        <SectionHeader title="All bills" />
        {activeLiabilities.map((item, idx) => {
          const summary = paymentSummaries[item.id];
          const hasPayments = summary && summary.paymentCount > 0;
          const due = nextDue(item);
          return (
            <Animated.View key={item.id} entering={enterUp(idx)} exiting={exitFade} layout={listLayout}>
              <Card style={styles.billCard}>
                <View style={styles.billTop}>
                  <IconTile icon={item.autoDeduct ? 'flash' : 'calendar'} tint={item.autoDeduct ? c.success : c.warning} />
                  <View style={styles.flex}>
                    <Text style={styles.rowTitle} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.rowSub}>{cap(item.frequency)} · {item.category}</Text>
                  </View>
                  <View style={styles.billRight}>
                    <Text style={styles.rowAmount}>{formatCurrency(item.amount)}</Text>
                    <Text style={styles.rowSub}>{relativeDue(due)}</Text>
                  </View>
                </View>

                <View style={styles.badges}>
                  <Badge label={item.autoDeduct ? 'Auto deduct on' : 'Pay manually'} tone={item.autoDeduct ? 'success' : 'neutral'} />
                  <Badge label={item.type} tone="primary" />
                  {hasPayments ? (
                    <Badge label={`Last paid ${shortDate(new Date(summary.lastPaymentDate!))}`} />
                  ) : (
                    <Badge label="No payments yet" />
                  )}
                </View>

                <View style={styles.actions}>
                  <Pressable style={styles.action} onPress={() => openHistoryModal(item)} accessibilityRole="button" accessibilityLabel={`Payment history for ${item.name}`}>
                    <Ionicons name="receipt-outline" size={16} color={c.primary} />
                    <Text style={styles.actionText}>History</Text>
                  </Pressable>
                  <Pressable style={styles.action} onPress={() => openEditModal(item)} accessibilityRole="button" accessibilityLabel={`Edit ${item.name}`}>
                    <Ionicons name="create-outline" size={16} color={c.textMuted} />
                    <Text style={[styles.actionText, { color: c.textMuted }]}>Edit</Text>
                  </Pressable>
                  <Pressable style={styles.action} onPress={() => handleDelete(item)} accessibilityRole="button" accessibilityLabel={`Remove ${item.name}`}>
                    <Ionicons name="trash-outline" size={16} color={c.danger} />
                    <Text style={[styles.actionText, { color: c.danger }]}>Remove</Text>
                  </Pressable>
                </View>
              </Card>
            </Animated.View>
          );
        })}
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
        refreshControl={<RefreshControl refreshing={refreshing} progressViewOffset={headerHeight} onRefresh={async () => { setRefreshing(true); await fetchData(); setRefreshing(false); }} />}
      >
        <LargeTitle
          title="Bills"
          subtitle="Recurring payments and auto-deductions"
          right={
            <Pressable style={styles.addBtn} onPress={openAddModal} accessibilityRole="button" accessibilityLabel="Add Liability">
              <Ionicons name="add" size={22} color={c.onPrimary} />
            </Pressable>
          }
        />
        {body()}
      </Animated.ScrollView>
      <ScreenHeader title="Bills" y={y} onBack={() => navigation.goBack()} />

      {/* Add / edit */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Pressable onPress={() => setModalVisible(false)} hitSlop={10} accessibilityRole="button">
              <Text style={styles.sheetCancel}>Cancel</Text>
            </Pressable>
            <Text style={styles.sheetTitle}>{editingId ? 'Edit bill' : 'New bill'}</Text>
            <View style={styles.sheetSpacer} />
          </View>
          <ScrollView contentContainerStyle={styles.sheetBody} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Field label="Name" icon="pricetag-outline" value={name} onChangeText={(v) => { setName(v); setFormError(''); }} placeholder="Rent, Netflix, Car EMI" />
            <Field label="Amount (₹)" icon="cash-outline" value={amount} onChangeText={(v) => { setAmount(v); setFormError(''); }} keyboardType="numeric" placeholder="25000" />

            <Text style={styles.label}>How often</Text>
            <View style={styles.chipRow}>
              {FREQUENCIES.map((f) => <Chip key={f} label={cap(f)} selected={frequency === f} onPress={() => setFrequency(f)} style={styles.flex} />)}
            </View>

            {frequency === 'weekly' && (
              <>
                <Text style={styles.label}>On</Text>
                <View style={styles.chipRow}>
                  {WEEKDAYS.map((d, i) => <Chip key={d} label={d.charAt(0)} selected={dayOfWeek === i} onPress={() => setDayOfWeek(i)} style={styles.flex} />)}
                </View>
              </>
            )}
            {frequency === 'yearly' && (
              <>
                <Text style={styles.label}>Month</Text>
                <View style={styles.chipWrap}>
                  {MONTHS.map((m, i) => <Chip key={m} label={m} selected={monthOfYear === i + 1} onPress={() => setMonthOfYear(i + 1)} />)}
                </View>
              </>
            )}
            {(frequency === 'monthly' || frequency === 'yearly') && (
              <Field label="Day of month" icon="calendar-number-outline" value={dayOfMonth} onChangeText={(v) => { setDayOfMonth(v.replace(/[^0-9]/g, '')); setFormError(''); }} keyboardType="number-pad" hint="1 to 31. Shorter months use their last day." />
            )}
            <DateField label="Starts on" value={startDate} onChange={setStartDate} />

            <Text style={styles.label}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {VALID_CATEGORIES.map((cat) => <Chip key={cat} label={cat} selected={category === cat} onPress={() => setCategory(cat)} />)}
            </ScrollView>

            <Text style={styles.label}>Type</Text>
            <View style={styles.chipRow}>
              {VALID_TYPES.map((t) => <Chip key={t} label={t} selected={type === t} onPress={() => setType(t)} style={styles.flex} />)}
            </View>

            <View style={styles.switchRow}>
              <View style={styles.flex}>
                <Text style={styles.rowTitle}>Auto deduct</Text>
                <Text style={styles.rowSub}>FINAURA logs the payment for you on each due date.</Text>
              </View>
              <Switch value={autoDeduct} onValueChange={setAutoDeduct} trackColor={{ true: c.primary }} />
            </View>

            {!!formError && <Text style={styles.error} accessibilityRole="alert">{formError}</Text>}
            <Button label={editingId ? 'Save changes' : 'Add bill'} onPress={handleSave} style={styles.save} />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Payment history */}
      <Modal visible={historyModalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setHistoryModalVisible(false)}>
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <View style={styles.sheetSpacer} />
            <View style={styles.historyTitleWrap}>
              <Text style={styles.sheetTitle} numberOfLines={1}>{selectedLiabilityForHistory?.name || 'Bill'}</Text>
              <Text style={styles.rowSub}>Payment History</Text>
            </View>
            <Pressable onPress={() => setHistoryModalVisible(false)} hitSlop={10} style={styles.sheetSpacer} accessibilityRole="button">
              <Text style={[styles.sheetCancel, styles.right]}>Done</Text>
            </Pressable>
          </View>

          {historyLoading && !historyData ? (
            <View style={styles.center}><ActivityIndicator size="large" color={c.primary} /></View>
          ) : historyError ? (
            <ErrorState message={historyError} onRetry={() => selectedLiabilityForHistory && loadHistory(selectedLiabilityForHistory.id, 1)} />
          ) : historyData ? (
            <ScrollView contentContainerStyle={styles.sheetBody} showsVerticalScrollIndicator={false}>
              <Card variant="hero" style={styles.historySummary}>
                {[
                  ['Total paid', formatCurrency(Math.round(historyData.summary.totalPaid))],
                  ['Payments', String(historyData.summary.paymentCount)],
                  ['Last', historyData.summary.lastPaymentDate ? shortDate(new Date(historyData.summary.lastPaymentDate)) : '—'],
                ].map(([label, value]) => (
                  <View key={label} style={styles.flexCenter}>
                    <Text style={styles.heroStatValue}>{value}</Text>
                    <Text style={styles.heroStatLabel}>{label}</Text>
                  </View>
                ))}
              </Card>

              {historyData.transactions.length === 0 ? (
                <EmptyState emoji="🧾" title="No payments recorded yet" message="Auto-deductions and payments you link to this bill will appear here." />
              ) : (
                <Card padded={false} style={styles.upcomingCard}>
                  {historyData.transactions.map((tx: Transaction, i: number) => (
                    <View key={tx.id} style={[styles.upcomingRow, i > 0 && styles.divider]}>
                      <IconTile icon={tx.classificationSource === 'liability' ? 'flash' : 'hand-left-outline'} tint={tx.classificationSource === 'liability' ? c.success : c.primary} size={36} />
                      <View style={styles.flex}>
                        <Text style={styles.rowTitle}>{new Date(tx.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
                        <Text style={styles.rowSub}>{tx.classificationSource === 'liability' ? 'Auto deduct' : 'Manual payment'}</Text>
                      </View>
                      <Text style={styles.rowAmount}>{formatCurrency(tx.amount)}</Text>
                    </View>
                  ))}
                </Card>
              )}

              {historyData.pagination.page < historyData.pagination.totalPages && (
                <Button label="Load more payments" variant="secondary" loading={loadingMore} onPress={loadMoreHistory} style={styles.save} />
              )}
            </ScrollView>
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

const useStyles = createStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  flexCenter: { flex: 1, alignItems: 'center' },
  right: { textAlign: 'right' },
  body: { paddingHorizontal: 16 },
  skeleton: { marginBottom: 12 },
  addBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: c.primary, marginBottom: 4 },
  heroLabel: { ...typeScale.caption, color: c.onAuroraMuted },
  heroValue: { ...typeScale.display, color: c.onAurora, marginTop: 2 },
  heroRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
  heroStat: { flex: 1, padding: 12, borderRadius: radius.md, backgroundColor: 'rgba(255,255,255,0.12)' },
  heroStatValue: { ...typeScale.headline, color: c.onAurora, ...tabular },
  heroStatLabel: { fontSize: 11, color: c.onAuroraMuted, marginTop: 2 },
  strip: { gap: 8, paddingBottom: 12 },
  dayCell: {
    width: 52,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: radius.md,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
  },
  dayToday: { borderColor: c.primary },
  daySelected: { backgroundColor: c.primary, borderColor: c.primary },
  dayName: { fontSize: 11, fontWeight: '600', color: c.textSubtle },
  dayNum: { ...typeScale.headline, color: c.text, marginTop: 2 },
  dayTextOn: { color: c.onPrimary },
  dots: { flexDirection: 'row', gap: 3, height: 6, marginTop: 4 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: c.warning },
  dotOn: { backgroundColor: c.onPrimary },
  upcomingCard: { paddingHorizontal: 14, paddingVertical: 4 },
  noneDue: { ...typeScale.body, color: c.textMuted, paddingVertical: 14, textAlign: 'center' },
  upcomingRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
  datePill: { width: 44, paddingVertical: 6, alignItems: 'center', borderRadius: radius.sm, backgroundColor: c.warningSoft },
  datePillDay: { ...typeScale.headline, color: c.warningStrong, ...tabular },
  datePillMonth: { fontSize: 10, fontWeight: '700', color: c.warningStrong },
  rowTitle: { fontSize: 15, fontWeight: '600', color: c.text },
  rowSub: { fontSize: 12, color: c.textMuted, marginTop: 2 },
  rowAmount: { fontSize: 15, fontWeight: '700', color: c.text, ...tabular },
  billCard: { marginBottom: 12 },
  billTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  billRight: { alignItems: 'flex-end' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  actions: { flexDirection: 'row', marginTop: 12, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
  action: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 4 },
  actionText: { fontSize: 13, fontWeight: '600', color: c.primary },
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
  sheetCancel: { fontSize: 16, color: c.primary },
  sheetTitle: { ...typeScale.headline, color: c.text, textAlign: 'center' },
  sheetSpacer: { width: 64 },
  historyTitleWrap: { flex: 1, alignItems: 'center' },
  sheetBody: { padding: 20, paddingBottom: 48 },
  label: { ...typeScale.overline, color: c.textSubtle, marginTop: 8, marginBottom: 10 },
  chipRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.md, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border },
  error: { fontSize: 13, color: c.danger, textAlign: 'center', marginTop: 14 },
  save: { marginTop: 18 },
  historySummary: { flexDirection: 'row', marginBottom: 16 },
}));
