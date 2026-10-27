import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  Keyboard,
} from 'react-native';
import { updateCurrentBalance } from '../services/api';
import { useStore } from '../store/useStore';
import { celebrate } from '../store/useCelebrationStore';
import { formatCurrency } from '../utils/format';

import { createStyles, Palette } from '../theme';
const tokens = (c: Palette) => ({ BLUE: c.primary });
const GREEN = '#22C880';

interface Props {
  onClose?: () => void;
}

export function UpdateBalanceScreen({ onClose }: Props): React.ReactElement {
  const styles = useStyles();
  const { user, setUser } = useStore();
  const [operation, setOperation] = useState<'credit' | 'debit'>('credit');
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);

  const parsedAmount = parseFloat(amount.replace(/[^0-9.]/g, '')) || 0;
  const currentBalance = user?.currentBalance ?? 0;
  const projectedBalance = operation === 'credit'
    ? currentBalance + parsedAmount
    : currentBalance - parsedAmount;

  const handleUpdate = async () => {
    if (saving) return;

    if (!user?.id) {
      Alert.alert('Error', 'User information not available');
      return;
    }

    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount greater than 0.');
      return;
    }

    setSaving(true);
    try {
      const response = await updateCurrentBalance(user.id, operation, parsedAmount);
      
      // Update local store
      setUser({
        ...user,
        currentBalance: response.currentBalance,
      });

      onClose?.();
      celebrate({
        kind: 'toast',
        title: 'Balance updated',
        subtitle: `${operation === 'credit' ? 'Added' : 'Deducted'} ${formatCurrency(parsedAmount)}. New balance ${formatCurrency(response.currentBalance)}.`,
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to update balance. Please try again.');
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Adjust Bank Balance</Text>
          <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
            <Text style={styles.closeBtn}>✕</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Current Balance</Text>
          <View style={styles.balanceBox}>
            <Text style={styles.balanceValue}>₹{currentBalance.toFixed(2)}</Text>
          </View>

          <Text style={styles.label}>Transaction Type</Text>
          <View style={styles.segmentWrap}>
            <TouchableOpacity
              style={[styles.segmentBtn, operation === 'credit' && styles.segmentBtnActive]}
              onPress={() => setOperation('credit')}
              activeOpacity={0.8}
            >
              <Text style={[styles.segmentText, operation === 'credit' && styles.segmentTextActive]}>Credit</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.segmentBtn, operation === 'debit' && styles.segmentBtnActive]}
              onPress={() => setOperation('debit')}
              activeOpacity={0.8}
            >
              <Text style={[styles.segmentText, operation === 'debit' && styles.segmentTextActive]}>Debit</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Amount</Text>
          <View style={styles.inputWrapper}>
            <Text style={styles.currencySymbol}>₹</Text>
            <TextInput
              style={styles.input}
              value={amount}
              onChangeText={(text) => setAmount(text.replace('₹', ''))}
              keyboardType="decimal-pad"
              placeholder="0"
              selectTextOnFocus
            />
          </View>

          <View style={styles.infoBox}>
            <Text style={styles.infoLabel}>New Balance Preview</Text>
            <Text style={styles.infoValue}>
              ₹{projectedBalance.toFixed(2)}
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.confirmBtn, saving && styles.confirmBtnDisabled]}
            onPress={handleUpdate}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.confirmBtnText}>{operation === 'credit' ? 'Add Money' : 'Subtract Money'}</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
            <Text style={styles.cancelBtn}>Cancel</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Your balance will be reflected in the dashboard immediately after update.
          </Text>
        </View>
        </View>
      </TouchableWithoutFeedback>
    </SafeAreaView>
  );
}

const useStyles = createStyles((c) => {
  const { BLUE } = tokens(c);
  return {
  safe: {
    flex: 1,
    backgroundColor: c.bg,
  },
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: c.text,
  },
  closeBtn: {
    fontSize: 24,
    color: c.textMuted,
    fontWeight: '700',
  },
  card: {
    backgroundColor: c.surface,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: c.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: c.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 12,
  },
  balanceBox: {
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    backgroundColor: c.bg,
  },
  balanceValue: {
    fontSize: 24,
    fontWeight: '800',
    color: c.text,
  },
  segmentWrap: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 12,
    marginBottom: 20,
    overflow: 'hidden',
  },
  segmentBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    backgroundColor: c.bg,
  },
  segmentBtnActive: {
    backgroundColor: c.primarySoft,
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '700',
    color: c.textMuted,
    textTransform: 'uppercase',
  },
  segmentTextActive: {
    color: BLUE,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: c.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    backgroundColor: c.surface,
    marginBottom: 20,
  },
  currencySymbol: {
    fontSize: 28,
    fontWeight: '800',
    color: BLUE,
    marginRight: 8,
  },
  input: {
    flex: 1,
    height: 56,
    fontSize: 24,
    fontWeight: '800',
    color: c.text,
  },
  infoBox: {
    backgroundColor: c.primarySoft,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: c.primarySoft,
  },
  infoLabel: {
    fontSize: 12,
    color: c.textMuted,
    fontWeight: '600',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 20,
    fontWeight: '800',
    color: BLUE,
  },
  confirmBtn: {
    backgroundColor: BLUE,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: BLUE,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  confirmBtnDisabled: {
    opacity: 0.6,
  },
  confirmBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  cancelBtn: {
    color: c.textMuted,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: 10,
  },
  footer: {
    marginTop: 24,
    paddingHorizontal: 12,
  },
  footerText: {
    fontSize: 12,
    color: c.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    fontWeight: '500',
  },
};
});
