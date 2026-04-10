import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Modal,
  FlatList,
  Alert,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { addTransaction, classifyExpense, ClassifyResult } from '../services/api';
import { useStore } from '../store/useStore';

const CATEGORIES = [
  { label: 'Food',          emoji: '🍕', ml: 'Food'          },
  { label: 'Travel',        emoji: '🚕', ml: 'Travel'        },
  { label: 'Entertainment', emoji: '🎬', ml: 'Entertainment' },
  { label: 'Shopping',      emoji: '🛍️', ml: 'Shopping'      },
  { label: 'Bills',         emoji: '💡', ml: 'Bills'         },
  { label: 'Groceries',     emoji: '🥦', ml: 'Groceries'     },
  { label: 'Health',        emoji: '💊', ml: 'Health'        },
  { label: 'Party',         emoji: '🎉', ml: 'Party'         },
  { label: 'Education',     emoji: '📚', ml: 'Education'     },
  { label: 'Misc',          emoji: '📦', ml: 'Misc'          },
];

const SPEND_TYPES = ['Need', 'Want', 'Investment'] as const;
type SpendType = (typeof SPEND_TYPES)[number];

interface Props {
  onClose?: () => void;
}

export function TransactionEntryScreen({ onClose }: Props): React.ReactElement {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(CATEGORIES[0]);
  const [selectedType, setSelectedType] = useState<SpendType>('Want');
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [logged,   setLogged]   = useState(false);
  const [saving,   setSaving]   = useState(false);
  const { transactions, addTransaction: addToStore } = useStore();

  // ── AI Classifier state ─────────────────────────────────────
  const [aiResult,       setAiResult]       = useState<ClassifyResult | null>(null);
  const [aiLoading,      setAiLoading]      = useState(false);
  const badgeAnim = useRef(new Animated.Value(0)).current;
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const text = description.trim();
    if (!text || text.length < 3) {
      setAiResult(null);
      return;
    }
    // Debounce: wait 600 ms after user stops typing
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setAiLoading(true);
      try {
        const result = await classifyExpense(amount ? `${amount} ${text}` : text);
        setAiResult(result);
        const match = CATEGORIES.find(c => c.ml === result.category);
        if (match) setSelectedCategory(match);
        // Animate badge in
        badgeAnim.setValue(0);
        Animated.spring(badgeAnim, { toValue: 1, useNativeDriver: true, tension: 120, friction: 8 }).start();
        
        // Auto-update selectedType based on sentiment if requested
        if (result.sentiment) {
          if (result.sentiment === 'positive') setSelectedType('Investment');
          else if (result.sentiment === 'negative') setSelectedType('Want');
          else setSelectedType('Need');
        }
      } catch {
        setAiResult(null);
      } finally {
        setAiLoading(false);
      }
    }, 600);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [description, amount]);

  const parsedAmount = parseFloat(amount.replace(/[^0-9.]/g, '')) || 0;

  // Real-time stats
  const today = new Date().toDateString();
  const todaySpend = transactions
    .filter(t => new Date(t.timestamp).toDateString() === today)
    .reduce((s, t) => s + (t.amount < 0 ? Math.abs(t.amount) : 0), 0) + parsedAmount;

  const startOfWeek = new Date(); startOfWeek.setDate(startOfWeek.getDate() - 7);
  const weekSpend = transactions
    .filter(t => new Date(t.timestamp) > startOfWeek)
    .reduce((s, t) => s + (t.amount < 0 ? Math.abs(t.amount) : 0), 0) + parsedAmount;

  const wantsRatio = transactions.length > 0 
    ? Math.round((transactions.filter(t => t.sentiment === 'negative').length / transactions.length) * 100)
    : 0;


  const handleLog = async () => {
    if (saving) return;
    if (parsedAmount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount greater than 0.');
      return;
    }
    setSaving(true);
    try {
      // Map UI category + type → server fields
      const categoryKey = selectedCategory.ml.toLowerCase();
      const sentimentMap: Record<string, 'positive' | 'neutral' | 'negative'> = {
        Need: 'neutral', Want: 'negative', Investment: 'positive',
      };
      const finalSentiment: 'positive' | 'neutral' | 'negative' =
        aiResult?.sentiment === 'positive' || aiResult?.sentiment === 'neutral' || aiResult?.sentiment === 'negative'
          ? aiResult.sentiment
          : sentimentMap[selectedType] ?? 'neutral';
      const newTx = await addTransaction({
        amount:      parsedAmount,
        category:    categoryKey,
        sentiment:   finalSentiment,
        description: description.trim() || selectedCategory.label,
      });
      addToStore(newTx);
      setLogged(true);
      setTimeout(() => {
        setLogged(false);
        onClose?.();
      }, 1200);
    } catch {
      Alert.alert('Error', 'Failed to save transaction. Please check the server.');
    } finally {
      setSaving(false);
    }
  };



  return (
    <SafeAreaView style={styles.safe}>
      {/* Dark background */}
      <View style={styles.backdrop} />

      <View style={styles.sheetWrapper}>
        {/* Bottom Sheet Card */}
        <View style={styles.sheet}>
          {/* Drag handle */}
          <View style={styles.dragHandle} />

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Entry</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Text style={styles.closeIcon}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Amount */}
          <TextInput
            style={styles.amountInput}
            value={`₹${amount}`}
            onChangeText={(t) => setAmount(t.replace('₹', ''))}
            keyboardType="decimal-pad"
            selectTextOnFocus
            placeholder="₹0"
          />

          {/* Divider */}
          <View style={styles.divider} />

          {/* Description */}
          <Text style={styles.fieldLabel}>Description</Text>
          <TextInput
            style={styles.textInput}
            value={description}
            onChangeText={setDescription}
            placeholder="e.g. Pizza, Uber ride, Book…"
            placeholderTextColor="#A0AEC0"
          />

          {/* AI Suggestion Badge */}
          {aiLoading && (
            <View style={styles.aiBadgeRow}>
              <ActivityIndicator size="small" color={BRAND_BLUE} />
              <Text style={styles.aiBadgeLoadingText}>AI classifying…</Text>
            </View>
          )}
          {!aiLoading && aiResult && aiResult.confidence > 0 && (
            <Animated.View style={[
              styles.aiBadgeContainer,
              { opacity: badgeAnim, transform: [{ scale: badgeAnim }] }
            ]}>
              <View style={styles.aiBadgeHeader}>
                <Text style={styles.aiBadgeIcon}>🤖</Text>
                <Text style={styles.aiBadgeLabel}>AI Suggestion</Text>
                <Text style={styles.aiAppliedText}>Auto-applied ✓</Text>
              </View>

              {/* Main row: Category + Sentiment */}
              <View style={styles.aiMainPred}>
                <Text style={styles.aiMainCategory}>
                  {CATEGORIES.find(c => c.ml === aiResult.category)?.emoji ?? '📦'}  {aiResult.category}
                </Text>
                <Text style={styles.aiConfidence}>{Math.round(aiResult.confidence * 100)}%</Text>
              </View>
              
              {/* Sentiment Info */}
              {aiResult.sentiment && (
                <View style={styles.sentimentContainer}>
                  <Text style={styles.sentimentLabel}>
                    {aiResult.sentiment_emoji} {aiResult.sentiment_label}
                  </Text>
                  <Text style={styles.verdictText}>{aiResult.verdict}</Text>
                </View>
              )}

              {/* Top 3 mini bars */}
              <View style={{ marginTop: 8 }}>
                {Object.entries(aiResult.all_probs)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 3)
                  .map(([cat, prob]) => (
                    <View key={cat} style={styles.aiBarRow}>
                      <Text style={styles.aiBarLabel}>
                        {CATEGORIES.find(c => c.ml === cat)?.emoji ?? '📦'} {cat}
                      </Text>
                      <View style={styles.aiBarTrack}>
                        <View style={[styles.aiBarFill, { width: `${Math.round(prob * 100)}%` }]} />
                      </View>
                      <Text style={styles.aiBarPct}>{Math.round(prob * 100)}%</Text>
                    </View>
                  ))
                }
              </View>
            </Animated.View>
          )}

          {/* Category */}
          <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Category</Text>
          <TouchableOpacity
            style={styles.categoryPicker}
            onPress={() => setShowCategoryModal(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.categoryText}>
              {selectedCategory.label}
            </Text>
            <View style={styles.categoryRight}>
              <Text style={styles.categoryEmoji}>{selectedCategory.emoji}</Text>
              <Text style={styles.chevron}>⌄</Text>
            </View>
          </TouchableOpacity>

          {/* Spend Type Radio Buttons */}
          <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Transaction Type</Text>
          <View style={styles.radioGroup}>
            {SPEND_TYPES.map((type) => (
              <TouchableOpacity
                key={type}
                style={styles.radioItem}
                onPress={() => setSelectedType(type)}
                activeOpacity={0.7}
              >
                <View style={[styles.radioOuter, selectedType === type && styles.radioOuterActive]}>
                  {selectedType === type && <View style={styles.radioDot} />}
                </View>
                <Text style={styles.radioLabel}>{type}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Log Button */}
          <TouchableOpacity
            style={[styles.logButton, logged && styles.logButtonSuccess]}
            onPress={handleLog}
            activeOpacity={0.85}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.logButtonText}>
                {logged ? '✓ Logged!' : 'Log Transaction'}
              </Text>
            )}
          </TouchableOpacity>

          {/* Summary Footer */}
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Today's Spend</Text>
              <Text style={styles.summaryValue}>
                ₹{todaySpend.toFixed(0)}
              </Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>7-Day Spend</Text>
              <Text style={styles.summaryValue}>₹{weekSpend.toFixed(0)}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Wants Ratio</Text>
              <Text style={styles.summaryValue}>{wantsRatio}%</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Category Modal */}
      <Modal
        visible={showCategoryModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCategoryModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowCategoryModal(false)}
        >
          <View style={styles.modalSheet}>
            <View style={styles.dragHandle} />
            <Text style={styles.modalTitle}>Select Category</Text>
            <FlatList
              data={CATEGORIES}
              keyExtractor={(item) => item.label}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.modalItem,
                    selectedCategory.label === item.label && styles.modalItemActive,
                  ]}
                  onPress={() => {
                    setSelectedCategory(item);
                    setShowCategoryModal(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.modalItemEmoji}>{item.emoji}</Text>
                  <Text
                    style={[
                      styles.modalItemText,
                      selectedCategory.label === item.label && styles.modalItemTextActive,
                    ]}
                  >
                    {item.label}
                  </Text>
                  {selectedCategory.label === item.label && (
                    <Text style={styles.checkmark}>✓</Text>
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const BRAND_BLUE = '#3B3BDE';
const GREEN      = '#3DBE7B';
const AI_BG      = '#F0F0FF';
const AI_BORDER  = '#C7C7FF';

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#1A1A3E',
  },
  sheetWrapper: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingBottom: 32,
    paddingTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 12,
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#E2E8F0',
    borderRadius: 99,
    alignSelf: 'center',
    marginBottom: 16,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    position: 'relative',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A202C',
    letterSpacing: 0.2,
  },
  closeBtn: {
    position: 'absolute',
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIcon: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '700',
  },

  // Amount
  amountInput: {
    fontSize: 42,
    fontWeight: '800',
    color: '#1A202C',
    letterSpacing: -1,
    paddingVertical: 4,
    marginBottom: 16,
  },
  divider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginBottom: 20,
  },

  // Fields
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  textInput: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
    fontSize: 15,
    color: '#1A202C',
    backgroundColor: '#FAFAFA',
  },
  categoryPicker: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FAFAFA',
  },
  categoryText: {
    fontSize: 15,
    color: '#1A202C',
    fontWeight: '500',
  },
  categoryRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  categoryEmoji: {
    fontSize: 18,
  },
  chevron: {
    fontSize: 18,
    color: '#64748B',
    fontWeight: '700',
  },

  // Log button
  logButton: {
    height: 54,
    borderRadius: 27,
    backgroundColor: BRAND_BLUE,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: BRAND_BLUE,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
    marginBottom: 24,
  },
  logButtonSuccess: {
    backgroundColor: GREEN,
    shadowColor: GREEN,
  },
  logButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },

  // Summary
  summaryRow: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#EEF2F7',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  summaryDivider: {
    width: 1,
    backgroundColor: '#E2E8F0',
  },
  summaryLabel: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
    textAlign: 'center',
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1A202C',
    letterSpacing: -0.3,
  },

  // ── AI Badge styles ───────────────────────────────────────
  aiBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    paddingLeft: 4,
  },
  aiBadgeLoadingText: {
    fontSize: 12,
    color: BRAND_BLUE,
    fontWeight: '500',
  },
  aiBadgeContainer: {
    marginTop: 10,
    backgroundColor: AI_BG,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: AI_BORDER,
    padding: 12,
  },
  aiBadgeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 6,
  },
  aiBadgeIcon: { fontSize: 16 },
  aiBadgeLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: BRAND_BLUE,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    flex: 1,
  },
  aiAppliedText: {
    fontSize: 11,
    color: BRAND_BLUE,
    fontWeight: '700',
  },
  aiMainPred: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  aiMainCategory: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1A202C',
  },
  aiConfidence: {
    fontSize: 18,
    fontWeight: '900',
    color: GREEN,
    letterSpacing: -0.5,
  },
  sentimentContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  sentimentLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1A202C',
  },
  verdictText: {
    fontSize: 11,
    color: '#4A5568',
    marginTop: 2,
  },
  aiBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 5,
  },
  aiBarLabel: {
    fontSize: 11,
    color: '#64748B',
    width: 90,
  },
  aiBarTrack: {
    flex: 1,
    height: 5,
    backgroundColor: '#DDE0FF',
    borderRadius: 99,
    overflow: 'hidden',
  },
  aiBarFill: {
    height: '100%',
    backgroundColor: BRAND_BLUE,
    borderRadius: 99,
  },
  aiBarPct: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
    width: 28,
    textAlign: 'right',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingBottom: 40,
    maxHeight: '60%',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1A202C',
    textAlign: 'center',
    marginBottom: 12,
    paddingHorizontal: 24,
  },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    gap: 14,
  },
  modalItemActive: {
    backgroundColor: '#EEF2FF',
  },
  modalItemEmoji: {
    fontSize: 22,
  },
  modalItemText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: '#374151',
  },
  modalItemTextActive: {
    color: BRAND_BLUE,
    fontWeight: '700',
  },
  checkmark: {
    fontSize: 16,
    color: BRAND_BLUE,
    fontWeight: '700',
  },

  // Radio buttons
  radioGroup: {
    flexDirection: 'row',
    gap: 16,
    marginVertical: 16,
  },
  radioItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FAFAFA',
  },
  radioOuterActive: {
    borderColor: BRAND_BLUE,
    backgroundColor: '#EEF2FF',
  },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: BRAND_BLUE,
  },
  radioLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A202C',
    flex: 1,
  },
});
