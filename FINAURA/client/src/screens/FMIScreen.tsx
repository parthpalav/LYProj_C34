import React, { useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, Dimensions } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { useFinanceStore } from '../store/useFinanceStore';
import { FMIMeter } from '../components/FMIMeter';

const { width } = Dimensions.get('window');

export function FMIScreen(): React.ReactElement {
  const { fmi, fmiHistory, fetchFmi } = useFinanceStore();

  useEffect(() => { fetchFmi(); }, []);

  const historyScores = (fmiHistory || []).map((h: any) => h.score).reverse();
  const labels = historyScores.map((_, i) => `${i + 1}`);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Financial Mood Index</Text>
        {fmi?.fmi ? (
          <FMIMeter score={fmi.fmi.score} />
        ) : (
          <Text style={styles.body}>FMI is still learning from your expenses.</Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>Monthly Trend</Text>
        <LineChart
          data={{ labels: labels.length ? labels : ['1'], datasets: [{ data: historyScores.length ? historyScores : [0] }] }}
          width={width - 32}
          height={180}
          chartConfig={{ color: () => '#3B3BDE', backgroundGradientFrom: '#fff', backgroundGradientTo: '#fff' }}
        />
      </View>

      {fmi?.fmi && (
        <View style={styles.card}>
          <Text style={styles.title}>Dimension Breakdown</Text>
          {Object.entries(fmi.fmi.dimensions).map(([k, v]) => (
            <Text key={k} style={styles.body}>{k}: {Math.round(Number(v))}</Text>
          ))}
          {(fmi.fmi.reasons || []).map((r: string, i: number) => (
            <Text key={i} style={styles.body}>• {r}</Text>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F6FA', padding: 16 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 12 },
  title: { fontWeight: '700', color: '#111827', marginBottom: 6 },
  body: { fontSize: 12, color: '#6B7280', lineHeight: 18 }
});
