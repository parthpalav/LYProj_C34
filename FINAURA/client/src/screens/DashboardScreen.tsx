import React, { useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, Dimensions, ActivityIndicator } from 'react-native';
import { PieChart } from 'react-native-chart-kit';
import { useFinanceStore } from '../store/useFinanceStore';
import { FMIMeter } from '../components/FMIMeter';
import { GraphCard } from '../components/GraphCard';
import { LearningProgress } from '../components/LearningProgress';
import { formatCurrency } from '../utils/formatCurrency';

const { width } = Dimensions.get('window');

export function DashboardScreen(): React.ReactElement {
  const { dashboard, fetchDashboard, loading } = useFinanceStore();

  useEffect(() => { fetchDashboard(); }, []);

  if (loading && !dashboard) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#3B3BDE" />
      </View>
    );
  }

  const monthly = dashboard?.monthlySplit || { NEED: 0, WANT: 0, INVESTMENT: 0 };
  const pieData = [
    { name: 'Need', amount: monthly.NEED, color: '#22C55E', legendFontColor: '#6B7280', legendFontSize: 12 },
    { name: 'Want', amount: monthly.WANT, color: '#F59E0B', legendFontColor: '#6B7280', legendFontSize: 12 },
    { name: 'Investment', amount: monthly.INVESTMENT, color: '#3B3BDE', legendFontColor: '#6B7280', legendFontSize: 12 },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 24 }}>
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Manual Balance</Text>
        <Text style={styles.balanceValue}>{formatCurrency(dashboard?.balance || 0)}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Retirement Feasibility</Text>
        <Text style={styles.cardBody}>{dashboard?.retirement?.summary || 'Complete onboarding to unlock retirement insights.'}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>FMI Score</Text>
        {dashboard?.fmi ? (
          <FMIMeter score={dashboard.fmi.score} />
        ) : (
          <Text style={styles.cardBody}>FMI is learning your baseline.</Text>
        )}
      </View>

      <View style={styles.card}>
        <LearningProgress progress={dashboard?.learning?.progress || 0} />
      </View>

      <GraphCard title="Monthly Need / Want / Investment Split">
        <PieChart
          data={pieData}
          width={width - 32}
          height={180}
          chartConfig={{ color: () => '#111827' }}
          accessor="amount"
          backgroundColor="transparent"
          paddingLeft="10"
        />
      </GraphCard>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Recent Alerts</Text>
        {(dashboard?.recentAlerts || []).map((a: string, i: number) => (
          <Text key={i} style={styles.cardBody}>• {a}</Text>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Suggested Next Actions</Text>
        {(dashboard?.nextActions || []).map((a: string, i: number) => (
          <Text key={i} style={styles.cardBody}>• {a}</Text>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F6FA', padding: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  balanceCard: { backgroundColor: '#3B3BDE', padding: 16, borderRadius: 16, marginBottom: 12 },
  balanceLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '600' },
  balanceValue: { color: '#fff', fontSize: 24, fontWeight: '800', marginTop: 4 },
  card: { backgroundColor: '#fff', padding: 14, borderRadius: 14, marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  cardTitle: { fontWeight: '700', color: '#111827', marginBottom: 6 },
  cardBody: { fontSize: 12, color: '#6B7280', lineHeight: 18 }
});
