import React, { useState } from 'react';
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
} from 'react-native';
import { addTransaction } from '../services/api';
import { useStore } from '../store/useStore';

const CATEGORIES = [
  { label: 'Food & Drink', emoji: '🍔' },
  { label: 'Transport', emoji: '🚗' },
  { label: 'Shopping', emoji: '🛍️' },
  { label: 'Health', emoji: '💊' },
  { label: 'Entertainment', emoji: '🎬' },
  { label: 'Utilities', emoji: '💡' },
  { label: 'Education', emoji: '📚' },
  { label: 'Other', emoji: '📦' },
];

const SPEND_TYPES = ['Need', 'Want', 'Saving', 'Invest'] as const;
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
      const categoryKey = selectedCategory.label.toLowerCase().replace(' & ', '-').split(' ')[0];
      const sentimentMap: Record<string, 'positive' | 'neutral' | 'negative'> = {
        Need: 'neutral', Want: 'negative', Saving: 'positive', Invest: 'positive',
      };
      const newTx = await addTransaction({
        amount:      parsedAmount,
        category:    categoryKey,
        sentiment:   sentimentMap[selectedType] ?? 'neutral',
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
            placeholder="e.g. Grocery dinner"
            placeholderTextColor="#A0AEC0"
          />

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

          {/* Spend Type Tabs */}
          <View style={styles.typeRow}>
            {SPEND_TYPES.map((type) => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.typeChip,
                  selectedType === type && styles.typeChipActive,
                ]}
                onPress={() => setSelectedType(type)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.typeChipText,
                    selectedType === type && styles.typeChipTextActive,
                  ]}
                >
                  {type}
                </Text>
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
const GREEN = '#3DBE7B';

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

  // Type chips
  typeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 20,
    marginBottom: 24,
  },
  typeChip: {
    flex: 1,
    height: 38,
    borderRadius: 99,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  typeChipActive: {
    backgroundColor: GREEN,
    borderColor: GREEN,
  },
  typeChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  typeChipTextActive: {
    color: '#FFFFFF',
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
});
