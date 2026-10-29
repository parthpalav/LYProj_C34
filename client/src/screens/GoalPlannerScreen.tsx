import React, { useCallback, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getGoals, createGoal, deleteGoal, updateGoal } from '../services/api';
import { useStore } from '../store/useStore';
import { celebrate, toast } from '../store/useCelebrationStore';
import { Goal } from '../types';
import { formatCurrency } from '../utils/format';
import { goalPlan, goalProgress, milestoneCrossed, parseTargetDate } from '../utils/goalProgress';
import { enterUp, exitFade, listLayout } from '../motion';
import { createStyles, radius, tabular, typeScale, useTheme } from '../theme';
import { AnimatedBar } from '../components/motion/AnimatedBar';
import { PiggyBank } from '../components/motion/PiggyBank';
import { SkeletonCard } from '../components/motion/Skeleton';
import { useShake } from '../components/motion/useShake';
import { Card } from '../components/ui/Card';
import { Badge, Chip, EmptyState, ErrorState, MoneyText, SectionHeader } from '../components/ui/Bits';
import { Button } from '../components/ui/Button';
import { Field } from '../components/ui/Field';
import { DateField } from '../components/ui/DateField';
import { Sheet } from '../components/ui/Sheet';
import { LargeTitle, ScreenHeader, useHeaderHeight, useScrollHeader } from '../components/ui/ScreenHeader';

const EMOJIS = ['🏠', '🚗', '✈️', '🎓', '🎯', '💍', '🌴', '💰', '💻', '🎁'];
const MILESTONE_COPY = { 0.25: 'A quarter of the way', 0.5: 'Halfway there', 0.75: 'Three quarters done' } as const;

/** Create or edit a goal in a page sheet. */
function GoalEditor({ goal, visible, onClose, onSaved }: { goal: Goal | null; visible: boolean; onClose: () => void; onSaved: () => void }) {
  const s = useSStyles();
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('🎯');
  const [target, setTarget] = useState('');
  const [date, setDate] = useState<Date | null>(null);
  const [contribution, setContribution] = useState('');
  const [error, setError] = useState('');

  // Load the goal (or blanks) every time the sheet opens.
  const [openedFor, setOpenedFor] = useState<string | null | undefined>(undefined);
  const key = visible ? goal?.id ?? null : undefined;
  if (key !== openedFor) {
    setOpenedFor(key);
    if (visible) {
      setName(goal?.name ?? '');
      setEmoji(goal?.emoji ?? '🎯');
      setTarget(goal ? String(goal.targetAmount) : '');
      setDate(parseTargetDate(goal?.targetDate));
      setContribution(goal?.monthlyContribution ? String(goal.monthlyContribution) : '');
      setError('');
    }
  }

  const save = async () => {
    const amount = Number(target);
    if (!name.trim()) return setError('Give your goal a name.');
    if (!Number.isFinite(amount) || amount <= 0) return setError('Enter a target amount greater than zero.');
    const payload = {
      name: name.trim(),
      emoji,
      targetAmount: amount,
      targetDate: date ? date.toISOString().slice(0, 10) : '',
      monthlyContribution: Number(contribution) || 0,
    };
    try {
      if (goal) await updateGoal(goal.id, payload);
      else await createGoal(payload);
      onClose();
      onSaved();
      toast(goal ? 'Goal updated' : `${emoji} ${payload.name} goal created`, { subtitle: goal ? undefined : `Target ${formatCurrency(amount)}. Add money whenever you can.` });
    } catch {
      setError("Couldn't save. Check your connection and try again.");
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={s.sheet} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={s.sheetHeader}>
          <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button"><Text style={s.sheetCancel}>Cancel</Text></Pressable>
          <Text style={s.sheetTitle}>{goal ? 'Edit goal' : 'New goal'}</Text>
          <View style={s.sheetSpacer} />
        </View>
        <ScrollView contentContainerStyle={s.sheetBody} keyboardShouldPersistTaps="handled">
          <View style={s.emojiRow}>
            {EMOJIS.map((e) => (
              <Pressable key={e} onPress={() => setEmoji(e)} style={[s.emojiBtn, emoji === e && s.emojiBtnOn]} accessibilityRole="button" accessibilityState={{ selected: emoji === e }}>
                <Text style={s.emojiTxt}>{e}</Text>
              </Pressable>
            ))}
          </View>
          <Field label="Goal name" icon="flag-outline" value={name} onChangeText={(v) => { setName(v); setError(''); }} placeholder="e.g. House down payment" />
          <Field label="Target amount (₹)" icon="cash-outline" value={target} onChangeText={(v) => { setTarget(v); setError(''); }} keyboardType="numeric" placeholder="250000" />
          <DateField label="Target date" value={date} onChange={setDate} minimumDate={new Date()} placeholder="When do you need it?" />
          <Field label="Monthly contribution (₹)" icon="repeat-outline" value={contribution} onChangeText={setContribution} keyboardType="numeric" placeholder="Optional" hint="What you plan to put in each month. FINAURA checks if it's enough." />
          {!!error && <Text style={s.error} accessibilityRole="alert">{error}</Text>}
          <Button label={goal ? 'Save goal' : 'Create goal'} onPress={save} style={s.save} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** Add to, or take money out of, a goal. */
function FundSheet({ goal, onClose, onSaved }: { goal: Goal | null; onClose: () => void; onSaved: () => void }) {
  const s = useSStyles();
  const { c, isDark } = useTheme();
  const [amount, setAmount] = useState('');
  const [withdraw, setWithdraw] = useState(false);
  const [error, setError] = useState('');
  const { style: shakeStyle, shake } = useShake();

  const save = async () => {
    if (!goal) return;
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      shake();
      return setError('Enter an amount greater than zero.');
    }
    if (withdraw && value > goal.savedAmount) {
      shake();
      return setError(`You can take out up to ${formatCurrency(goal.savedAmount)}.`);
    }
    const change = withdraw ? -value : value;
    const p = goalProgress(goal.savedAmount, change, goal.targetAmount);
    try {
      // shortcut: read-modify-write, can lose a concurrent contribution; switch to a $inc endpoint if multi-device use matters
      await updateGoal(goal.id, { savedAmount: p.newSaved });
      setAmount('');
      setError('');
      onClose();
      onSaved();
      if (withdraw) {
        toast(`${formatCurrency(value)} taken out`, { tone: 'info', subtitle: `${goal.name} now has ${formatCurrency(p.newSaved)}.` });
      } else if (p.completed) {
        celebrate({ kind: 'trophy', title: `${goal.name} goal reached!`, subtitle: `You saved ${formatCurrency(p.newSaved)} of ${formatCurrency(goal.targetAmount)}.` });
      } else {
        const milestone = milestoneCrossed(p.from, p.to);
        celebrate({
          kind: 'piggy', from: p.from, to: p.to,
          title: milestone ? `${MILESTONE_COPY[milestone]}!` : `${formatCurrency(value)} saved`,
          subtitle: `${formatCurrency(Math.max(0, goal.targetAmount - p.newSaved))} to go for ${goal.name}.`,
        });
      }
    } catch {
      shake();
      setError("Couldn't save. Check your connection and try again.");
    }
  };

  return (
    <Sheet visible={!!goal} onClose={onClose} title={goal ? `${goal.emoji} ${goal.name}` : ''}>
      <View style={s.typeRow}>
        <Chip label="Add money" icon="add-circle-outline" selected={!withdraw} onPress={() => { setWithdraw(false); setError(''); }} style={s.flex} />
        <Chip label="Withdraw" icon="remove-circle-outline" selected={withdraw} onPress={() => { setWithdraw(true); setError(''); }} style={s.flex} />
      </View>
      <Animated.View style={[s.amountBox, shakeStyle]}>
        <Text style={s.amountPrefix}>₹</Text>
        <TextInput
          style={s.amountInput}
          value={amount}
          onChangeText={(v) => { setAmount(v.replace(/[^0-9.]/g, '')); setError(''); }}
          placeholder="0"
          placeholderTextColor={c.textSubtle}
          keyboardType="decimal-pad"
          keyboardAppearance={isDark ? 'dark' : 'light'}
          autoFocus
          accessibilityLabel="Amount"
        />
      </Animated.View>
      {!withdraw && (
        <View style={s.quickRow}>
          {[500, 1000, 5000].map((v) => <Chip key={v} label={`+${formatCurrency(v)}`} onPress={() => setAmount(String((Number(amount) || 0) + v))} style={s.flex} />)}
        </View>
      )}
      {!!error && <Text style={s.error} accessibilityRole="alert">{error}</Text>}
      <Button label={withdraw ? 'Take out' : 'Put into savings'} variant={withdraw ? 'secondary' : 'primary'} onPress={save} style={s.save} />
    </Sheet>
  );
}

export function GoalPlannerScreen(): React.ReactElement {
  const { c } = useTheme();
  const s = useSStyles();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { y, onScroll } = useScrollHeader();
  const goals = useStore((st) => st.goals);
  const setGoals = useStore((st) => st.setGoals);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);
  const [funding, setFunding] = useState<Goal | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchGoals = useCallback(async () => {
    try {
      setGoals(await getGoals());
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [setGoals]);

  useFocusEffect(useCallback(() => { fetchGoals(); }, [fetchGoals]));

  const openEditor = (goal: Goal | null) => {
    setEditing(goal);
    setEditorOpen(true);
  };

  const handleDelete = (goal: Goal) => {
    Alert.alert(`Delete ${goal.name}?`, `${formatCurrency(goal.savedAmount)} saved so far will no longer be tracked as a goal.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteGoal(goal.id);
            fetchGoals();
            toast('Goal deleted', { tone: 'info', subtitle: goal.name });
          } catch {
            toast("Couldn't delete that goal", { tone: 'error' });
          }
        },
      },
    ]);
  };

  const totalSaved = goals.reduce((sum, g) => sum + (g.savedAmount || 0), 0);
  const totalTarget = goals.reduce((sum, g) => sum + (g.targetAmount || 0), 0);
  const overall = totalTarget > 0 ? totalSaved / totalTarget : 0;

  const body = () => {
    if (loading && goals.length === 0) return <View style={s.body}>{[0, 1].map((i) => <SkeletonCard key={i} style={s.gap} />)}</View>;
    if (loadFailed && goals.length === 0) return <ErrorState onRetry={fetchGoals} />;
    if (goals.length === 0) {
      return <EmptyState emoji="🐷" title="Create your first goal" message="A trip, a laptop, a home. Give it a target and FINAURA shows what to save each month." actionLabel="New goal" onAction={() => openEditor(null)} />;
    }
    return (
      <View style={s.body}>
        <Animated.View entering={enterUp(0)}>
          <Card variant="hero" style={s.hero}>
            <PiggyBank progress={overall} size={92} />
            <View style={s.flex}>
              <Text style={s.heroLabel}>Saved across {goals.length} goal{goals.length === 1 ? '' : 's'}</Text>
              <MoneyText value={totalSaved} style={s.heroValue} />
              <Text style={s.heroSub}>of {formatCurrency(totalTarget)} · {Math.round(overall * 100)}%</Text>
            </View>
          </Card>
        </Animated.View>

        <SectionHeader title="Your goals" action="New goal" onAction={() => openEditor(null)} />
        {goals.map((g, i) => {
          const pct = g.targetAmount > 0 ? Math.min(1, g.savedAmount / g.targetAmount) : 0;
          const plan = goalPlan(g.savedAmount, g.targetAmount, g.targetDate, g.monthlyContribution);
          const done = pct >= 1;
          const date = parseTargetDate(g.targetDate);
          return (
            <Animated.View key={g.id} entering={enterUp(i + 1)} exiting={exitFade} layout={listLayout}>
              <Card style={s.gap}>
                <View style={s.goalTop}>
                  <View style={s.goalEmoji}><Animated.Text sharedTransitionTag={`goal-${g.id}`} style={s.goalEmojiTxt}>{g.emoji || '🎯'}</Animated.Text></View>
                  <View style={s.flex}>
                    <Text style={s.goalName} numberOfLines={1}>{g.name}</Text>
                    <Text style={s.goalSub}>{date ? `By ${date.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}` : 'No target date'}</Text>
                  </View>
                  <Pressable onPress={() => openEditor(g)} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Edit ${g.name}`}>
                    <Ionicons name="create-outline" size={20} color={c.textSubtle} />
                  </Pressable>
                </View>

                <View style={s.amountRow}>
                  <Text style={s.saved}>{formatCurrency(g.savedAmount)}</Text>
                  <Text style={s.target}>of {formatCurrency(g.targetAmount)}</Text>
                </View>
                <AnimatedBar progress={pct} color={done ? c.success : c.primary} height={10} delay={i * 120} />

                <View style={s.statusRow}>
                  {done ? (
                    <Badge label="Goal reached 🎉" tone="success" />
                  ) : plan.months === null ? (
                    <Badge label="Add a target date to get a plan" />
                  ) : plan.gap !== null && plan.gap >= 0 ? (
                    <Badge label={`On track · ${formatCurrency(Math.ceil(plan.requiredMonthly ?? 0))}/mo needed`} tone="success" />
                  ) : (
                    <Badge label={`Behind by ${formatCurrency(Math.ceil(Math.abs(plan.gap ?? 0)))}/mo`} tone="warning" />
                  )}
                  {!done && plan.months !== null && <Text style={s.months}>{plan.months} mo left</Text>}
                </View>

                <View style={s.actions}>
                  <Button label="Add money" icon="add" size="sm" onPress={() => setFunding(g)} style={s.flex} />
                  <Button label="Delete" icon="trash-outline" size="sm" variant="ghost" onPress={() => handleDelete(g)} accessibilityLabel={`Delete ${g.name}`} />
                </View>
              </Card>
            </Animated.View>
          );
        })}
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
        refreshControl={<RefreshControl refreshing={refreshing} progressViewOffset={headerHeight} onRefresh={() => { setRefreshing(true); fetchGoals(); }} />}
      >
        <LargeTitle
          title="Goals"
          subtitle="Save for what matters, month by month"
          right={
            <Pressable style={s.addBtn} onPress={() => openEditor(null)} accessibilityRole="button" accessibilityLabel="New goal">
              <Ionicons name="add" size={22} color={c.onPrimary} />
            </Pressable>
          }
        />
        {body()}
      </Animated.ScrollView>
      <ScreenHeader title="Goals" y={y} onBack={() => navigation.goBack()} />
      <GoalEditor goal={editing} visible={editorOpen} onClose={() => setEditorOpen(false)} onSaved={fetchGoals} />
      <FundSheet goal={funding} onClose={() => setFunding(null)} onSaved={fetchGoals} />
    </View>
  );
}

const useSStyles = createStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.bg },
  flex: { flex: 1 },
  body: { paddingHorizontal: 16 },
  gap: { marginBottom: 12 },
  addBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: c.primary, marginBottom: 4 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  heroLabel: { ...typeScale.caption, color: c.onAuroraMuted },
  heroValue: { ...typeScale.title, fontSize: 28, color: c.onAurora, marginTop: 2 },
  heroSub: { ...typeScale.caption, color: c.onAuroraMuted, marginTop: 2 },
  goalTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  goalEmoji: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: c.primarySoft },
  goalEmojiTxt: { fontSize: 22 },
  goalName: { fontSize: 16, fontWeight: '700', color: c.text },
  goalSub: { fontSize: 12, color: c.textMuted, marginTop: 2 },
  amountRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 14, marginBottom: 8 },
  saved: { ...typeScale.title, color: c.text, ...tabular },
  target: { fontSize: 13, color: c.textMuted, ...tabular },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  months: { fontSize: 12, color: c.textSubtle },
  actions: { flexDirection: 'row', gap: 8, marginTop: 14 },
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
  emojiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  emojiBtn: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surface, borderWidth: 1.5, borderColor: c.border },
  emojiBtnOn: { borderColor: c.primary, backgroundColor: c.primarySoft },
  emojiTxt: { fontSize: 24 },
  typeRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  amountBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 72,
    borderRadius: radius.lg,
    backgroundColor: c.bg,
    borderWidth: 1.5,
    borderColor: c.border,
  },
  amountPrefix: { fontSize: 28, fontWeight: '700', color: c.textSubtle, marginRight: 4 },
  amountInput: { minWidth: 60, fontSize: 38, fontWeight: '800', color: c.text, ...tabular },
  quickRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  error: { fontSize: 13, color: c.danger, textAlign: 'center', marginTop: 10 },
  save: { marginTop: 16 },
}));
