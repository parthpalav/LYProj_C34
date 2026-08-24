import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, TextInput, Switch, KeyboardAvoidingView, Platform, Modal, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getLiabilities, createLiability, updateLiability, deleteLiability, getLiabilitiesPaymentsSummary, getLiabilityTransactions } from '../services/api';
import { Liability, LiabilityPaymentSummary, LiabilityPaymentHistoryResponse, Transaction } from '../types';

const VALID_CATEGORIES = ['Food', 'Travel', 'Entertainment', 'Shopping', 'Bills', 'Groceries', 'Health', 'Party', 'Education', 'Misc'];
const VALID_TYPES: ('Need' | 'Want' | 'Investment')[] = ['Need', 'Want', 'Investment'];
const FREQUENCIES = ['daily', 'weekly', 'monthly', 'yearly'];

export function LiabilitiesScreen() {
  const [liabilities, setLiabilities] = useState<Liability[]>([]);
  const [paymentSummaries, setPaymentSummaries] = useState<Record<string, LiabilityPaymentSummary>>({});
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Bills');
  const [type, setType] = useState<'Need' | 'Want' | 'Investment'>('Need');
  const [autoDeduct, setAutoDeduct] = useState(false);
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('monthly');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [dayOfWeek, setDayOfWeek] = useState('0');
  const [dayOfMonth, setDayOfMonth] = useState('1');
  const [monthOfYear, setMonthOfYear] = useState('1');

  // Payment History Modal State
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [selectedLiabilityForHistory, setSelectedLiabilityForHistory] = useState<Liability | null>(null);
  const [historyData, setHistoryData] = useState<LiabilityPaymentHistoryResponse | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyPage, setHistoryPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [liabilitiesData, summariesData] = await Promise.all([
        getLiabilities(),
        getLiabilitiesPaymentsSummary().catch(() => ({}))
      ]);
      setLiabilities(liabilitiesData);
      setPaymentSummaries(summariesData || {});
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to fetch liabilities');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openAddModal = () => {
    setEditingId(null);
    setName('');
    setAmount('');
    setCategory('Bills');
    setType('Need');
    setAutoDeduct(false);
    setFrequency('monthly');
    setStartDate(new Date().toISOString().split('T')[0]);
    setDayOfWeek('0');
    setDayOfMonth('1');
    setMonthOfYear('1');
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
    setStartDate(liability.startDate ? liability.startDate.split('T')[0] : new Date().toISOString().split('T')[0]);
    setDayOfWeek(String(liability.dayOfWeek || 0));
    setDayOfMonth(String(liability.dayOfMonth || 1));
    setMonthOfYear(String(liability.monthOfYear || 1));
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!name || !amount || isNaN(Number(amount))) {
      Alert.alert('Error', 'Please enter a valid name and amount.');
      return;
    }

    const payload: Partial<Liability> = {
      name,
      amount: Number(amount),
      category,
      type,
      autoDeduct,
      frequency,
      startDate: new Date(startDate).toISOString()
    };

    if (frequency === 'weekly') payload.dayOfWeek = Number(dayOfWeek);
    if (frequency === 'monthly') payload.dayOfMonth = Number(dayOfMonth);
    if (frequency === 'yearly') {
      payload.dayOfMonth = Number(dayOfMonth);
      payload.monthOfYear = Number(monthOfYear);
    }

    try {
      if (editingId) {
        await updateLiability(editingId, payload);
      } else {
        await createLiability(payload);
      }
      setModalVisible(false);
      fetchData();
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to save liability');
    }
  };

  const handleDelete = async (id: string) => {
    Alert.alert('Delete Liability', 'Are you sure you want to remove this liability?', [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Delete', 
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteLiability(id);
            fetchData();
          } catch (e) {
            console.error(e);
            Alert.alert('Error', 'Failed to delete liability');
          }
        }
      }
    ]);
  };

  // -------------------------------------------------------------
  // History Modal Logic
  // -------------------------------------------------------------

  const openHistoryModal = async (liability: Liability) => {
    setSelectedLiabilityForHistory(liability);
    setHistoryModalVisible(true);
    setHistoryPage(1);
    setHistoryData(null);
    setHistoryError(null);
    loadHistory(liability.id, 1);
  };

  const loadHistory = async (id: string, page: number = 1) => {
    try {
      if (page === 1) {
        setHistoryLoading(true);
      } else {
        setLoadingMore(true);
      }
      setHistoryError(null);

      const res = await getLiabilityTransactions(id, page, 20);
      if (page === 1) {
        setHistoryData(res);
      } else {
        setHistoryData(prev => prev ? {
          ...res,
          transactions: [...prev.transactions, ...res.transactions]
        } : res);
      }
      setHistoryPage(page);
    } catch (e: any) {
      console.error('Error fetching liability history:', e);
      setHistoryError(e?.response?.data?.message || 'Failed to load payment history');
    } finally {
      setHistoryLoading(false);
      setLoadingMore(false);
    }
  };

  const loadMoreHistory = () => {
    if (!selectedLiabilityForHistory || !historyData || loadingMore) return;
    if (historyData.pagination.page < historyData.pagination.totalPages) {
      loadHistory(selectedLiabilityForHistory.id, historyPage + 1);
    }
  };

  // -------------------------------------------------------------
  // Derivations for the Overview
  // -------------------------------------------------------------

  const activeLiabilities = useMemo(() => {
    return liabilities.filter(l => l.status === 'active' || !l.status);
  }, [liabilities]);

  const getMonthlyEquivalent = (amt: number, freq: string) => {
    switch (freq) {
      case 'daily': return (amt * 365) / 12;
      case 'weekly': return (amt * 52) / 12;
      case 'yearly': return amt / 12;
      case 'monthly':
      default: return amt;
    }
  };

  const totalMonthlyCommitments = useMemo(() => {
    return activeLiabilities.reduce((sum, curr) => sum + getMonthlyEquivalent(curr.amount, curr.frequency), 0);
  }, [activeLiabilities]);

  const autoDeductLiabilities = useMemo(() => {
    return activeLiabilities
      .filter(l => l.autoDeduct && l.nextDueDate)
      .sort((a, b) => new Date(a.nextDueDate!).getTime() - new Date(b.nextDueDate!).getTime());
  }, [activeLiabilities]);

  const nextAutoDeduct = autoDeductLiabilities.length > 0 ? autoDeductLiabilities[0] : null;
  const upcomingAutoDeducts = autoDeductLiabilities.slice(1, 4);

  const breakdown = useMemo(() => {
    const cats: Record<string, number> = {};
    activeLiabilities.forEach(l => {
      const key = l.category || 'Misc';
      cats[key] = (cats[key] || 0) + getMonthlyEquivalent(l.amount, l.frequency);
    });
    // Sort by amount descending
    return Object.entries(cats).sort((a, b) => b[1] - a[1]);
  }, [activeLiabilities]);

  // -------------------------------------------------------------
  // Rendering
  // -------------------------------------------------------------

  if (loading && !liabilities.length) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#3B3BDE" />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Liabilities</Text>
          <TouchableOpacity style={styles.addBtn} onPress={openAddModal}>
            <Ionicons name="add" size={20} color="#fff" />
            <Text style={styles.addBtnText}>Add</Text>
          </TouchableOpacity>
        </View>

        {activeLiabilities.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={48} color="#9CA3AF" />
            <Text style={styles.emptyTitle}>No liabilities yet</Text>
            <Text style={styles.emptyDesc}>
              Add recurring obligations such as rent, EMIs, loans or insurance to track your monthly commitments.
            </Text>
            <TouchableOpacity style={styles.emptyAddBtn} onPress={openAddModal}>
              <Ionicons name="add" size={20} color="#fff" />
              <Text style={styles.addBtnText}>Add Liability</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Overview Section */}
            <View style={styles.summaryRow}>
              <View style={styles.summaryBox}>
                <Text style={styles.summaryLabel}>Active Liabilities</Text>
                <Text style={styles.summaryValue}>{activeLiabilities.length}</Text>
              </View>
              <View style={styles.summaryBox}>
                <Text style={styles.summaryLabel}>Monthly Commitments</Text>
                <Text style={styles.summaryValue}>₹{Math.round(totalMonthlyCommitments).toLocaleString()}</Text>
              </View>
            </View>

            {/* Next Auto Deduct */}
            <Text style={styles.sectionTitle}>Next Auto Deduct</Text>
            {nextAutoDeduct ? (
              <View style={styles.nextDeductCard}>
                <View style={styles.nextDeductIcon}>
                  <Ionicons name="calendar" size={24} color="#3B3BDE" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.nextDeductName}>{nextAutoDeduct.name}</Text>
                  <Text style={styles.nextDeductAmount}>₹{nextAutoDeduct.amount.toLocaleString()}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.nextDeductDate}>
                    {new Date(nextAutoDeduct.nextDueDate!).toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.noUpcomingCard}>
                <Text style={styles.noUpcomingText}>No automatic deductions scheduled.</Text>
              </View>
            )}

            {/* Upcoming List */}
            {upcomingAutoDeducts.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Upcoming</Text>
                <View style={styles.upcomingContainer}>
                  {upcomingAutoDeducts.map(item => (
                    <View key={item.id} style={styles.upcomingItem}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.upcomingName}>{item.name}</Text>
                        <Text style={styles.upcomingMeta}>
                          {new Date(item.nextDueDate!).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} • {item.frequency}
                        </Text>
                      </View>
                      <Text style={styles.upcomingAmount}>₹{item.amount.toLocaleString()}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}

            {/* Breakdown */}
            {breakdown.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Monthly Commitments</Text>
                <View style={styles.breakdownContainer}>
                  {breakdown.map(([cat, amt], index) => (
                    <View key={cat} style={[styles.breakdownItem, index === breakdown.length - 1 && { borderBottomWidth: 0, paddingBottom: 0 }]}>
                      <Text style={styles.breakdownCat}>{cat}</Text>
                      <Text style={styles.breakdownAmt}>₹{Math.round(amt).toLocaleString()}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}

            {/* Liability List */}
            <Text style={styles.sectionTitle}>Your Liabilities</Text>
            {activeLiabilities.map((item) => {
              const summary = paymentSummaries[item.id];
              const hasPayments = summary && summary.paymentCount > 0;

              return (
                <View key={item.id} style={[styles.card, item.autoDeduct && styles.cardAutoDeduct]}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardName}>{item.name}</Text>
                    <Text style={styles.cardAmount}>₹{item.amount.toLocaleString()}</Text>
                  </View>
                  <Text style={styles.cardMeta}>{item.category} • {item.type}</Text>

                  {/* Recurrence Schedule */}
                  <View style={styles.scheduleRow}>
                    <Ionicons name="repeat" size={16} color="#6B7280" />
                    <Text style={styles.scheduleText}>
                      {item.frequency}
                    </Text>
                  </View>

                  {/* Auto Deduct Status */}
                  <View style={styles.scheduleRow}>
                    {item.autoDeduct ? (
                      <>
                        <Ionicons name="flash" size={16} color="#059669" />
                        <Text style={[styles.scheduleText, { color: '#059669', fontWeight: '600' }]}>Auto Deduct ON</Text>
                      </>
                    ) : (
                      <>
                        <Ionicons name="flash-off" size={16} color="#9CA3AF" />
                        <Text style={[styles.scheduleText, { color: '#6B7280' }]}>Auto Deduct OFF</Text>
                      </>
                    )}
                  </View>

                  {/* Payment Visibility: Last Paid vs Next Due */}
                  <View style={styles.paymentSummaryBox}>
                    {hasPayments ? (
                      <View style={styles.paymentStatRow}>
                        <Ionicons name="checkmark-circle-outline" size={16} color="#059669" />
                        <Text style={styles.lastPaidText}>
                          Last paid: ₹{summary.lastPaymentAmount?.toLocaleString()} · {new Date(summary.lastPaymentDate!).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                        </Text>
                        <Text style={styles.paymentCountBadge}>
                          {summary.paymentCount} {summary.paymentCount === 1 ? 'payment' : 'payments'}
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.paymentStatRow}>
                        <Ionicons name="time-outline" size={16} color="#9CA3AF" />
                        <Text style={styles.noPaymentText}>No payments recorded yet</Text>
                      </View>
                    )}

                    {item.autoDeduct && item.nextDueDate && (
                      <View style={[styles.paymentStatRow, { marginTop: 4 }]}>
                        <Ionicons name="calendar-outline" size={16} color="#3B3BDE" />
                        <Text style={[styles.scheduleText, { color: '#3B3BDE', fontWeight: '600' }]}>
                          Next deduction: ₹{item.amount.toLocaleString()} · {new Date(item.nextDueDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                        </Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.cardActions}>
                    <TouchableOpacity style={styles.historyActionBtn} onPress={() => openHistoryModal(item)}>
                      <Ionicons name="receipt-outline" size={16} color="#3B3BDE" />
                      <Text style={styles.historyActionText}>View Payment History</Text>
                    </TouchableOpacity>

                    <View style={styles.rightActions}>
                      <TouchableOpacity style={styles.actionBtn} onPress={() => openEditModal(item)}>
                        <Ionicons name="pencil" size={16} color="#4B5563" />
                        <Text style={styles.actionText}>Edit</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.actionBtn} onPress={() => handleDelete(item.id)}>
                        <Ionicons name="trash" size={16} color="#EF4444" />
                        <Text style={[styles.actionText, { color: '#EF4444' }]}>Delete</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            })}
          </>
        )}
      </ScrollView>

      {/* Shared Add/Edit Modal */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingId ? 'Edit Liability' : 'Add Liability'}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={28} color="#111827" />
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Name (e.g. Rent)</Text>
              <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Rent" />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Amount (₹)</Text>
              <TextInput style={styles.input} value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder="25000" />
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.label}>Category</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {VALID_CATEGORIES.map(c => (
                    <TouchableOpacity key={c} style={[styles.chip, category === c && styles.chipActive]} onPress={() => setCategory(c)}>
                      <Text style={[styles.chipText, category === c && styles.chipTextActive]}>{c}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.label}>Type</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {VALID_TYPES.map(t => (
                    <TouchableOpacity key={t} style={[styles.chip, type === t && styles.chipActive]} onPress={() => setType(t)}>
                      <Text style={[styles.chipText, type === t && styles.chipTextActive]}>{t}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>

            <View style={styles.switchGroup}>
              <View>
                <Text style={styles.label}>Auto Deduct</Text>
                <Text style={styles.helperText}>Automatically create transactions</Text>
              </View>
              <Switch value={autoDeduct} onValueChange={setAutoDeduct} trackColor={{ true: '#3B3BDE' }} />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Frequency</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {FREQUENCIES.map(f => (
                  <TouchableOpacity key={f} style={[styles.chip, frequency === f && styles.chipActive]} onPress={() => setFrequency(f as any)}>
                    <Text style={[styles.chipText, frequency === f && styles.chipTextActive]}>{f}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Start Date (YYYY-MM-DD)</Text>
              <TextInput style={styles.input} value={startDate} onChangeText={setStartDate} placeholder="YYYY-MM-DD" />
            </View>

            {frequency === 'weekly' && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Day of Week (0=Sun, 6=Sat)</Text>
                <TextInput style={styles.input} value={dayOfWeek} onChangeText={setDayOfWeek} keyboardType="numeric" />
              </View>
            )}

            {(frequency === 'monthly' || frequency === 'yearly') && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Day of Month (1-31)</Text>
                <TextInput style={styles.input} value={dayOfMonth} onChangeText={setDayOfMonth} keyboardType="numeric" />
              </View>
            )}

            {frequency === 'yearly' && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Month of Year (1-12)</Text>
                <TextInput style={styles.input} value={monthOfYear} onChangeText={setMonthOfYear} keyboardType="numeric" />
              </View>
            )}

            <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
              <Text style={styles.saveBtnText}>Save Liability</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Dedicated Payment History Modal */}
      <Modal visible={historyModalVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.historyModalContainer}>
          <View style={styles.historyModalHeader}>
            <View>
              <Text style={styles.historyModalTitle}>{selectedLiabilityForHistory?.name || 'Liability'}</Text>
              <Text style={styles.historyModalSubtitle}>Payment History</Text>
            </View>
            <TouchableOpacity onPress={() => setHistoryModalVisible(false)} style={styles.closeBtn}>
              <Ionicons name="close" size={26} color="#111827" />
            </TouchableOpacity>
          </View>

          {historyLoading && !historyData ? (
            <View style={styles.historyCenter}>
              <ActivityIndicator size="large" color="#3B3BDE" />
              <Text style={styles.historyLoadingText}>Loading payments...</Text>
            </View>
          ) : historyError ? (
            <View style={styles.historyCenter}>
              <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
              <Text style={styles.historyErrorText}>{historyError}</Text>
              <TouchableOpacity
                style={styles.retryBtn}
                onPress={() => selectedLiabilityForHistory && loadHistory(selectedLiabilityForHistory.id, 1)}
              >
                <Text style={styles.retryBtnText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : historyData ? (
            <ScrollView
              contentContainerStyle={styles.historyContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Top Historical Summary */}
              <View style={styles.historySummaryCard}>
                <View style={styles.historySummaryCol}>
                  <Text style={styles.historySummaryLabel}>Total Paid</Text>
                  <Text style={styles.historySummaryValue}>
                    ₹{Math.round(historyData.summary.totalPaid).toLocaleString()}
                  </Text>
                </View>
                <View style={styles.historySummaryDivider} />
                <View style={styles.historySummaryCol}>
                  <Text style={styles.historySummaryLabel}>Payments</Text>
                  <Text style={styles.historySummaryValue}>
                    {historyData.summary.paymentCount}
                  </Text>
                </View>
                <View style={styles.historySummaryDivider} />
                <View style={styles.historySummaryCol}>
                  <Text style={styles.historySummaryLabel}>Last Payment</Text>
                  <Text style={styles.historySummaryValue}>
                    {historyData.summary.lastPaymentDate
                      ? new Date(historyData.summary.lastPaymentDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
                      : '—'}
                  </Text>
                </View>
              </View>

              <Text style={styles.historyListTitle}>Recorded Transactions</Text>

              {historyData.transactions.length === 0 ? (
                <View style={styles.emptyHistoryBox}>
                  <Ionicons name="receipt-outline" size={40} color="#9CA3AF" />
                  <Text style={styles.emptyHistoryTitle}>No payments recorded yet</Text>
                  <Text style={styles.emptyHistoryDesc}>
                    When automatic or scheduled deductions execute, linked transactions will appear here.
                  </Text>
                </View>
              ) : (
                <>
                  {historyData.transactions.map((tx: Transaction) => (
                    <View key={tx.id} style={styles.historyTxRow}>
                      <View style={styles.historyTxLeft}>
                        <View style={styles.historyTxTopLine}>
                          <Text style={styles.historyTxDate}>
                            {new Date(tx.timestamp).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                          </Text>
                          {tx.classificationSource === 'liability' && (
                            <View style={styles.autoDeductBadge}>
                              <Ionicons name="flash" size={10} color="#059669" />
                              <Text style={styles.autoDeductBadgeText}>Auto Deduct</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.historyTxMeta}>
                          {tx.category} • {tx.type || 'Need'}
                        </Text>
                      </View>
                      <Text style={styles.historyTxAmount}>₹{tx.amount.toLocaleString()}</Text>
                    </View>
                  ))}

                  {historyData.pagination.page < historyData.pagination.totalPages && (
                    <TouchableOpacity
                      style={styles.loadMoreBtn}
                      onPress={loadMoreHistory}
                      disabled={loadingMore}
                    >
                      {loadingMore ? (
                        <ActivityIndicator size="small" color="#3B3BDE" />
                      ) : (
                        <Text style={styles.loadMoreText}>Load More Payments</Text>
                      )}
                    </TouchableOpacity>
                  )}
                </>
              )}
            </ScrollView>
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  screen: { flex: 1, backgroundColor: '#F4F6FA' },
  content: { padding: 16, paddingBottom: 40 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 24, fontWeight: '800', color: '#111827' },
  addBtn: { backgroundColor: '#3B3BDE', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  addBtnText: { color: '#fff', fontWeight: '700', marginLeft: 4 },
  emptyState: { alignItems: 'center', marginTop: 60, padding: 20 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#374151', marginTop: 16, marginBottom: 8 },
  emptyDesc: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  emptyAddBtn: { backgroundColor: '#3B3BDE', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#111827', marginTop: 24, marginBottom: 12 },
  
  // Overview Summary
  summaryRow: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  summaryBox: { flex: 1, backgroundColor: '#fff', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#F0F1F5', elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3 },
  summaryLabel: { fontSize: 13, color: '#6B7280', fontWeight: '600', marginBottom: 4 },
  summaryValue: { fontSize: 20, fontWeight: '800', color: '#111827' },

  // Next Auto Deduct Card
  nextDeductCard: { flexDirection: 'row', backgroundColor: '#EEF2FF', padding: 16, borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: '#E0E7FF' },
  nextDeductIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#DBEAFE', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  nextDeductName: { fontSize: 15, fontWeight: '700', color: '#1E40AF', marginBottom: 2 },
  nextDeductAmount: { fontSize: 16, fontWeight: '800', color: '#111827' },
  nextDeductDate: { fontSize: 14, fontWeight: '700', color: '#3B3BDE' },
  noUpcomingCard: { backgroundColor: '#F9FAFB', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center' },
  noUpcomingText: { color: '#6B7280', fontSize: 14, fontStyle: 'italic' },

  // Upcoming List
  upcomingContainer: { backgroundColor: '#fff', borderRadius: 16, paddingHorizontal: 16, borderWidth: 1, borderColor: '#F0F1F5', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
  upcomingItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  upcomingName: { fontSize: 14, fontWeight: '700', color: '#374151', marginBottom: 2 },
  upcomingMeta: { fontSize: 12, color: '#6B7280', textTransform: 'capitalize' },
  upcomingAmount: { fontSize: 14, fontWeight: '800', color: '#111827' },

  // Breakdown
  breakdownContainer: { backgroundColor: '#fff', borderRadius: 16, paddingHorizontal: 16, borderWidth: 1, borderColor: '#F0F1F5', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
  breakdownItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  breakdownCat: { fontSize: 14, color: '#4B5563', fontWeight: '600' },
  breakdownAmt: { fontSize: 14, color: '#111827', fontWeight: '800' },

  // Standard Liability Card
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: '#F0F1F5', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 },
  cardAutoDeduct: { borderColor: '#E0E7FF', backgroundColor: '#FDFDFF' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  cardName: { fontSize: 16, fontWeight: '700', color: '#111827', flex: 1 },
  cardAmount: { fontSize: 18, fontWeight: '800', color: '#111827' },
  cardMeta: { fontSize: 13, color: '#6B7280', marginBottom: 10 },
  scheduleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  scheduleText: { fontSize: 13, color: '#4B5563', textTransform: 'capitalize' },

  // Payment Summary Box in Card
  paymentSummaryBox: { backgroundColor: '#F9FAFB', borderRadius: 10, padding: 10, marginTop: 8, marginBottom: 8, borderWidth: 1, borderColor: '#F3F4F6' },
  paymentStatRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  lastPaidText: { fontSize: 13, color: '#111827', fontWeight: '600' },
  paymentCountBadge: { fontSize: 11, color: '#059669', backgroundColor: '#ECFDF5', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, fontWeight: '700', marginLeft: 'auto' },
  noPaymentText: { fontSize: 12, color: '#9CA3AF', fontStyle: 'italic' },

  cardActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  historyActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: 6 },
  historyActionText: { fontSize: 13, fontWeight: '700', color: '#3B3BDE' },
  rightActions: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionText: { fontSize: 13, fontWeight: '600', color: '#4B5563' },

  // Add/Edit Modal
  modalContent: { padding: 20, paddingBottom: 60 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontSize: 22, fontWeight: '800', color: '#111827' },
  row: { flexDirection: 'row' },
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8 },
  helperText: { fontSize: 12, color: '#6B7280', marginBottom: 4 },
  input: { height: 48, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 12, paddingHorizontal: 14, fontSize: 16, backgroundColor: '#F9FAFB' },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB', marginRight: 8 },
  chipActive: { backgroundColor: '#EFF6FF', borderColor: '#3B3BDE' },
  chipText: { fontSize: 13, fontWeight: '600', color: '#4B5563' },
  chipTextActive: { color: '#3B3BDE' },
  switchGroup: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, padding: 12, backgroundColor: '#F9FAFB', borderRadius: 12, borderWidth: 1, borderColor: '#F3F4F6' },
  saveBtn: { backgroundColor: '#3B3BDE', height: 52, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginTop: 24 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // History Modal Styles
  historyModalContainer: { flex: 1, backgroundColor: '#F9FAFB' },
  historyModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#E5E7EB', backgroundColor: '#fff' },
  historyModalTitle: { fontSize: 20, fontWeight: '800', color: '#111827' },
  historyModalSubtitle: { fontSize: 13, color: '#6B7280', fontWeight: '500', marginTop: 2 },
  closeBtn: { padding: 4 },
  historyCenter: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  historyLoadingText: { marginTop: 12, fontSize: 14, color: '#6B7280', fontWeight: '500' },
  historyErrorText: { marginTop: 12, fontSize: 14, color: '#EF4444', textAlign: 'center', marginBottom: 16 },
  retryBtn: { backgroundColor: '#3B3BDE', paddingHorizontal: 18, paddingVertical: 8, borderRadius: 10 },
  retryBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  historyContent: { padding: 16, paddingBottom: 40 },

  // Historical Summary Card
  historySummaryCard: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: '#E5E7EB', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  historySummaryCol: { flex: 1, alignItems: 'center' },
  historySummaryLabel: { fontSize: 11, fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', marginBottom: 4, letterSpacing: 0.5 },
  historySummaryValue: { fontSize: 16, fontWeight: '800', color: '#111827' },
  historySummaryDivider: { width: 1, backgroundColor: '#E5E7EB', marginVertical: 4 },

  historyListTitle: { fontSize: 16, fontWeight: '800', color: '#111827', marginBottom: 12 },

  emptyHistoryBox: { backgroundColor: '#fff', padding: 28, borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB', marginTop: 8 },
  emptyHistoryTitle: { fontSize: 16, fontWeight: '700', color: '#374151', marginTop: 12, marginBottom: 6 },
  emptyHistoryDesc: { fontSize: 13, color: '#6B7280', textAlign: 'center', lineHeight: 18 },

  historyTxRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: 14, borderRadius: 14, marginBottom: 8, borderWidth: 1, borderColor: '#F0F1F5' },
  historyTxLeft: { flex: 1 },
  historyTxTopLine: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  historyTxDate: { fontSize: 14, fontWeight: '700', color: '#111827' },
  autoDeductBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ECFDF5', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, gap: 2 },
  autoDeductBadgeText: { fontSize: 10, color: '#059669', fontWeight: '700' },
  historyTxMeta: { fontSize: 12, color: '#6B7280' },
  historyTxAmount: { fontSize: 15, fontWeight: '800', color: '#111827' },

  loadMoreBtn: { backgroundColor: '#EFF6FF', paddingVertical: 12, borderRadius: 12, alignItems: 'center', marginTop: 12, borderWidth: 1, borderColor: '#DBEAFE' },
  loadMoreText: { fontSize: 13, fontWeight: '700', color: '#2563EB' }
});
