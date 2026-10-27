import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { createStyles } from '../theme';
interface Props {
  text: string;
}

export function InsightCard({ text }: Props): React.ReactElement {
  const styles = useStyles();
  return (
    <View style={styles.card}>
      <Text style={styles.label}>Insight</Text>
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const useStyles = createStyles((c) => ({
  card: {
    backgroundColor: c.successSoft,
    borderColor: c.successSoft,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10
  },
  label: { color: c.successStrong, fontWeight: '700', marginBottom: 5 },
  text: { color: c.successStrong }
}));
