import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { FmiMeter } from '../components/FmiMeter';
import { InsightCard } from '../components/InsightCard';
import { SpendingChart } from '../components/SpendingChart';
import { getDashboard } from '../services/api';
import { DashboardData } from '../types';
import { formatCurrency } from '../utils/format';

export function DashboardScreen(): JSX.Element {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    getDashboard().then(setData).catch(console.error);
  }, []);

  if (!data) {
    return (
      <View style={styles.loaderWrap}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.balance}>Balance: {formatCurrency(data.balance)}</Text>
      <FmiMeter score={data.fmiScore} risk={data.risk} />
      <SpendingChart values={data.spendingSeries} />
      {data.insights.map((item) => (
        <InsightCard key={item} text={item} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: '#f8fafc', minHeight: '100%' },
  loaderWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  balance: { fontSize: 20, fontWeight: '700', marginBottom: 12 }
});
