import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  SafeAreaView,
} from 'react-native';
import { updateCurrentBalance } from '../services/api';
import { useStore } from '../store/useStore';

const BLUE = '#3B3BDE';
const GREEN = '#22C880';

interface Props {
  onClose?: () => void;
}

export function UpdateBalanceScreen({ onClose }: Props): React.ReactElement {
  const { user, setUser } = useStore();
  const [balance, setBalance] = useState(String(user?.currentBalance ?? 0));
  const [saving, setSaving] = useState(false);

  const parsedBalance = parseFloat(balance.replace(/[^0-9.]/g, '')) || 0;

  const handleUpdate = async () => {
    if (saving) return;

    if (!user?.id) {
      Alert.alert('Error', 'User information not available');
      return;
    }

    if (isNaN(parsedBalance)) {
      Alert.alert('Invalid Amount', 'Please enter a valid balance amount.');
      return;
    }

    setSaving(true);
    try {
      await updateCurrentBalance(user.id, parsedBalance);
      
      // Update local store
      setUser({
        ...user,
        currentBalance: parsedBalance,
      });

      Alert.alert('Success', 'Bank balance updated successfully!');
      setTimeout(() => {
        onClose?.();
      }, 500);
    } catch (error) {
      Alert.alert('Error', 'Failed to update balance. Please try again.');
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Update Bank Balance</Text>
          <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
            <Text style={styles.closeBtn}>✕</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Current Balance</Text>
          <View style={styles.inputWrapper}>
            <Text style={styles.currencySymbol}>₹</Text>
            <TextInput
              style={styles.input}
              value={balance}
              onChangeText={(text) => setBalance(text.replace('₹', ''))}
              keyboardType="decimal-pad"
              placeholder="0"
              selectTextOnFocus
            />
          </View>

          <View style={styles.infoBox}>
            <Text style={styles.infoLabel}>Amount to Update</Text>
            <Text style={styles.infoValue}>
              ₹{parsedBalance.toFixed(2)}
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
              <Text style={styles.confirmBtnText}>Update Balance</Text>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#f6f8fc',
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
    color: '#101827',
  },
  closeBtn: {
    fontSize: 24,
    color: '#6b7280',
    fontWeight: '700',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#e7ebf2',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 12,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 16,
    backgroundColor: '#fafafa',
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
    color: '#101827',
  },
  infoBox: {
    backgroundColor: '#eef2ff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#d7e3ff',
  },
  infoLabel: {
    fontSize: 12,
    color: '#6b7280',
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
    color: '#6b7280',
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
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 18,
    fontWeight: '500',
  },
});
