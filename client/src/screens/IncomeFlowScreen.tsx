import React, { useCallback, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated from 'react-native-reanimated';
import { addIncome, getIncomeFlow, updateIncome, deleteIncome } from '../services/api';
import { IncomeFlowData } from '../types';
import { formatCurrency } from '../utils/format';
import { celebrate, toast } from '../store/useCelebrationStore';
import { enterUp } from '../motion';
import { createStyles, radius, tabular, typeScale, useTheme } from '../theme';
import { AnimatedBar } from '../components/motion/AnimatedBar';
import { SkeletonCard } from '../components/motion/Skeleton';
import { Card } from '../components/ui/Card';
import { Badge, Chip, EmptyState, ErrorState, MoneyText, SectionHeader } from '../components/ui/Bits';
import { Button } from '../components/ui/Button';
import { Donut } from '../components/ui/Charts';
import { Field } from '../components/ui/Field';
import { DateField } from '../components/ui/DateField';
import { Sheet } from '../components/ui/Sheet';
import { LargeTitle, ScreenHeader, useHeaderHeight, useScrollHeader } from '../components/ui/ScreenHeader';

const SOURCE_LABELS: Record<string, string> = {
  salary: '💼 Salary',
  gig: '🛵 Gig',
  freelance: '💻 Freelance',
  business: '🏢 Business',
  rental: '🏠 Rental',
  consulting: '🤝 Consulting',
  bonus: '🎁 Bonus',
  other: '💰 Other',
};

const SOURCE_KEYS = ['salary', 'gig', 'freelance', 'business', 'rental', 'consulting', 'bonus', 'other'] as const;

type Entry = IncomeFlowData['timeline'][number];

/** Add or edit one income receipt in a page sheet. */
function IncomeEditor({ entry, visible, onClose, onSaved }: { entry: Entry | null; visible: boolean; onClose: () => void; onSaved: () => void }) {
  const s = useSStyles();
  const [amount, setAmount] = useState('');
  const [source, setSource] = useState<string>('salary');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date());
  const [error, setError] = useState('');

  // Reset the form each time the sheet opens.
  const [openedFor, setOpenedFor] = useState<string | null | undefined>(undefined);
  const key = visible ? entry?.id ?? null : undefined;
  if (key !== openedFor) {
    setOpenedFor(key);
    if (visible) {
      setAmount(entry ? String(entry.amount) : '');
      setSource(entry?.source ?? 'salary');
      setDescription(entry?.description ?? '');
      setDate(entry ? new Date(entry.timestamp) : new Date());
      setError('');
    }
  }

  const save = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return setError('Enter an amount greater than zero.');
    const payload = {
      amount: amt,
      source,
      description: description.trim() || SOURCE_LABELS[source] || source,
      date: date.toISOString().split('T')[0],
    };
    try {
      if (entry) await updateIncome(entry.id, payload);
      else await addIncome(payload);
      onClose();
      onSaved();
      if (entry) toast('Income updated');
      else celebrate({ kind: 'coins', title: `${formatCurrency(amt)} income added`, subtitle: `Logged as ${SOURCE_LABELS[source] || source}.` });
    } catch {
      setError("Couldn't save. Check your connection and try again.");
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={s.sheet} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={s.sheetHeader}>
          <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button"><Text style={s.sheetCancel}>Cancel</Text></Pressable>
          <Text style={s.sheetTitle}>{entry ? 'Edit income' : 'Add Income'}</Text>
          <View style={s.sheetSpacer} />
        </View>
        <ScrollView contentContainerStyle={s.sheetBody} keyboardShouldPersistTaps="handled">
          <Field label="Amount (₹)" icon="cash-outline" value={amount} onChangeText={(v) => { setAmount(v.replace(/[^0-9.]/g, '')); setError(''); }} keyboardType="numeric" placeholder="e.g. 25000" autoFocus={!entry} />
          <Text style={s.label}>Source</Text>
          <View style={s.chips}>
            {SOURCE_KEYS.map((k) => <Chip key={k} label={SOURCE_LABELS[k]} selected={source === k} onPress={() => setSource(k)} />)}
          </View>
          <Field label="Description" icon="create-outline" value={description} onChangeText={setDescription} placeholder="e.g. October salary, client invoice" />
          <DateField label="Received on" value={date} onChange={setDate} maximumDate={new Date()} />
          {!!error && <Text style={s.error} accessibilityRole="alert">{error}</Text>}
          <Button label={entry ? 'Save changes' : 'Add income'} onPress={save} style={s.save} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function IncomeFlowScreen(): React.ReactElement {
  const { c } = useTheme();
  const s = useSStyles();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { y, onScroll } = useScrollHeader();
  const [flow, setFlow] = useState<IncomeFlowData | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Entry | null>(null);
  const [selected, setSelected] = useState<Entry | null>(null);
  const editAfterClose = useRef(false);

  const fetchFlow = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      setFlow(await getIncomeFlow());
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { fetchFlow(); }, [fetchFlow]));

  const openEditor = (entry: Entry | null) => {
    setEditing(entry);
    if (!selected) return setEditorOpen(true);
    // The options sheet must finish closing before iOS will present the editor.
    editAfterClose.current = true;
    setSelected(null);
  };

  const confirmDelete = (item: Entry) => {
    setSelected(null);
    Alert.alert('Delete this income?', `${item.description || SOURCE_LABELS[item.source] || item.source} · ${formatCurrency(item.amount)}`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteIncome(item.id);
            fetchFlow(true);
            toast('Income deleted', { tone: 'info' });
          } catch {
            toast("Couldn't delete that entry", { tone: 'error' });
          }
        },
      },
    ]);
  };

  const sourceColor = (k: string) => c.chart[Math.max(0, SOURCE_KEYS.indexOf(k as (typeof SOURCE_KEYS)[number])) % c.chart.length];
  const volatility = flow?.volatility ?? 0;
  const sources = Object.entries(flow?.sources ?? {}).sort((a, b) => b[1] - a[1]);
  const split = flow
    ? [
      { label: 'Essentials', pct: 50, value: flow.allocation.essentials, color: c.primary },
      { label: 'Goals', pct: 30, value: flow.allocation.goals, color: c.success },
      { label: 'Emergency', pct: 20, value: flow.allocation.emergency, color: c.warning },
    ]
    : [];

  const body = () => {
    if (loading && !flow) return <View style={s.body}>{[0, 1].map((i) => <SkeletonCard key={i} style={s.gap} />)}</View>;
    if (failed && !flow) return <ErrorState onRetry={() => fetchFlow(true)} />;
    if (!flow || flow.incomeCount === 0) {
      return <EmptyState emoji="💸" title="No income recorded yet" message="Log your salary or any money that comes in to see your monthly flow." actionLabel="+ Add Income" onAction={() => openEditor(null)} />;
    }
    return (
      <View style={s.body}>
        <Animated.View entering={enterUp(0)}>
          <Card variant="hero">
            <Text style={s.heroLabel}>This month</Text>
            <MoneyText value={flow.total} style={s.heroValue} />
            <View style={s.heroRow}>
              <View style={s.heroStat}>
                <Text style={s.heroStatLabel}>Daily pace</Text>
                <Text style={s.heroStatValue}>{formatCurrency(flow.dailySmoothed)}</Text>
              </View>
              <View style={s.heroStat}>
                <Text style={s.heroStatLabel}>Income pattern</Text>
                <Text style={s.heroStatValue}>{volatility > 50 ? 'Volatile' : volatility > 25 ? 'Variable' : 'Steady'}</Text>
              </View>
            </View>
          </Card>
        </Animated.View>

        <SectionHeader title="Suggested split" />
        <Card style={s.split}>
          <Donut segments={split.map((x) => ({ value: x.value, color: x.color }))} size={128} stroke={16}>
            <Text style={s.donutLabel}>50/30/20</Text>
          </Donut>
          <View style={s.flex}>
            {split.map((x) => (
              <View key={x.label} style={s.splitRow}>
                <View style={[s.dot, { backgroundColor: x.color }]} />
                <Text style={s.splitLabel}>{x.label} <Text style={s.splitPct}>{x.pct}%</Text></Text>
                <Text style={s.splitValue}>{formatCurrency(x.value)}</Text>
              </View>
            ))}
            <Text style={s.splitNote}>A common guide applied to this month's income, not your actual spending.</Text>
          </View>
        </Card>

        <SectionHeader title="By source" />
        <Card>
          {sources.map(([k, amt], i) => (
            <View key={k} style={[s.sourceRow, i > 0 && s.sourceGap]}>
              <View style={s.sourceTop}>
                <Text style={s.sourceName}>{SOURCE_LABELS[k] || k}</Text>
                <Text style={s.sourceAmt}>{formatCurrency(amt)}</Text>
              </View>
              <AnimatedBar progress={flow.total > 0 ? amt / flow.total : 0} color={sourceColor(k)} height={6} delay={i * 100} />
            </View>
          ))}
        </Card>

        <SectionHeader title="Receipts" />
        <Card padded={false} style={s.list}>
          {flow.timeline.map((item, i) => (
            <Pressable
              key={item.id}
              onPress={() => setSelected(item)}
              style={({ pressed }) => [s.row, i > 0 && s.divider, pressed && s.pressed]}
              accessibilityRole="button"
              accessibilityLabel={`${item.description || item.source}, ${formatCurrency(item.amount)}. Options`}
            >
              <View style={[s.sourceDot, { backgroundColor: sourceColor(item.source) }]}>
                <Text style={s.sourceEmoji}>{(SOURCE_LABELS[item.source] || '💰').split(' ')[0]}</Text>
              </View>
              <View style={s.flex}>
                <Text style={s.rowTitle} numberOfLines={1}>{item.description || SOURCE_LABELS[item.source]}</Text>
                <Text style={s.rowSub}>{new Date(item.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
              </View>
              <Text style={s.rowAmount}>+{formatCurrency(item.amount)}</Text>
            </Pressable>
          ))}
        </Card>
        {volatility > 25 && <Badge label="Variable income: FINAURA plans with your average month" tone="warning" style={s.note} />}
      </View>
    );
  };

  return (
    <View style={s.screen}>
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingTop: headerHeight, paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} progressViewOffset={headerHeight} onRefresh={() => fetchFlow(true)} />}
      >
        <LargeTitle
          title="Income"
          subtitle="Salary and everything else that comes in"
          right={
            <Pressable style={s.addBtn} onPress={() => openEditor(null)} accessibilityRole="button" accessibilityLabel="Add Income">
              <Ionicons name="add" size={22} color={c.onPrimary} />
            </Pressable>
          }
        />
        {body()}
      </Animated.ScrollView>
      <ScreenHeader title="Income" y={y} onBack={() => navigation.goBack()} />

      <Sheet
        visible={!!selected}
        onClose={() => setSelected(null)}
        onClosed={() => {
          if (editAfterClose.current) setEditorOpen(true);
          editAfterClose.current = false;
        }}
        title={selected ? selected.description || SOURCE_LABELS[selected.source] : ''}
      >
        <Text style={s.sheetSub}>{selected ? `${formatCurrency(selected.amount)} · ${new Date(selected.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : ''}</Text>
        <Pressable style={s.action} onPress={() => selected && openEditor(selected)} accessibilityRole="button">
          <Ionicons name="create-outline" size={20} color={c.text} />
          <Text style={s.actionText}>Edit income</Text>
        </Pressable>
        <Pressable style={s.action} onPress={() => selected && confirmDelete(selected)} accessibilityRole="button">
          <Ionicons name="trash-outline" size={20} color={c.dangerStrong} />
          <Text style={[s.actionText, { color: c.dangerStrong }]}>Delete income</Text>
        </Pressable>
      </Sheet>

      <IncomeEditor entry={editing} visible={editorOpen} onClose={() => setEditorOpen(false)} onSaved={() => fetchFlow(true)} />
    </View>
  );
}

const useSStyles = createStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.bg },
  flex: { flex: 1 },
  body: { paddingHorizontal: 16 },
  gap: { marginBottom: 12 },
  addBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: c.primary, marginBottom: 4 },
  heroLabel: { ...typeScale.caption, color: c.onAuroraMuted },
  heroValue: { ...typeScale.display, color: c.onAurora, marginTop: 2 },
  heroRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
  heroStat: { flex: 1, padding: 12, borderRadius: radius.md, backgroundColor: 'rgba(255,255,255,0.12)' },
  heroStatLabel: { fontSize: 11, color: c.onAuroraMuted },
  heroStatValue: { ...typeScale.headline, color: c.onAurora, marginTop: 2, ...tabular },
  split: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  donutLabel: { fontSize: 12, fontWeight: '800', color: c.textMuted },
  splitRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  splitLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: c.text },
  splitPct: { fontSize: 12, fontWeight: '500', color: c.textSubtle },
  splitValue: { fontSize: 14, fontWeight: '700', color: c.text, ...tabular },
  splitNote: { ...typeScale.caption, color: c.textSubtle, marginTop: 8 },
  sourceRow: { gap: 8 },
  sourceGap: { marginTop: 14 },
  sourceTop: { flexDirection: 'row', justifyContent: 'space-between' },
  sourceName: { fontSize: 14, fontWeight: '600', color: c.text },
  sourceAmt: { fontSize: 14, fontWeight: '700', color: c.text, ...tabular },
  list: { paddingHorizontal: 14, paddingVertical: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  pressed: { opacity: 0.6 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
  sourceDot: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', opacity: 0.9 },
  sourceEmoji: { fontSize: 18 },
  rowTitle: { fontSize: 15, fontWeight: '600', color: c.text },
  rowSub: { fontSize: 12, color: c.textMuted, marginTop: 2 },
  rowAmount: { fontSize: 15, fontWeight: '700', color: c.successStrong, ...tabular },
  note: { marginTop: 12 },
  sheetSub: { ...typeScale.body, color: c.textMuted, marginBottom: 8 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, borderTopWidth: 1, borderTopColor: c.border },
  actionText: { fontSize: 16, fontWeight: '600', color: c.text },
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
  label: { fontSize: 13, fontWeight: '600', color: c.textMuted, marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  error: { fontSize: 13, color: c.danger, textAlign: 'center', marginTop: 6 },
  save: { marginTop: 16 },
}));
