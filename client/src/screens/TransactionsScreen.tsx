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
import { getTransactions } from '../services/api';
import { useStore } from '../store/useStore';
import { Transaction } from '../types';
import { formatCurrency } from '../utils/format';
import { TransactionEntryScreen } from './TransactionEntryScreen';
import { updateTransaction, deleteTransaction } from '../services/api';

// ── Category filter chips ──────────────────────────────────────────────────
const FILTER_CATEGORIES = [
  { key: 'all',           label: 'All',           emoji: '📋' },
  { key: 'food',          label: 'Food',          emoji: '🍕' },
  { key: 'travel',        label: 'Travel',        emoji: '🚕' },
  { key: 'entertainment', label: 'Entertainment', emoji: '🎬' },
  { key: 'shopping',      label: 'Shopping',      emoji: '🛍️' },
  { key: 'bills',         label: 'Bills',         emoji: '💡' },
  { key: 'groceries',     label: 'Groceries',     emoji: '🥦' },
  { key: 'health',        label: 'Health',        emoji: '💊' },
  { key: 'party',         label: 'Party',         emoji: '🎉' },
  { key: 'education',     label: 'Education',     emoji: '📚' },
  { key: 'misc',          label: 'Misc',          emoji: '📦' },
];

// ── Category emoji map (case-insensitive — compare via .toLowerCase()) ─────
const CATEGORY_EMOJI: Record<string, string> = {
  food:          '🍕',
  travel:        '🚕',
  entertainment: '🎬',
  shopping:      '🛍️',
  bills:         '💡',
  groceries:     '🥦',
  health:        '💊',
  party:         '🎉',
  education:     '📚',
  misc:          '📦',
};

// ── Need / Want / Investment badge colours ─────────────────────────────────
const TYPE_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  Need:       { bg: '#FEE2E2', text: '#B91C1C', label: 'Need'       },
  Want:       { bg: '#FEF3C7', text: '#92400E', label: 'Want'       },
  Investment: { bg: '#D1FAE5', text: '#065F46', label: 'Investment' },
};

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

interface MonthSection {
  title:       string;      // "August 2026"
  monthKey:    string;      // "2026-08" — used as SectionList key
  totalAmount: number;      // sum of abs(tx.amount) in this month
  data:        Transaction[];
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
      title:       monthLabel(key),
      monthKey:    key,
      totalAmount: data.reduce((sum, tx) => sum + Math.abs(tx.amount), 0),
      data:        [...data].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      ),
    }));
}

// ── Screen component ───────────────────────────────────────────────────────

export function TransactionsScreen(): React.ReactElement {
  const { transactions, setTransactions } = useStore();

  const [activeCategory, setActiveCategory] = useState('all');
  const [showEntry,      setShowEntry]      = useState(false);
  const [refreshing,     setRefreshing]     = useState(false);
  const [editTx,         setEditTx]         = useState<Transaction | null>(null);
  const [editAmount,     setEditAmount]     = useState('');
  const [editDesc,       setEditDesc]       = useState('');

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

  const handleTxLongPress = (tx: Transaction) => {
    Alert.alert(
      'Manage Transaction',
      `What would you like to do with "${tx.description}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Edit',
          onPress: () => {
            setEditTx(tx);
            setEditAmount(String(Math.abs(tx.amount)));
            setEditDesc(tx.description || '');
          },
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const isScheduledPayment = tx.liabilityId && tx.scheduledFor;
            if (isScheduledPayment) {
              Alert.alert(
                'Delete Scheduled Payment',
                `Deleting this payment will not restore/rewind the Auto Deduct date for "${tx.description}". Do you still want to delete it?`,
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
                    }
                  }
                ]
              );
            } else {
              try {
                await deleteTransaction(tx.id);
                fetchTransactions();
              } catch {
                Alert.alert('Error', 'Failed to delete transaction');
              }
            }
          },
        },
      ]
    );
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
        amount:      isExpense ? -parsedAmt : parsedAmt,
        description: editDesc,
      });
      setEditTx(null);
      fetchTransactions();
    } catch {
      Alert.alert('Error', 'Failed to update transaction');
    }
  };

  // ── Category filter + monthly grouping ────────────────────────────────
  /**
   * 1. Filter by active category (case-insensitive, matching the DB canonical casing).
   * 2. Group into month sections, sorted newest-first.
   * Monthly totals are computed inside groupByMonth — never stored anywhere.
   */
  const sections = useMemo<MonthSection[]>(() => {
    const filtered =
      activeCategory === 'all'
        ? transactions
        : transactions.filter(
            (tx) => (tx.category || '').toLowerCase() === activeCategory
          );
    return groupByMonth(filtered);
  }, [activeCategory, transactions]);

  // ── Section header renderer ────────────────────────────────────────────
  const renderSectionHeader = ({ section }: { section: MonthSection }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionMonth}>{section.title}</Text>
      <Text style={styles.sectionTotal}>{formatCurrency(section.totalAmount)}</Text>
    </View>
  );

  // ── Transaction card renderer ──────────────────────────────────────────
  const renderItem = ({ item }: { item: Transaction }) => {
    const isExpense     = item.amount < 0;
    const displayAmount = `${isExpense ? '-' : '+'}${formatCurrency(Math.abs(item.amount))}`;

    // Category emoji — lowercase lookup handles canonical ("Food") & legacy ("food")
    const icon = CATEGORY_EMOJI[(item.category || '').toLowerCase()] ?? '📦';

    // Sentiment dot colour
    let sentimentColor = '#D1D5DB';
    if (item.sentiment === 'positive') sentimentColor = '#34D399';
    if (item.sentiment === 'negative') sentimentColor = '#F87171';
    if (item.tags?.includes('impulse')) sentimentColor = '#FBBF24';

    // Need / Want / Investment badge — read directly from backend value
    const typeBadge = item.type ? TYPE_BADGE[item.type] : null;

    // Date string: "23 Aug • 8:30 AM"
    const d = new Date(item.timestamp);
    const dateStr = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
    const timeStr = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.75}
        onLongPress={() => handleTxLongPress(item)}
      >
        {/* Delete button — top-right */}
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={() => handleDelete(item)}
          activeOpacity={0.6}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.deleteBtnText}>✕</Text>
        </TouchableOpacity>

        {/* Category icon */}
        <View style={styles.iconBox}>
          <Text style={styles.iconText}>{icon}</Text>
        </View>

        {/* Main content */}
        <View style={styles.details}>
          <Text style={styles.desc} numberOfLines={1}>
            {item.description || item.category}
          </Text>

          {/* Category label + date row */}
          <View style={styles.metaRow}>
            <Text style={styles.categoryLabel}>
              {item.category ?? '—'}
            </Text>
            <Text style={styles.metaDot}>·</Text>
            <Text style={styles.dateText}>{dateStr} · {timeStr}</Text>
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

        {/* Right column: amount + type badge + sentiment */}
        <View style={styles.rightCol}>
          <Text style={[styles.amount, !isExpense && styles.income]}>
            {displayAmount}
          </Text>

          {/* Need / Want / Investment badge — sourced from DB, never re-derived */}
          {typeBadge && (
            <View style={[styles.typeBadge, { backgroundColor: typeBadge.bg }]}>
              <Text style={[styles.typeBadgeText, { color: typeBadge.text }]}>
                {typeBadge.label}
              </Text>
            </View>
          )}

          {/* Sentiment indicator */}
          <View style={styles.sentimentRow}>
            <View style={[styles.sentimentDot, { backgroundColor: sentimentColor }]} />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // ── Empty state ────────────────────────────────────────────────────────
  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyEmoji}>🧾</Text>
      <Text style={styles.emptyTitle}>No transactions yet</Text>
      <Text style={styles.emptySubtitle}>
        {activeCategory === 'all'
          ? 'Tap + to add your first transaction.'
          : `No ${activeCategory} transactions found.`}
      </Text>
    </View>
  );

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>

      {/* Category filter chips */}
      <View style={styles.filters}>
        {FILTER_CATEGORIES.map((cat) => (
          <Pressable
            key={cat.key}
            onPress={() => setActiveCategory(cat.key)}
            style={[styles.filterChip, activeCategory === cat.key && styles.activeChip]}
          >
            <Text style={activeCategory === cat.key ? styles.activeText : styles.filterText}>
              {cat.emoji} {cat.label}
            </Text>
          </Pressable>
        ))}
      </View>

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
            tintColor="#3B3BDE"
            colors={['#3B3BDE']}
          />
        }
      />

      {/* Floating Add Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setShowEntry(true)}
        activeOpacity={0.85}
      >
        <Text style={styles.fabIcon}>+</Text>
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
                  style={[styles.editBtn, { backgroundColor: '#3B3BDE' }]}
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
  container:       { flex: 1, backgroundColor: '#f8fafc' },

  // ── Filter chips
  filters:         { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8, gap: 8 },
  filterChip:      { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, backgroundColor: '#e2e8f0' },
  activeChip:      { backgroundColor: '#0f766e' },
  filterText:      { color: '#334155', fontSize: 12 },
  activeText:      { color: '#ffffff', fontSize: 12 },

  // ── Section header
  sectionHeader: {
    flexDirection:   'row',
    justifyContent:  'space-between',
    alignItems:      'center',
    paddingHorizontal: 16,
    paddingTop:      18,
    paddingBottom:   6,
  },
  sectionMonth: {
    fontSize:   15,
    fontWeight: '700',
    color:      '#0f172a',
    letterSpacing: 0.2,
  },
  sectionTotal: {
    fontSize:   15,
    fontWeight: '700',
    color:      '#3B3BDE',
  },
  // Thin divider under each section header
  sectionDivider: {
    height:          1,
    backgroundColor: '#e2e8f0',
    marginHorizontal: 16,
    marginBottom:    8,
  },

  // ── Transaction card
  card: {
    backgroundColor: '#ffffff',
    borderRadius:    16,
    padding:         14,
    marginHorizontal: 16,
    marginBottom:    10,
    flexDirection:   'row',
    alignItems:      'center',
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: 2 },
    shadowOpacity:   0.05,
    shadowRadius:    6,
    elevation:       2,
    borderWidth:     1,
    borderColor:     '#f1f5f9',
    position:        'relative',
  },
  deleteBtn: {
    position:        'absolute',
    top:             6,
    right:           8,
    width:           22,
    height:          22,
    borderRadius:    11,
    backgroundColor: '#FEE2E2',
    alignItems:      'center',
    justifyContent:  'center',
    zIndex:          10,
  },
  deleteBtnText: {
    fontSize:   10,
    fontWeight: '800',
    color:      '#EF4444',
    lineHeight: 12,
  },
  iconBox: {
    width:           42,
    height:          42,
    borderRadius:    21,
    backgroundColor: '#f8fafc',
    alignItems:      'center',
    justifyContent:  'center',
    marginRight:     12,
    borderWidth:     1,
    borderColor:     '#e2e8f0',
  },
  iconText:     { fontSize: 19 },

  details:      { flex: 1, justifyContent: 'center', paddingRight: 8 },
  desc:         { fontSize: 14, fontWeight: '600', color: '#1e293b', marginBottom: 3 },

  metaRow:      { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  categoryLabel:{ fontSize: 11, color: '#64748b', fontWeight: '500' },
  metaDot:      { fontSize: 11, color: '#94a3b8', marginHorizontal: 4 },
  dateText:     { fontSize: 11, color: '#94a3b8' },

  tagsRow:      { flexDirection: 'row', gap: 4, marginTop: 4, flexWrap: 'wrap' },
  tagChip:      { backgroundColor: '#F3F4F6', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  tagText:      { fontSize: 9, color: '#4B5563', fontWeight: '700', letterSpacing: 0.4 },

  // ── Right column
  rightCol:     { alignItems: 'flex-end', gap: 5, minWidth: 80 },
  amount:       { fontSize: 14, fontWeight: '700', color: '#1e293b' },
  income:       { color: '#10b981' },

  typeBadge: {
    paddingHorizontal: 7,
    paddingVertical:   2,
    borderRadius:      6,
  },
  typeBadgeText: {
    fontSize:   10,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  sentimentRow: { flexDirection: 'row', alignItems: 'center' },
  sentimentDot: { width: 7, height: 7, borderRadius: 3.5 },

  // ── FAB
  fab: {
    position:        'absolute',
    bottom:          24,
    right:           16,
    width:           56,
    height:          56,
    borderRadius:    28,
    backgroundColor: '#3B3BDE',
    alignItems:      'center',
    justifyContent:  'center',
    shadowColor:     '#3B3BDE',
    shadowOffset:    { width: 0, height: 6 },
    shadowOpacity:   0.4,
    shadowRadius:    10,
    elevation:       10,
  },
  fabIcon: { fontSize: 28, color: '#fff', lineHeight: 32 },

  // ── Empty state
  emptyList:      { flex: 1 },
  emptyContainer: {
    flex:            1,
    alignItems:      'center',
    justifyContent:  'center',
    paddingTop:      80,
    paddingHorizontal: 32,
  },
  emptyEmoji:    { fontSize: 52, marginBottom: 16 },
  emptyTitle:    { fontSize: 18, fontWeight: '700', color: '#1e293b', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 20 },

  // ── Edit modal
  editOverlay: {
    flex:            1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent:  'center',
    padding:         24,
  },
  editCard: {
    backgroundColor: '#fff',
    padding:         24,
    borderRadius:    16,
    elevation:       10,
    shadowColor:     '#000',
    shadowOpacity:   0.1,
    shadowRadius:    10,
    shadowOffset:    { width: 0, height: 4 },
  },
  editTitle:   { fontSize: 18, fontWeight: '700', marginBottom: 16, textAlign: 'center' },
  label:       { fontSize: 12, fontWeight: '600', color: '#64748B', marginBottom: 4 },
  input:       { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 16 },
  editActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  editBtn:     { flex: 1, padding: 14, borderRadius: 8, alignItems: 'center' },
});
