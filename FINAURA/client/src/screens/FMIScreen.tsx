import React, { useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LineChart } from 'react-native-chart-kit';
import { useFinanceStore } from '../store/useFinanceStore';
import { FMIMeter } from '../components/FMIMeter';

const { width } = Dimensions.get('window');

export function FMIScreen(): React.ReactElement {
  const insets = useSafeAreaInsets();
  const { fmi, fmiHistory, fetchFmi } = useFinanceStore();

  useEffect(() => { fetchFmi(); }, []);

  const historyScores = (fmiHistory || []).map((h: any) => h.score).reverse();
  const labels = historyScores.map((_, i) => `${i + 1}`);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.title}>Financial Mood Index</Text>
          {fmi?.fmi ? (
            <FMIMeter score={fmi.fmi.score} />
          ) : (
            <Text style={styles.body}>FMI is learning from your income, obligations, and expenses.</Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>Monthly Trend</Text>
          <LineChart
            data={{ labels: labels.length ? labels : ['1'], datasets: [{ data: historyScores.length ? historyScores : [0] }] }}
            width={width - 40}
            height={180}
            chartConfig={{ color: () => '#2563EB', backgroundGradientFrom: '#FFFFFF', backgroundGradientTo: '#FFFFFF' }}
          />
        </View>

        {fmi?.fmi && (
          <View style={styles.card}>
            <Text style={styles.title}>Dimension Breakdown</Text>
            {Object.entries(fmi.fmi.dimensions || {}).map(([k, v]) => (
              <Text key={k} style={styles.body}>{k}: {Math.round(Number(v))}</Text>
            ))}
            {(fmi.fmi.reasons || []).map((r: string, i: number) => (
              <Text key={i} style={styles.body}>• {r}</Text>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F3F4F6' },
  container: { flex: 1, padding: 16 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 12 },
  title: { fontWeight: '700', color: '#111827', marginBottom: 6, fontSize: 16 },
  body: { fontSize: 13, color: '#6B7280', lineHeight: 18 }
});
