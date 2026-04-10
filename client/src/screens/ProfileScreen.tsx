import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useStore } from '../store/useStore';

function formatDOB(value: Date | string | null | undefined): string {
  if (!value) return 'Not set';

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not set';

  return date.toLocaleDateString();
}

function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'Not set';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
}

export function ProfileScreen(): React.ReactElement {
  const user = useStore((state) => state.user);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Profile</Text>
      <Text style={styles.subtitle}>Your account and onboarding details</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Name</Text>
        <Text style={styles.value}>{user?.name ?? 'Unknown user'}</Text>

        <Text style={styles.label}>Email</Text>
        <Text style={styles.value}>{user?.email ?? 'Not set'}</Text>

        <Text style={styles.label}>Date of Birth</Text>
        <Text style={styles.value}>{formatDOB(user?.dateOfBirth)}</Text>

        <Text style={styles.label}>Retirement Age</Text>
        <Text style={styles.value}>{user?.retirementAge ?? 'Not set'}</Text>

        <Text style={styles.label}>Monthly Income</Text>
        <Text style={styles.value}>{formatCurrency(user?.monthlyIncome)}</Text>

        <Text style={styles.label}>Onboarding Status</Text>
        <Text style={styles.value}>{user?.onboardingComplete ? 'Complete' : 'Pending'}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#f6f8fc',
    flexGrow: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#101827',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: '#667085',
    marginBottom: 18,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e7ebf2',
  },
  label: {
    marginTop: 12,
    fontSize: 12,
    fontWeight: '700',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  value: {
    marginTop: 4,
    fontSize: 16,
    fontWeight: '600',
    color: '#101827',
  },
});
