import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { updateAsset } from '../../services/api';
import { toast } from '../../store/useCelebrationStore';
import { Asset } from '../../types';
import { createStyles, typeScale } from '../../theme';
import { formatCurrency } from '../../utils/format';
import { Button } from '../ui/Button';
import { Field } from '../ui/Field';
import { Sheet } from '../ui/Sheet';

/** Monthly check-in for a market-linked asset: confirm or correct its value and expected return. Saving stamps lastReviewedAt on the server. */
export function AssetReviewSheet({ asset, onClose, onSaved }: { asset: Asset | null; onClose: () => void; onSaved: () => void }) {
  const styles = useStyles();
  const [value, setValue] = useState('');
  const [rate, setRate] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!asset) return;
    setValue(String(asset.currentValue ?? ''));
    setRate(asset.annualReturnRate != null ? String(Math.round(asset.annualReturnRate * 1000) / 10) : '');
    setError('');
  }, [asset]);

  const save = async () => {
    if (!asset) return;
    const v = Number(value);
    const r = rate.trim() === '' ? null : Number(rate);
    if (value.trim() === '' || !(v >= 0)) return setError('Current value must be 0 or more.');
    if (r !== null && !(r >= 0 && r <= 100)) return setError('Expected return must be between 0% and 100%.');
    setSaving(true);
    try {
      await updateAsset(asset.id, { currentValue: v, annualReturnRate: r === null ? null : r / 100 });
      toast('Checked in', { subtitle: `${asset.name} · ${formatCurrency(v)}` });
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.error || "Couldn't save. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  const last = asset?.lastReviewedAt || asset?.createdAt;
  return (
    <Sheet visible={!!asset} onClose={onClose} title={`Update value: ${asset?.name ?? ''}`}>
      <Text style={styles.intro}>
        {asset?.assetType}
        {last ? ` · last confirmed ${new Date(last).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}
      </Text>
      <Field
        label="Current value (₹)"
        icon="cash-outline"
        value={value}
        onChangeText={(t) => { setValue(t.replace(/[^0-9.]/g, '')); setError(''); }}
        keyboardType="decimal-pad"
        hint={asset?.monthlyContribution ? `Include this month's SIP of ${formatCurrency(asset.monthlyContribution)}.` : undefined}
      />
      <Field label="Expected return (% / yr)" icon="trending-up-outline" value={rate} onChangeText={(t) => { setRate(t.replace(/[^0-9.]/g, '')); setError(''); }} keyboardType="decimal-pad" placeholder="Default (8%)" />
      {!!error && <Text style={styles.error} accessibilityRole="alert">{error}</Text>}
      <View style={styles.actions}>
        <Button label="Later" variant="secondary" onPress={onClose} style={styles.flex} />
        <Button label="Confirm" onPress={save} loading={saving} style={styles.flex} />
      </View>
    </Sheet>
  );
}

const useStyles = createStyles((c) => ({
  flex: { flex: 1 },
  intro: { ...typeScale.caption, color: c.textMuted, marginBottom: 14 },
  error: { fontSize: 13, color: c.danger, textAlign: 'center', marginBottom: 12 },
  actions: { flexDirection: 'row', gap: 8 },
}));
