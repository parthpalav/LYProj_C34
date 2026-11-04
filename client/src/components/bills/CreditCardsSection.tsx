import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { payCreditCardBill, setCreditCardBalance } from '../../services/api';
import { toast } from '../../store/useCelebrationStore';
import { PaymentMethod } from '../../types';
import { createStyles, tabular, typeScale, useTheme } from '../../theme';
import { formatCurrency } from '../../utils/format';
import { AnimatedBar } from '../motion/AnimatedBar';
import { Badge, Chip, SectionHeader } from '../ui/Bits';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Field } from '../ui/Field';
import { Sheet } from '../ui/Sheet';

const fullDate = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

/** Credit cards with limit, due date and the Pay bill / Update balance actions. Port of web CreditCardsSection. */
export function CreditCardsSection({ cards, onChanged }: { cards: PaymentMethod[]; onChanged: () => void }) {
  const { c } = useTheme();
  const styles = useStyles();
  const [mode, setMode] = useState<'pay' | 'adjust' | null>(null);
  const [card, setCard] = useState<PaymentMethod | null>(null);
  const [amount, setAmount] = useState('');
  const [used, setUsed] = useState('');
  const [billedUnpaid, setBilledUnpaid] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const shown = cards.filter((x) => x.credit);
  if (!shown.length) return null;
  const total = shown.reduce((s, x) => s + Math.max(0, x.credit!.outstanding), 0);
  const credit = card?.credit;

  const openPay = (x: PaymentMethod) => {
    setCard(x);
    setAmount(String(x.credit!.amountDue > 0 ? x.credit!.amountDue : x.credit!.outstanding));
    setError('');
    setMode('pay');
  };

  const openAdjust = (x: PaymentMethod) => {
    setCard(x);
    setUsed(String(Math.max(0, x.credit!.outstanding)));
    setBilledUnpaid(String(x.credit!.amountDue));
    setError('');
    setMode('adjust');
  };

  const pay = async () => {
    if (!card || !credit) return;
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) return setError('Enter an amount greater than ₹0.');
    if (value > credit.outstanding) return setError(`You owe ${formatCurrency(credit.outstanding)} on this card. Pay that much or less.`);
    setBusy(true);
    try {
      await payCreditCardBill(card.id, value);
      setMode(null);
      toast(`Paid ${formatCurrency(value)} towards ${card.nickname}`, { subtitle: 'Taken from your bank balance.' });
      onChanged();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Payment not recorded. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  const adjust = async () => {
    if (!card || !credit) return;
    const u = Number(used || 0);
    const b = Number(billedUnpaid || 0);
    if (!Number.isFinite(u) || u < 0) return setError('Amount used must be ₹0 or more.');
    if (u > credit.creditLimit) return setError(`Amount used cannot be more than the ${formatCurrency(credit.creditLimit)} limit.`);
    if (!Number.isFinite(b) || b < 0) return setError('Unpaid statement amount must be ₹0 or more.');
    if (b > u) return setError('Unpaid statement amount cannot be more than the amount used.');
    setBusy(true);
    try {
      await setCreditCardBalance(card.id, u, b);
      setMode(null);
      toast(`${card.nickname} balance updated`);
      onChanged();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Balance not saved. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  const decimal = (fn: (v: string) => void) => (v: string) => { fn(v.replace(/[^0-9.]/g, '')); setError(''); };

  return (
    <View>
      <SectionHeader title={`Credit cards · ${formatCurrency(total)} owed`} />
      {shown.map((x) => {
        const cc = x.credit!;
        const usedPct = cc.creditLimit > 0 ? Math.min(1, Math.max(0, cc.outstanding / cc.creditLimit)) : 0;
        return (
          <Card key={x.id} style={styles.card}>
            <View style={styles.head}>
              <View style={styles.flex}>
                <Text style={styles.name} numberOfLines={1}>{x.nickname}</Text>
                <Text style={styles.sub}>•••• {x.last4}</Text>
              </View>
              {cc.overdueAmount > 0 ? (
                <Badge label={`Overdue ${formatCurrency(cc.overdueAmount)}`} tone="danger" />
              ) : cc.amountDue > 0 ? (
                <Badge label={`Due ${fullDate(cc.dueDate)}`} tone="warning" />
              ) : null}
            </View>
            <View accessible accessibilityLabel={`${Math.round(usedPct * 100)}% of credit limit used`}>
              <AnimatedBar progress={usedPct} color={usedPct >= 0.8 ? c.danger : c.primary} style={styles.bar} />
            </View>
            <View style={styles.facts}>
              {[
                ['Used', formatCurrency(cc.outstanding)],
                ['Available', formatCurrency(cc.available)],
                ['Amount due', formatCurrency(cc.amountDue)],
                [cc.amountDue > 0 ? 'Due date' : 'Next due date', fullDate(cc.dueDate)],
                ['Unbilled', formatCurrency(cc.unbilled)],
                ['Limit', formatCurrency(cc.creditLimit)],
              ].map(([k, v]) => (
                <View key={k} style={styles.fact}>
                  <Text style={styles.factLabel}>{k}</Text>
                  <Text style={styles.factValue}>{v}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.sub}>Next statement {fullDate(cc.nextStatementDate)}</Text>
            <View style={styles.actions}>
              <Button label="Update balance" size="sm" variant="secondary" onPress={() => openAdjust(x)} style={styles.flex} />
              <Button label="Pay bill" size="sm" disabled={cc.outstanding <= 0} onPress={() => openPay(x)} style={styles.flex} />
            </View>
          </Card>
        );
      })}

      <Sheet visible={mode === 'pay'} onClose={() => setMode(null)} title={`Pay ${card?.nickname ?? 'card'} bill`}>
        <Text style={styles.intro}>The payment comes out of your bank balance and frees up credit on the card.</Text>
        <Field label="Amount (₹)" icon="cash-outline" value={amount} onChangeText={decimal(setAmount)} keyboardType="decimal-pad" error={error || undefined} />
        {credit && (
          <View style={styles.quick}>
            {credit.amountDue > 0 && <Chip label={`Amount due ${formatCurrency(credit.amountDue)}`} onPress={() => setAmount(String(credit.amountDue))} />}
            <Chip label={`Full balance ${formatCurrency(credit.outstanding)}`} onPress={() => setAmount(String(credit.outstanding))} />
          </View>
        )}
        <Button label="Pay" onPress={pay} loading={busy} />
      </Sheet>

      <Sheet visible={mode === 'adjust'} onClose={() => setMode(null)} title={`Update ${card?.nickname ?? 'card'} balance`}>
        <Text style={styles.intro}>Enter what your card app or statement shows. Use this for spending you did not record here. Your bank balance does not change.</Text>
        <Field label="Total used now (₹)" icon="card-outline" value={used} onChangeText={decimal(setUsed)} keyboardType="decimal-pad" hint="Everything owed on the card, billed or not" />
        <Field
          label="Unpaid from last statement (₹)"
          icon="document-text-outline"
          value={billedUnpaid}
          onChangeText={decimal(setBilledUnpaid)}
          keyboardType="decimal-pad"
          hint={`${credit ? `Billed on ${fullDate(credit.lastStatementDate)} and not paid yet. ` : ''}The rest is billed on your next statement.`}
        />
        {!!error && <Text style={styles.error} accessibilityRole="alert">{error}</Text>}
        <Button label="Save" onPress={adjust} loading={busy} />
      </Sheet>
    </View>
  );
}

const useStyles = createStyles((c) => ({
  flex: { flex: 1 },
  card: { marginBottom: 12 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  name: { fontSize: 16, fontWeight: '700', color: c.text },
  sub: { fontSize: 12, color: c.textMuted, marginTop: 2 },
  bar: { marginTop: 12 },
  facts: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 12, marginBottom: 6 },
  fact: { width: '33.33%', paddingVertical: 6 },
  factLabel: { fontSize: 11, color: c.textSubtle },
  factValue: { fontSize: 14, fontWeight: '700', color: c.text, marginTop: 2, ...tabular },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  intro: { ...typeScale.caption, color: c.textMuted, marginBottom: 14 },
  quick: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16, marginTop: -4 },
  error: { fontSize: 13, color: c.danger, textAlign: 'center', marginBottom: 12 },
}));
