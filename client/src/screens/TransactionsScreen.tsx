import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, SectionList, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated from 'react-native-reanimated';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { useFocusEffect } from '@react-navigation/native';
import { createLiability, deleteTransaction, getSubscriptionSuggestions, getTransactions, updateTransaction } from '../services/api';
import { useStore } from '../store/useStore';
import { toast } from '../store/useCelebrationStore';
import { Palette, createStyles, radius, tabular, typeScale, useTheme } from '../theme';
import { SubscriptionSuggestion, Transaction } from '../types';
import { formatCurrency } from '../utils/format';
import { enterUp, exitFade, listLayout } from '../motion';
import { useTabBarSpace } from '../components/navigation/TabBar';
import { LargeTitle, ScreenHeader, useHeaderHeight, useScrollHeader } from '../components/ui/ScreenHeader';
import { Card } from '../components/ui/Card';
import { Badge, Chip, EmptyState, ErrorState, IconTile, MoneyText } from '../components/ui/Bits';
import { Button } from '../components/ui/Button';
import { Field } from '../components/ui/Field';
import { Sheet } from '../components/ui/Sheet';
import { SkeletonCard } from '../components/motion/Skeleton';

// ── Category definitions ───────────────────────────────────────────────────
export const LEGACY_CATEGORY_MAP: Record<string, string> = {
  food: 'Food & Dining',
  travel: 'Transport & Travel',
  bills: 'Utilities & Bills',
  party: 'Entertainment',
};

const CATEGORIES = [
  { key: 'food & dining',        label: 'Food & Dining',        emoji: '🍽️' },
  { key: 'groceries',            label: 'Groceries',            emoji: '🛒' },
  { key: 'transport & travel',   label: 'Transport & Travel',   emoji: '🚕' },
  { key: 'housing',              label: 'Housing',              emoji: '🏠' },
  { key: 'utilities & bills',    label: 'Utilities & Bills',    emoji: '💡' },
  { key: 'debt & loan payments', label: 'Debt & Loan Payments', emoji: '💳' },
  { key: 'shopping',             label: 'Shopping',             emoji: '🛍️' },
  { key: 'entertainment',        label: 'Entertainment',        emoji: '🎬' },
  { key: 'health',               label: 'Health',               emoji: '🏥' },
  { key: 'education',            label: 'Education',            emoji: '🎓' },
  { key: 'personal care',        label: 'Personal Care',        emoji: '✂️' },
  { key: 'insurance',            label: 'Insurance',            emoji: '🛡️' },
  { key: 'investments',          label: 'Investments',          emoji: '📈' },
  { key: 'misc',                 label: 'Misc',                 emoji: '📦' },
];

// ── Category emoji map (case-insensitive — compare via .toLowerCase()) ─────
const CATEGORY_EMOJI: Record<string, string> = {
  'food & dining': '🍽️',
  groceries: '🛒',
  'transport & travel': '🚕',
  housing: '🏠',
  'utilities & bills': '💡',
  'debt & loan payments': '💳',
  shopping: '🛍️',
  entertainment: '🎬',
  health: '🏥',
  education: '🎓',
  'personal care': '✂️',
  insurance: '🛡️',
  investments: '📈',
  misc: '📦',

  // Legacy mappings for backward compatibility
  food: '🍽️',
  travel: '🚕',
  bills: '💡',
  party: '🎬',
};

// ── Need / Want / Investment badge colours (singular type, distinct from the Investments category) ──
const TYPE_BADGE = (c: Palette): Record<string, { color: string; label: string }> => ({
  Need: { color: c.info, label: 'Need' },
  Want: { color: c.warningStrong, label: 'Want' },
  Investment: { color: c.successStrong, label: 'Investment' },
});

// ── High-level type filters ───────────────────────────────────────────────
const TYPE_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'Need', label: 'Needs' },
  { key: 'Want', label: 'Wants' },
  { key: 'Investment', label: 'Investments' },
] as const;

// ── Grouping helpers ──────────────────────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, '0');

/** Returns a sort key like "2026-08" (newest = lexicographically largest). */
function monthKey(ts: string): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
}

/** Local-calendar day key like "2026-10-26". */
function dayKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function dayLabel(key: string): string {
  const today = new Date();
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  if (key === dayKey(today)) return 'Today';
  if (key === dayKey(yesterday)) return 'Yesterday';
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short', ...(y !== today.getFullYear() ? { year: 'numeric' } : {}),
  });
}

interface DaySection {
  title: string;
  key: string;
  totalAmount: number;
  data: Transaction[];
}

/** Groups transactions into day sections, newest first. */
function groupByDay(txs: Transaction[]): DaySection[] {
  const map = new Map<string, Transaction[]>();
  for (const tx of txs) {
    const key = dayKey(new Date(tx.timestamp));
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(tx);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, data]) => ({
      title: dayLabel(key),
      key,
      totalAmount: data.reduce((sum, tx) => sum + Math.abs(tx.amount), 0),
      data: [...data].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
    }));
}

const timeOf = (ts: string) => new Date(ts).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });

const AnimatedSectionList = Animated.createAnimatedComponent(SectionList<Transaction, DaySection>);

// ── Row ────────────────────────────────────────────────────────────────────

function TxRow({ item, index, onEdit, onDelete, onOptions }: {
  item: Transaction; index: number;
  onEdit: (tx: Transaction) => void; onDelete: (tx: Transaction) => void; onOptions: (tx: Transaction) => void;
}) {
  const styles = useStyles();
  const { c } = useTheme();
  const displayAmount = `-${formatCurrency(Math.abs(item.amount))}`;
  // Category emoji — lowercase lookup handles canonical ("Food") & legacy ("food")
  const icon = CATEGORY_EMOJI[(item.category || '').toLowerCase()] ?? '📦';
  // Need / Want / Investment badge — read directly from backend value
  const typeBadge = item.type ? TYPE_BADGE(c)[item.type] : null;
  const category = LEGACY_CATEGORY_MAP[(item.category || '').toLowerCase()] || item.category || '—';

  const action = (kind: 'edit' | 'delete') => (_p: unknown, _t: unknown, methods: { close: () => void }) => (
    <Pressable
      onPress={() => { methods.close(); (kind === 'edit' ? onEdit : onDelete)(item); }}
      style={[styles.swipeAction, kind === 'edit' ? styles.swipeEdit : styles.swipeDelete]}
      accessibilityRole="button"
      accessibilityLabel={kind === 'edit' ? 'Edit transaction' : 'Delete transaction'}
    >
      <Ionicons name={kind === 'edit' ? 'create-outline' : 'trash-outline'} size={20} color="#FFFFFF" />
      <Text style={styles.swipeText}>{kind === 'edit' ? 'Edit' : 'Delete'}</Text>
    </Pressable>
  );

  return (
    <Animated.View entering={enterUp(index, 30)} exiting={exitFade} layout={listLayout} style={styles.rowWrap}>
      <ReanimatedSwipeable
        friction={1.6}
        leftThreshold={48}
        rightThreshold={48}
        overshootLeft={false}
        overshootRight={false}
        renderLeftActions={action('edit')}
        renderRightActions={action('delete')}
        containerStyle={styles.swipeContainer}
      >
        <Pressable
          style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
          onPress={() => onOptions(item)}
          onLongPress={() => onOptions(item)}
          accessibilityRole="button"
          accessibilityLabel={`${item.description || item.category}, ${displayAmount}, ${category}`}
          accessibilityHint="Swipe left to delete, right to edit, or tap for options"
        >
          <IconTile emoji={icon} tint={typeBadge?.color} size={44} />

          <View style={styles.details}>
            <Text style={styles.desc} numberOfLines={1}>{item.description || item.category}</Text>
            <View style={styles.metaRow}>
              <Text style={styles.categoryLabel} numberOfLines={1}>{category}</Text>
              {typeBadge && (
                <>
                  <Text style={styles.metaDot}>·</Text>
                  <Text style={[styles.typeInline, { color: typeBadge.color }]}>{typeBadge.label}</Text>
                </>
              )}
              <Text style={styles.metaDot}>·</Text>
              <Text style={styles.dateText}>{timeOf(item.timestamp)}</Text>
            </View>
            {(item.needsReview || (item.tags && item.tags.length > 0)) && (
              <View style={styles.tagsRow}>
                {item.needsReview && <Badge label="Check category" tone="warning" />}
                {item.tags?.slice(0, 2).map((t) => <Badge key={t} label={t.toUpperCase()} />)}
              </View>
            )}
          </View>

          <View style={styles.rightCol}>
            <Text style={styles.amount}>{displayAmount}</Text>
            <Pressable onPress={() => onOptions(item)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Transaction options">
              <Ionicons name="ellipsis-horizontal" size={16} color={c.textSubtle} />
            </Pressable>
          </View>
        </Pressable>
      </ReanimatedSwipeable>
    </Animated.View>
  );
}

// ── Screen component ───────────────────────────────────────────────────────

export function TransactionsScreen(): React.ReactElement {
  const { c } = useTheme();
  const styles = useStyles();
  const tabBarSpace = useTabBarSpace();
  const headerHeight = useHeaderHeight();
  const { y, onScroll } = useScrollHeader({ hidesTabBar: true });
  const transactions = useStore((s) => s.transactions);
  const setTransactions = useStore((s) => s.setTransactions);

  const [activeType, setActiveType] = useState<string>('all');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [reviewOnly, setReviewOnly] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [editTx, setEditTx] = useState<Transaction | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editType, setEditType] = useState<'Need' | 'Want' | 'Investment'>('Need');
  const [editError, setEditError] = useState('');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [overflowTx, setOverflowTx] = useState<Transaction | null>(null);
  const [suggestions, setSuggestions] = useState<SubscriptionSuggestion[]>([]);
  // Deletes wait out the Undo window before reaching the server.
  const pendingDeletes = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  // ── Data fetching ──────────────────────────────────────────────────────
  const fetchTransactions = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      const data = await getTransactions();
      setTransactions(data.filter((t) => !pendingDeletes.current.has(t.id)));
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
    } finally {
      setLoaded(true);
      setRefreshing(false);
    }
    getSubscriptionSuggestions().then(setSuggestions).catch(() => {});
  }, [setTransactions]);

  // Refetch on every focus: QuickAdd is a sheet over this screen, so closing it refocuses here.
  useFocusEffect(useCallback(() => { fetchTransactions(); }, [fetchTransactions]));

  // ── Monthly summary (current month) ────────────────────────────────────
  const monthlySummary = useMemo(() => {
    const cmk = currentMonthKey();
    const thisMonth = transactions.filter((tx) => monthKey(tx.timestamp) === cmk);
    // Spent = Need + Want amounts (exclude Investment)
    const spent = thisMonth
      .filter((tx) => tx.type !== 'Investment')
      .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
    // Invested = Investment amounts
    const invested = thisMonth
      .filter((tx) => tx.type === 'Investment')
      .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
    return { spent, invested };
  }, [transactions]);

  const reviewCount = useMemo(() => transactions.filter((t) => t.needsReview).length, [transactions]);

  // ── Edit / Delete handlers ─────────────────────────────────────────────
  const restore = (tx: Transaction) => setTransactions([...useStore.getState().transactions, tx]);

  const deleteWithUndo = (tx: Transaction) => {
    setTransactions(useStore.getState().transactions.filter((t) => t.id !== tx.id));
    const timer = setTimeout(async () => {
      pendingDeletes.current.delete(tx.id);
      try {
        await deleteTransaction(tx.id);
      } catch {
        restore(tx);
        toast("Couldn't delete that transaction", { tone: 'error', subtitle: 'It has been put back.' });
      }
    }, 4700);
    pendingDeletes.current.set(tx.id, timer);
    toast('Transaction deleted', {
      tone: 'info',
      subtitle: `${tx.description || tx.category} · ${formatCurrency(Math.abs(tx.amount))}`,
      action: { label: 'Undo', onPress: () => { clearTimeout(timer); pendingDeletes.current.delete(tx.id); restore(tx); } },
    });
  };

  const handleDelete = (tx: Transaction) => {
    setOverflowTx(null);
    // A scheduled liability payment has side effects that undo can't rewind, so confirm it explicitly.
    if (tx.liabilityId && tx.scheduledFor) {
      Alert.alert(
        'Delete scheduled payment?',
        `${tx.description || 'This payment'} (${formatCurrency(Math.abs(tx.amount))}) satisfied a scheduled bill. Deleting it will not move the bill's next auto-deduct date back.`,
        [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => deleteWithUndo(tx) }],
      );
      return;
    }
    deleteWithUndo(tx);
  };

  const handleEdit = (tx: Transaction) => {
    const open = () => {
      setEditError('');
      setEditTx(tx);
      setEditAmount(String(Math.abs(tx.amount)));
      setEditDesc(tx.description || '');
      setEditCategory(CATEGORIES.find(c => c.label.toLowerCase() === (tx.category || '').toLowerCase())?.label ?? tx.category);
      setEditType(tx.type ?? 'Need');
    };
    // The options sheet turns into the editor in place: iOS can't present a second sheet while one is open.
    setOverflowTx(null);
    open();
  };

  const submitEdit = async () => {
    if (!editTx) return;
    const parsedAmt = parseFloat(editAmount);
    if (isNaN(parsedAmt) || parsedAmt <= 0) {
      setEditError('Enter an amount greater than zero.');
      return;
    }
    try {
      // Only send a changed label: the server treats it as a user correction and remembers the merchant
      const categoryChanged = editCategory.toLowerCase() !== (editTx.category || '').toLowerCase();
      const typeChanged = editType !== editTx.type;
      await updateTransaction(editTx.id, {
        amount: parsedAmt,
        description: editDesc,
        ...(categoryChanged || typeChanged ? { category: editCategory, type: editType } : {}),
      });
      setEditTx(null);
      toast(categoryChanged || typeChanged ? 'Updated. FINAURA will remember this merchant.' : 'Transaction updated');
      fetchTransactions();
    } catch {
      setEditError("Couldn't save. Check your connection and try again.");
    }
  };

  const trackSuggestion = async (s: SubscriptionSuggestion) => {
    const next = new Date(s.nextExpected);
    try {
      await createLiability({
        name: s.name, amount: s.amount, category: s.category, type: s.type, frequency: s.frequency,
        startDate: next.toISOString(), autoDeduct: false,
        ...(s.frequency === 'monthly' ? { dayOfMonth: next.getDate() } : { dayOfWeek: next.getDay() }),
      });
      setSuggestions((list) => list.filter((x) => x.key !== s.key));
      toast(`Tracking ${s.name} as a ${s.frequency} bill`, { subtitle: 'Find it under Plan › Bills.' });
    } catch {
      toast("Couldn't add that bill", { tone: 'error' });
    }
  };

  // ── Filtering: type + multi-category compose (AND between type & categories; OR within categories) ──
  const hasActiveFilters = selectedCategories.length > 0;

  const sections = useMemo<DaySection[]>(() => {
    let filtered = transactions;

    // Type filter
    if (activeType !== 'all') {
      filtered = filtered.filter((tx) => tx.type === activeType);
    }

    // Category filter: transaction category must match ANY of the selected categories (including legacy aliases)
    if (selectedCategories.length > 0) {
      filtered = filtered.filter((tx) => {
        const raw = (tx.category || '').toLowerCase();
        const normalized = (LEGACY_CATEGORY_MAP[raw] || tx.category || '').toLowerCase();
        return selectedCategories.includes(raw) || selectedCategories.includes(normalized);
      });
    }

    if (reviewOnly) filtered = filtered.filter((tx) => tx.needsReview);

    const q = query.trim().toLowerCase();
    if (q) filtered = filtered.filter((tx) => `${tx.description} ${tx.category}`.toLowerCase().includes(q));

    return groupByDay(filtered);
  }, [activeType, selectedCategories, transactions, reviewOnly, query]);

  // ── Helper: descriptive empty message ──────────────────────────────────
  const emptyMessage = useMemo(() => {
    if (transactions.length === 0) {
      return 'Your transactions will appear here.';
    }
    if (query.trim()) return `Nothing matches "${query.trim()}".`;
    const typeLabel = TYPE_FILTERS.find((f) => f.key === activeType)?.label ?? '';
    const hasType = activeType !== 'all';
    const hasCat = selectedCategories.length > 0;

    if (hasCat && hasType) {
      if (selectedCategories.length === 1) {
        const catLabel = CATEGORIES.find((c) => c.key === selectedCategories[0])?.label ?? selectedCategories[0];
        return `No ${typeLabel.toLowerCase()} ${catLabel} transactions found.`;
      }
      return `No ${typeLabel.toLowerCase()} transactions found in selected categories.`;
    }
    if (hasCat) {
      if (selectedCategories.length === 1) {
        const catLabel = CATEGORIES.find((c) => c.key === selectedCategories[0])?.label ?? selectedCategories[0];
        return `No ${catLabel} transactions found.`;
      }
      return 'No transactions found in selected categories.';
    }
    if (hasType) {
      return `No ${typeLabel.toLowerCase()} transactions yet.`;
    }
    return 'No transactions match these filters.';
  }, [transactions.length, activeType, selectedCategories, query]);

  // ── Category toggling and clearing ─────────────────────────────────────
  const toggleCategory = (key: string) => {
    setSelectedCategories((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const clearFilters = () => {
    setSelectedCategories([]);
    setShowFilterModal(false);
  };

  const suggestion = suggestions[0];

  const header = (
    <View>
      <LargeTitle
        title="Activity"
        right={
          <Pressable
            style={[styles.filterBtn, hasActiveFilters && styles.filterBtnActive]}
            onPress={() => setShowFilterModal(true)}
            accessibilityRole="button"
            accessibilityLabel="Open advanced filters"
          >
            <Ionicons name="options-outline" size={20} color={hasActiveFilters ? c.onPrimary : c.text} />
            {hasActiveFilters && <Text style={styles.filterCount}>{selectedCategories.length}</Text>}
          </Pressable>
        }
      />

      <View style={styles.body}>
        {/* Monthly summary */}
        <Card variant="hero" style={styles.summary}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Spent This Month</Text>
            <MoneyText value={monthlySummary.spent} style={styles.summaryValue} />
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Invested This Month</Text>
            <MoneyText value={monthlySummary.invested} style={styles.summaryValue} />
          </View>
        </Card>

        {/* Search */}
        <View style={styles.search}>
          <Ionicons name="search" size={18} color={c.textSubtle} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search merchants or categories"
            placeholderTextColor={c.textSubtle}
            style={styles.searchInput}
            returnKeyType="search"
            clearButtonMode="while-editing"
            accessibilityLabel="Search transactions"
          />
        </View>

        {/* Type filters */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {TYPE_FILTERS.map((f) => (
            <Chip key={f.key} label={f.label} selected={activeType === f.key} onPress={() => setActiveType(f.key)} />
          ))}
          {reviewCount > 0 && (
            <Chip label={`Check AI (${reviewCount})`} icon="sparkles" selected={reviewOnly} onPress={() => setReviewOnly((v) => !v)} />
          )}
        </ScrollView>

        {/* Active filter indicator */}
        {hasActiveFilters && (
          <View style={styles.activeFilterBar}>
            <Text style={styles.activeFilterText} numberOfLines={1}>
              {selectedCategories.length === 1
                ? `Category: ${CATEGORIES.find((c) => c.key === selectedCategories[0])?.label ?? selectedCategories[0]}`
                : `Categories (${selectedCategories.length}): ${selectedCategories
                    .map((k) => CATEGORIES.find((c) => c.key === k)?.label ?? k)
                    .join(', ')}`}
            </Text>
            <Pressable onPress={clearFilters} hitSlop={8} accessibilityRole="button" accessibilityLabel="Clear category filters">
              <Ionicons name="close-circle" size={18} color={c.textMuted} />
            </Pressable>
          </View>
        )}

        {/* Recurring charge suggestion */}
        {suggestion && (
          <Animated.View entering={enterUp(0)} exiting={exitFade}>
            <Card style={styles.suggestion}>
              <IconTile icon="repeat" tint={c.purple} />
              <View style={styles.flex}>
                <Text style={styles.suggestionKicker}>Looks like a subscription</Text>
                <Text style={styles.suggestionTitle} numberOfLines={1}>
                  {suggestion.name} · {formatCurrency(suggestion.amount)} / {suggestion.frequency === 'monthly' ? 'month' : 'week'}
                </Text>
                <View style={styles.suggestionActions}>
                  <Button label="Track as bill" size="sm" variant="secondary" onPress={() => trackSuggestion(suggestion)} />
                  <Button label="Not now" size="sm" variant="ghost" onPress={() => setSuggestions((l) => l.slice(1))} />
                </View>
              </View>
            </Card>
          </Animated.View>
        )}
      </View>
    </View>
  );

  const renderEmptyState = () => {
    if (!loaded) {
      return (
        <View style={styles.body}>
          {[0, 1, 2].map((i) => <SkeletonCard key={i} lines={1} style={styles.skeleton} />)}
        </View>
      );
    }
    if (loadFailed && transactions.length === 0) return <ErrorState onRetry={() => fetchTransactions()} />;
    return (
      <EmptyState
        emoji="🧾"
        title={transactions.length === 0 ? 'No transactions yet' : 'No results'}
        message={transactions.length === 0 ? `${emptyMessage} Tap + to log your first one.` : emptyMessage}
      />
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <AnimatedSectionList
        sections={sections}
        keyExtractor={(item: Transaction) => item.id}
        renderItem={({ item, index }) => (
          <TxRow item={item} index={index} onEdit={handleEdit} onDelete={handleDelete} onOptions={setOverflowTx} />
        )}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.sectionTotal}>{formatCurrency(section.totalAmount)}</Text>
          </View>
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={renderEmptyState}
        stickySectionHeadersEnabled
        onScroll={onScroll}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingTop: headerHeight, paddingBottom: tabBarSpace }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => fetchTransactions(true)} tintColor={c.primary} progressViewOffset={headerHeight} />
        }
      />
      <ScreenHeader title="Activity" y={y} />

      {/* Row sheet: options first; Edit swaps in the editor without presenting a second modal */}
      <Sheet
        visible={!!(overflowTx || editTx)}
        onClose={() => { setOverflowTx(null); setEditTx(null); }}
        title={editTx ? 'Edit Transaction' : overflowTx?.description || overflowTx?.category || 'Transaction'}
      >
        {editTx ? (
          <Animated.View key="edit" entering={enterUp(0)}>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Field label="Amount" icon="cash-outline" value={editAmount} onChangeText={(v) => { setEditAmount(v); setEditError(''); }} keyboardType="decimal-pad" error={editError} />
              <Field label="Description" icon="create-outline" value={editDesc} onChangeText={setEditDesc} />

              <Text style={styles.filterSectionLabel}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} keyboardShouldPersistTaps="handled">
                {CATEGORIES.map((cat) => (
                  <Chip key={cat.key} label={`${cat.emoji} ${cat.label}`} selected={editCategory === cat.label} onPress={() => setEditCategory(cat.label)} />
                ))}
              </ScrollView>

              <Text style={styles.filterSectionLabel}>Type</Text>
              <View style={styles.typeRow}>
                {(['Need', 'Want', 'Investment'] as const).map((t) => (
                  <Chip key={t} label={t} selected={editType === t} onPress={() => setEditType(t)} style={styles.flex} />
                ))}
              </View>

              <Button label="Save changes" onPress={submitEdit} style={styles.saveBtn} />
            </ScrollView>
          </Animated.View>
        ) : (
          <View style={styles.overflowSheet}>
            <Text style={styles.overflowSubtitle}>
              {overflowTx ? `${formatCurrency(Math.abs(overflowTx.amount))} · ${new Date(overflowTx.timestamp).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}` : ''}
            </Text>
            <Pressable style={styles.overflowAction} onPress={() => overflowTx && handleEdit(overflowTx)} accessibilityRole="button">
              <Ionicons name="create-outline" size={20} color={c.text} />
              <Text style={styles.overflowActionText}>Edit Transaction</Text>
            </Pressable>
            <Pressable style={styles.overflowAction} onPress={() => overflowTx && handleDelete(overflowTx)} accessibilityRole="button">
              <Ionicons name="trash-outline" size={20} color={c.dangerStrong} />
              <Text style={[styles.overflowActionText, { color: c.dangerStrong }]}>Delete Transaction</Text>
            </Pressable>
          </View>
        )}
      </Sheet>

      {/* Advanced filter sheet */}
      <Sheet visible={showFilterModal} onClose={() => setShowFilterModal(false)} title="Filter Transactions">
        <View style={styles.filterSheet}>
          <View style={styles.filterHeaderRow}>
            <Text style={styles.filterSectionLabel}>Category</Text>
            {hasActiveFilters && (
              <Pressable onPress={clearFilters} hitSlop={8} accessibilityRole="button">
                <Text style={styles.clearFiltersText}>Clear Filters</Text>
              </Pressable>
            )}
          </View>
          <View style={styles.filterCategoryGrid}>
            {CATEGORIES.map((cat) => (
              <Chip
                key={cat.key}
                label={`${cat.emoji} ${cat.label}`}
                selected={selectedCategories.includes(cat.key)}
                onPress={() => toggleCategory(cat.key)}
              />
            ))}
          </View>
          <Button label="Done" onPress={() => setShowFilterModal(false)} />
        </View>
      </Sheet>

    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────
const useStyles = createStyles((c) => ({
  container: {
    flex: 1,
    backgroundColor: c.bg,
  },
  flex: {
    flex: 1,
  },
  body: {
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 4,
  },
  filterBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    marginBottom: 4,
  },
  filterBtnActive: {
    backgroundColor: c.primary,
    borderColor: c.primary,
  },
  filterCount: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    overflow: 'hidden',
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 18,
    color: c.primary,
    backgroundColor: c.surface,
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryItem: {
    flex: 1,
  },
  summaryLabel: {
    ...typeScale.caption,
    color: c.onAuroraMuted,
  },
  summaryValue: {
    ...typeScale.title,
    color: c.onAurora,
    marginTop: 4,
  },
  summaryDivider: {
    width: 1,
    alignSelf: 'stretch',
    marginHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 44,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    backgroundColor: c.surfaceAlt,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    fontSize: 15,
    color: c.text,
  },
  chips: {
    gap: 8,
    paddingVertical: 2,
  },
  activeFilterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.md,
    backgroundColor: c.primarySoft,
  },
  activeFilterText: {
    ...typeScale.label,
    flex: 1,
    color: c.primary,
  },
  suggestion: {
    flexDirection: 'row',
    gap: 12,
  },
  suggestionKicker: {
    ...typeScale.overline,
    color: c.purple,
  },
  suggestionTitle: {
    ...typeScale.headline,
    fontSize: 15,
    color: c.text,
    marginTop: 4,
  },
  suggestionActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  skeleton: {
    marginTop: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 8,
    backgroundColor: c.bg,
  },
  sectionTitle: {
    ...typeScale.label,
    color: c.textMuted,
  },
  sectionTotal: {
    ...typeScale.label,
    ...tabular,
    color: c.textSubtle,
  },
  rowWrap: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  swipeContainer: {
    borderRadius: radius.lg,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: radius.lg,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
  },
  cardPressed: {
    backgroundColor: c.surfaceAlt,
  },
  details: {
    flex: 1,
  },
  desc: {
    fontSize: 15,
    fontWeight: '600',
    color: c.text,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  categoryLabel: {
    flexShrink: 1,
    fontSize: 12,
    color: c.textMuted,
  },
  metaDot: {
    fontSize: 12,
    color: c.textSubtle,
    marginHorizontal: 4,
  },
  typeInline: {
    fontSize: 12,
    fontWeight: '700',
  },
  dateText: {
    fontSize: 12,
    color: c.textSubtle,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  rightCol: {
    alignItems: 'flex-end',
    gap: 8,
  },
  amount: {
    fontSize: 15,
    fontWeight: '700',
    color: c.text,
    ...tabular,
  },
  swipeAction: {
    width: 84,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: radius.lg,
    marginHorizontal: 6,
  },
  swipeEdit: {
    backgroundColor: c.primary,
  },
  swipeDelete: {
    backgroundColor: c.danger,
  },
  swipeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  overflowSheet: {
    gap: 4,
    paddingBottom: 4,
  },
  overflowSubtitle: {
    ...typeScale.body,
    color: c.textMuted,
    marginBottom: 8,
  },
  overflowAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: c.border,
  },
  overflowActionText: {
    fontSize: 16,
    fontWeight: '600',
    color: c.text,
  },
  filterSheet: {
    gap: 12,
  },
  filterHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  filterSectionLabel: {
    ...typeScale.overline,
    color: c.textSubtle,
    marginTop: 6,
    marginBottom: 8,
  },
  clearFiltersText: {
    ...typeScale.label,
    color: c.danger,
  },
  filterCategoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  typeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  saveBtn: {
    marginTop: 20,
  },
}));
