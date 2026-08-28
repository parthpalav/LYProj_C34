import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  SectionList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Alert,
  TextInput,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getTransactions, updateTransaction, deleteTransaction } from '../services/api';
import { useStore } from '../store/useStore';
import { Transaction } from '../types';
import { formatCurrency } from '../utils/format';
import { TransactionEntryScreen } from './TransactionEntryScreen';

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

// ── Need / Want / Investment badge colours ─────────────────────────────────
const TYPE_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  Need: { bg: '#FEE2E2', text: '#B91C1C', label: 'Need' },
  Want: { bg: '#FEF3C7', text: '#92400E', label: 'Want' },
  Investment: { bg: '#D1FAE5', text: '#065F46', label: 'Investment' },
};

// ── High-level type filters ───────────────────────────────────────────────
const TYPE_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'Need', label: 'Needs' },
  { key: 'Want', label: 'Wants' },
  { key: 'Investment', label: 'Investments' },
] as const;

// ── Monthly grouping helpers ───────────────────────────────────────────────

/** Returns a sort key like "2026-08" (newest = lexicographically largest). */
function monthKey(ts: string): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function monthLabel(key: string): string {
  const [y, m] = key.split('-');
  return `${MONTH_NAMES[parseInt(m, 10) - 1]} ${y}`;
}

function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

interface MonthSection {
  title: string;      // "August 2026"
  monthKey: string;      // "2026-08" — used as SectionList key
  totalAmount: number;      // sum of abs(tx.amount) in this month
  data: Transaction[];
}

/** Groups transactions into month sections, sorted newest-first. */
function groupByMonth(txs: Transaction[]): MonthSection[] {
  const map = new Map<string, Transaction[]>();

  // Bucket by month key
  for (const tx of txs) {
    const key = monthKey(tx.timestamp);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(tx);
  }

  // Sort buckets newest-first; sort transactions inside each bucket newest-first
  return Array.from(map.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, data]) => ({
      title: monthLabel(key),
      monthKey: key,
      totalAmount: data.reduce((sum, tx) => sum + Math.abs(tx.amount), 0),
      data: [...data].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      ),
    }));
}

// ── Screen component ───────────────────────────────────────────────────────

export function TransactionsScreen(): React.ReactElement {
  const { transactions, setTransactions } = useStore();

  const [activeType, setActiveType] = useState<string>('all');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [showEntry, setShowEntry] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [editTx, setEditTx] = useState<Transaction | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [overflowTx, setOverflowTx] = useState<Transaction | null>(null);

  // ── Data fetching ──────────────────────────────────────────────────────
  const fetchTransactions = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      const data = await getTransactions();
      setTransactions(data);
    } catch (e) {
      console.error('fetchTransactions error:', e);
    } finally {
      setRefreshing(false);
    }
  }, [setTransactions]);

  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

  // Re-fetch when entry or edit modal closes (new tx may have been submitted)
  useEffect(() => {
    if (!showEntry && !editTx) fetchTransactions();
  }, [showEntry, editTx]);

  // ── Monthly summary (current month) ────────────────────────────────────
  const monthlySummary = useMemo(() => {
    const cmk = currentMonthKey();
    const thisMonth = transactions.filter((tx) => monthKey(tx.timestamp) === cmk);
    // Spent = Need + Want amounts (exclude Investment)
    const spent = thisMonth
      .filter((tx) => tx.amount < 0 && tx.type !== 'Investment')
      .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
    // Invested = Investment amounts
    const invested = thisMonth
      .filter((tx) => tx.type === 'Investment')
      .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
    return { spent, invested };
  }, [transactions]);

  // ── Edit / Delete handlers ─────────────────────────────────────────────
  const handleDelete = (tx: Transaction) => {
    const isScheduledPayment = tx.liabilityId && tx.scheduledFor;
    const msg = isScheduledPayment
      ? `Delete "${tx.description || 'this transaction'}"?\n\nAmount: ${formatCurrency(Math.abs(tx.amount))}\n\n⚠️ Note: This payment satisfied a scheduled liability occurrence. Deleting it will not restore/rewind the Auto Deduct date.`
      : `Delete "${tx.description || 'this transaction'}"?\n\nAmount: ${formatCurrency(Math.abs(tx.amount))}`;

    Alert.alert(
      'Delete Transaction',
      msg,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteTransaction(tx.id);
              fetchTransactions();
            } catch {
              Alert.alert('Error', 'Failed to delete transaction');
            }
          },
        },
      ]
    );
  };

  const handleEdit = (tx: Transaction) => {
    setOverflowTx(null);
    setEditTx(tx);
    setEditAmount(String(Math.abs(tx.amount)));
    setEditDesc(tx.description || '');
  };

  const submitEdit = async () => {
    if (!editTx) return;
    const parsedAmt = parseFloat(editAmount);
    if (isNaN(parsedAmt) || parsedAmt <= 0) {
      Alert.alert('Error', 'Valid amount required');
      return;
    }
    try {
      const isExpense = editTx.amount < 0;
      await updateTransaction(editTx.id, {
        amount: isExpense ? -parsedAmt : parsedAmt,
        description: editDesc,
      });
      setEditTx(null);
      fetchTransactions();
    } catch {
      Alert.alert('Error', 'Failed to update transaction');
    }
  };

  // ── Filtering: type + multi-category compose (AND between type & categories; OR within categories) ──
  const hasActiveFilters = selectedCategories.length > 0;

  const sections = useMemo<MonthSection[]>(() => {
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

    return groupByMonth(filtered);
  }, [activeType, selectedCategories, transactions]);

  // ── Helper: descriptive empty message ──────────────────────────────────
  const emptyMessage = useMemo(() => {
    if (transactions.length === 0) {
      return 'Your transactions will appear here.';
    }
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
      return `No ${typeLabel.toLowerCase()} transactions this month.`;
    }
    return 'No transactions match these filters.';
  }, [transactions.length, activeType, selectedCategories]);

  // ── Section header renderer ────────────────────────────────────────────
  const renderSectionHeader = ({ section }: { section: MonthSection }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionMonth}>{section.title}</Text>
      <Text style={styles.sectionTotal}>{formatCurrency(section.totalAmount)}</Text>
    </View>
  );

  // ── Transaction card renderer ──────────────────────────────────────────
  const renderItem = ({ item }: { item: Transaction }) => {
    const isExpense = item.amount < 0;
    const displayAmount = `${isExpense ? '-' : '+'}${formatCurrency(Math.abs(item.amount))}`;

    // Category emoji — lowercase lookup handles canonical ("Food") & legacy ("food")
    const icon = CATEGORY_EMOJI[(item.category || '').toLowerCase()] ?? '📦';

    // Need / Want / Investment badge — read directly from backend value
    const typeBadge = item.type ? TYPE_BADGE[item.type] : null;

    // Date string: "27 Aug"
    const d = new Date(item.timestamp);
    const dateStr = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.75}
        onLongPress={() => setOverflowTx(item)}
        accessibilityLabel={`${item.description || item.category}, ${displayAmount}`}
      >
        {/* Category icon */}
        <View style={styles.iconBox}>
          <Text style={styles.iconText}>{icon}</Text>
        </View>

        {/* Main content */}
        <View style={styles.details}>
          <Text style={styles.desc} numberOfLines={1}>
            {item.description || item.category}
          </Text>

          {/* Category · Type · Date row */}
          <View style={styles.metaRow}>
            <Text style={styles.categoryLabel}>
              {LEGACY_CATEGORY_MAP[(item.category || '').toLowerCase()] || item.category || '—'}
            </Text>
            {typeBadge && (
              <>
                <Text style={styles.metaDot}>·</Text>
                <Text style={[styles.typeInline, { color: typeBadge.text }]}>
                  {typeBadge.label}
                </Text>
              </>
            )}
            <Text style={styles.metaDot}>·</Text>
            <Text style={styles.dateText}>{dateStr}</Text>
          </View>

          {/* Tags row (if any) */}
          {item.tags && item.tags.length > 0 && (
            <View style={styles.tagsRow}>
              {item.tags.map((t) => (
                <View key={t} style={styles.tagChip}>
                  <Text style={styles.tagText}>{t.toUpperCase()}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Right column: amount + overflow */}
        <View style={styles.rightCol}>
          <Text style={[styles.amount, !isExpense && styles.income]}>
            {displayAmount}
          </Text>

          {/* Overflow menu trigger */}
          <TouchableOpacity
            style={styles.overflowBtn}
            onPress={() => setOverflowTx(item)}
            activeOpacity={0.6}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Transaction options"
          >
            <Ionicons name="ellipsis-horizontal" size={16} color="#94a3b8" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  // ── Empty state ────────────────────────────────────────────────────────
  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyEmoji}>🧾</Text>
      <Text style={styles.emptyTitle}>
        {transactions.length === 0 ? 'No transactions yet' : 'No results'}
      </Text>
      <Text style={styles.emptySubtitle}>{emptyMessage}</Text>
    </View>
  );

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

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>

      {/* Monthly summary row */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Spent This Month</Text>
          <Text style={styles.summaryValue}>{formatCurrency(monthlySummary.spent)}</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Invested This Month</Text>
          <Text style={[styles.summaryValue, styles.summaryInvested]}>{formatCurrency(monthlySummary.invested)}</Text>
        </View>
      </View>

      {/* Type filters + Filter button row */}
      <View style={styles.filterRow}>
        <View style={styles.typeFilters}>
          {TYPE_FILTERS.map((f) => (
            <Pressable
              key={f.key}
              onPress={() => setActiveType(f.key)}
              style={[styles.typeChip, activeType === f.key && styles.typeChipActive]}
              accessibilityLabel={`Filter by ${f.label}`}
              accessibilityState={{ selected: activeType === f.key }}
            >
              <Text style={activeType === f.key ? styles.typeChipTextActive : styles.typeChipText}>
                {f.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.filterBtn, hasActiveFilters && styles.filterBtnActive]}
          onPress={() => setShowFilterModal(true)}
          activeOpacity={0.7}
          accessibilityLabel="Open advanced filters"
        >
          <Ionicons name="options-outline" size={16} color={hasActiveFilters ? '#ffffff' : '#475569'} />
          <Text style={[styles.filterBtnText, hasActiveFilters && styles.filterBtnTextActive]}>Filter</Text>
        </TouchableOpacity>
      </View>

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
          <TouchableOpacity onPress={clearFilters} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={16} color="#64748b" />
          </TouchableOpacity>
        </View>
      )}

      {/* Monthly-grouped transaction list */}
      <SectionList
        sections={sections}
        keyExtractor={(item: Transaction) => item.id}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        ListEmptyComponent={renderEmptyState}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={sections.length === 0 ? styles.emptyList : undefined}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchTransactions(true)}
            tintColor="#2563EB"
            colors={['#2563EB']}
          />
        }
      />

      {/* Floating Add Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setShowEntry(true)}
        activeOpacity={0.85}
        accessibilityLabel="Add new transaction"
      >
        <Ionicons name="add" size={28} color="#ffffff" />
      </TouchableOpacity>

      {/* Transaction Entry Modal */}
      <Modal
        visible={showEntry}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEntry(false)}
      >
        <TransactionEntryScreen onClose={() => setShowEntry(false)} />
      </Modal>

      {/* Overflow Action Menu Modal */}
      <Modal
        visible={!!overflowTx}
        transparent
        animationType="fade"
        onRequestClose={() => setOverflowTx(null)}
      >
        <TouchableWithoutFeedback onPress={() => setOverflowTx(null)}>
          <View style={styles.overflowOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.overflowSheet}>
                <View style={styles.overflowHandle} />
                <Text style={styles.overflowTitle} numberOfLines={1}>
                  {overflowTx?.description || overflowTx?.category || 'Transaction'}
                </Text>
                <Text style={styles.overflowSubtitle}>
                  {overflowTx ? formatCurrency(Math.abs(overflowTx.amount)) : ''}
                </Text>

                <TouchableOpacity
                  style={styles.overflowAction}
                  onPress={() => overflowTx && handleEdit(overflowTx)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="create-outline" size={20} color="#475569" />
                  <Text style={styles.overflowActionText}>Edit Transaction</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.overflowAction}
                  onPress={() => {
                    if (overflowTx) {
                      setOverflowTx(null);
                      handleDelete(overflowTx);
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="trash-outline" size={20} color="#DC2626" />
                  <Text style={[styles.overflowActionText, { color: '#DC2626' }]}>Delete Transaction</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.overflowCancel}
                  onPress={() => setOverflowTx(null)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.overflowCancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Advanced Filter Modal */}
      <Modal
        visible={showFilterModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFilterModal(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowFilterModal(false)}>
          <View style={styles.filterOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.filterSheet}>
                <View style={styles.overflowHandle} />
                <View style={styles.filterSheetHeader}>
                  <Text style={styles.filterSheetTitle}>Filter Transactions</Text>
                  {hasActiveFilters && (
                    <TouchableOpacity onPress={clearFilters}>
                      <Text style={styles.clearFiltersText}>Clear Filters</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Category filter */}
                <Text style={styles.filterSectionLabel}>Category</Text>
                <View style={styles.filterCategoryGrid}>
                  {CATEGORIES.map((cat) => (
                    <Pressable
                      key={cat.key}
                      onPress={() => toggleCategory(cat.key)}
                      style={[
                        styles.filterCategoryChip,
                        selectedCategories.includes(cat.key) && styles.filterCategoryChipActive,
                      ]}
                      accessibilityLabel={`Filter by ${cat.label}`}
                      accessibilityState={{ selected: selectedCategories.includes(cat.key) }}
                    >
                      <Text style={styles.filterCategoryEmoji}>{cat.emoji}</Text>
                      <Text
                        style={[
                          styles.filterCategoryText,
                          selectedCategories.includes(cat.key) && styles.filterCategoryTextActive,
                        ]}
                      >
                        {cat.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                {/* Apply button */}
                <TouchableOpacity
                  style={styles.filterApplyBtn}
                  onPress={() => setShowFilterModal(false)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.filterApplyText}>Apply Filters</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Quick Edit Modal */}
      <Modal
        visible={!!editTx}
        transparent
        animationType="fade"
        onRequestClose={() => setEditTx(null)}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <View style={styles.editOverlay}>
            <View style={styles.editCard}>
              <Text style={styles.editTitle}>Edit Transaction</Text>

              <Text style={styles.label}>Amount</Text>
              <TextInput
                style={styles.input}
                value={editAmount}
                onChangeText={setEditAmount}
                keyboardType="numeric"
              />

              <Text style={styles.label}>Description</Text>
              <TextInput
                style={styles.input}
                value={editDesc}
                onChangeText={setEditDesc}
              />

              <View style={styles.editActions}>
                <TouchableOpacity
                  onPress={() => setEditTx(null)}
                  style={[styles.editBtn, { backgroundColor: '#E2E8F0' }]}
                >
                  <Text style={{ color: '#475569', fontWeight: '600' }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={submitEdit}
                  style={[styles.editBtn, { backgroundColor: '#2563EB' }]}
                >
                  <Text style={{ color: '#fff', fontWeight: '600' }}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },

  // ── Monthly summary
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 0,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 2,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  summaryInvested: {
    color: '#059669',
  },
  summaryDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#e2e8f0',
  },

  // ── Type filter row
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 8,
  },
  typeFilters: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
  },
  typeChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
  },
  typeChipActive: {
    backgroundColor: '#1e293b',
  },
  typeChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  typeChipTextActive: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },

  // ── Filter button
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  filterBtnActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  filterBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  filterBtnTextActive: {
    color: '#ffffff',
  },

  // ── Active filter indicator
  activeFilterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginHorizontal: 16,
    marginBottom: 4,
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
  },
  activeFilterText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },

  // ── Section header
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 6,
  },
  sectionMonth: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    letterSpacing: 0.2,
  },
  sectionTotal: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2563EB',
  },

  // ── Transaction card
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  iconText: { fontSize: 19 },

  details: { flex: 1, justifyContent: 'center', paddingRight: 8 },
  desc: { fontSize: 14, fontWeight: '600', color: '#1e293b', marginBottom: 3 },

  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  categoryLabel: { fontSize: 11, color: '#64748b', fontWeight: '500' },
  typeInline: { fontSize: 11, fontWeight: '600' },
  metaDot: { fontSize: 11, color: '#94a3b8', marginHorizontal: 4 },
  dateText: { fontSize: 11, color: '#94a3b8' },

  tagsRow: { flexDirection: 'row', gap: 4, marginTop: 4, flexWrap: 'wrap' },
  tagChip: { backgroundColor: '#F3F4F6', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  tagText: { fontSize: 9, color: '#4B5563', fontWeight: '700', letterSpacing: 0.4 },

  // ── Right column
  rightCol: { alignItems: 'flex-end', gap: 4, minWidth: 72 },
  amount: { fontSize: 15, fontWeight: '700', color: '#1e293b' },
  income: { color: '#10b981' },

  overflowBtn: {
    padding: 4,
    borderRadius: 12,
  },

  // ── FAB
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 10,
  },

  // ── Empty state
  emptyList: { flex: 1 },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingHorizontal: 32,
  },
  emptyEmoji: { fontSize: 52, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 20 },

  // ── Overflow action sheet
  overflowOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  overflowSheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 36,
  },
  overflowHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#e2e8f0',
    alignSelf: 'center',
    marginBottom: 16,
  },
  overflowTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 2,
  },
  overflowSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 16,
  },
  overflowAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  overflowActionText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1e293b',
  },
  overflowCancel: {
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  overflowCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#64748b',
  },

  // ── Filter modal
  filterOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  filterSheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 36,
    maxHeight: '70%',
  },
  filterSheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  filterSheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  clearFiltersText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2563EB',
  },
  filterSectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  filterCategoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  filterCategoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  filterCategoryChipActive: {
    backgroundColor: '#eff6ff',
    borderColor: '#2563EB',
  },
  filterCategoryEmoji: {
    fontSize: 14,
  },
  filterCategoryText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  filterCategoryTextActive: {
    color: '#2563EB',
  },
  filterApplyBtn: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  filterApplyText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },

  // ── Edit modal
  editOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  editCard: {
    backgroundColor: '#fff',
    padding: 24,
    borderRadius: 16,
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  editTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16, textAlign: 'center' },
  label: { fontSize: 12, fontWeight: '600', color: '#64748B', marginBottom: 4 },
  input: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 16 },
  editActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  editBtn: { flex: 1, padding: 14, borderRadius: 8, alignItems: 'center' },
});
