import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  apiErrorCode, commitStatement, getPaymentMethods, previewStatement, undoImport,
  StatementPreview, StatementRow,
} from '../services/api';
import { PaymentMethod } from '../types';
import { paymentMethodLabel } from '../utils/paymentMethods';
import { CATEGORY_ITEMS } from '../utils/categories';
import { formatCurrency } from '../utils/format';
import { uriToBase64 } from '../utils/fileData';
import { toast } from '../store/useCelebrationStore';
import { createStyles, radius, tabular, typeScale, useTheme } from '../theme';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge, Chip } from '../components/ui/Bits';
import { Field } from '../components/ui/Field';
import { Sheet } from '../components/ui/Sheet';
import { CategoryGrid } from '../components/ui/CategoryGrid';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { ScreenHeader, useHeaderHeight } from '../components/ui/ScreenHeader';

const MAX_BYTES = 6 * 1024 * 1024;
const TYPES = ['Need', 'Want', 'Investment'] as const;
const PARSER_LABEL: Record<StatementPreview['parser'], string> = { csv: 'Read from CSV', gemini: 'Read by Gemini AI', local: 'Offline parser' };
const emojiFor = (cat?: string) => CATEGORY_ITEMS.find((i) => i.key === cat)?.emoji ?? '📦';
const shortDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '');

type PickedFile = { name: string; uri: string; mimeType: string; size: number };

/**
 * Bulk import from a bank statement (CSV or PDF). The server reads and classifies the rows,
 * the user reviews them here, and only the ticked rows are saved as history.
 */
export function ImportStatementScreen(): React.ReactElement {
  const s = useStyles();
  const { c } = useTheme();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();

  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [methodId, setMethodId] = useState('');
  const [file, setFile] = useState<PickedFile | null>(null);
  const [password, setPassword] = useState('');
  const [needsPassword, setNeedsPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<StatementPreview | null>(null);
  const [rows, setRows] = useState<StatementRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<StatementRow | null>(null);
  const [setBalance, setSetBalance] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getPaymentMethods().then((m) => setMethods(m.filter((x) => x.status === 'active'))).catch(() => {});
  }, []);

  const reset = () => {
    setFile(null); setPassword(''); setNeedsPassword(false); setError('');
    setPreview(null); setRows([]); setSelected(new Set()); setSetBalance(false);
  };

  const pick = async () => {
    let DocumentPicker: typeof import('expo-document-picker');
    try {
      // Loaded lazily: a dev client built before this native module was added would crash on a top-level import.
      DocumentPicker = await import('expo-document-picker');
    } catch {
      setError('File picking needs the latest app build. Rebuild the app, then try again.');
      return;
    }
    const res = await DocumentPicker.getDocumentAsync({ type: ['text/csv', 'text/comma-separated-values', 'application/pdf', 'public.comma-separated-values-text'], copyToCacheDirectory: true });
    if (res.canceled || !res.assets?.[0]) return;
    const a = res.assets[0];
    reset();
    if (!/\.(csv|pdf)$/i.test(a.name)) { setError('Choose a .csv or .pdf statement.'); return; }
    if ((a.size ?? 0) > MAX_BYTES) { setError('That file is larger than 6 MB. Export a shorter date range.'); return; }
    setFile({ name: a.name, uri: a.uri, mimeType: a.mimeType ?? '', size: a.size ?? 0 });
  };

  const read = async () => {
    if (!file) return;
    setReading(true);
    setError('');
    try {
      const data = await uriToBase64(file.uri);
      const p = await previewStatement({ fileName: file.name, mimeType: file.mimeType, data, password: password || undefined });
      setNeedsPassword(false);
      setPreview(p);
      setRows(p.rows);
      setSelected(new Set(p.rows.filter((r) => !r.duplicate).map((r) => r.rowId)));
      if (p.suggestedPaymentMethodId && methods.some((m) => m.id === p.suggestedPaymentMethodId)) setMethodId(p.suggestedPaymentMethodId);
    } catch (err: any) {
      const code = apiErrorCode(err);
      if (code === 'PASSWORD_REQUIRED' || code === 'PASSWORD_INCORRECT') {
        setNeedsPassword(true);
        setError(code === 'PASSWORD_INCORRECT' ? 'That password did not open the PDF.' : 'This PDF is password protected. Banks usually use your customer ID or date of birth.');
      } else {
        setError(err?.response?.data?.error || (err?.code === 'ECONNABORTED' ? 'Reading took too long. Try again, or use the CSV.' : 'Could not read this statement.'));
      }
    } finally {
      setReading(false);
    }
  };

  const toggle = (rowId: string) => setSelected((cur) => {
    const next = new Set(cur);
    if (next.has(rowId)) next.delete(rowId); else next.add(rowId);
    return next;
  });
  const editRow = (patch: Partial<StatementRow>) => {
    if (!editing) return;
    const updated = { ...editing, ...patch, userEdited: true };
    setEditing(updated);
    setRows((list) => list.map((r) => (r.rowId === updated.rowId ? updated : r)));
  };

  const chosen = useMemo(() => rows.filter((r) => selected.has(r.rowId)), [rows, selected]);
  const out = chosen.filter((r) => r.direction === 'debit').reduce((sum, r) => sum + r.amount, 0);
  const inn = chosen.filter((r) => r.direction === 'credit').reduce((sum, r) => sum + r.amount, 0);
  const closing = preview?.summary.closingBalance ?? null;
  const isBank = methodId === '';

  const save = async () => {
    if (!chosen.length) return;
    setSaving(true);
    setError('');
    try {
      const r = await commitStatement({
        rows: chosen,
        paymentMethodId: methodId || null,
        ...(setBalance && isBank && closing !== null ? { setClosingBalance: true, closingBalance: closing } : {}),
      });
      navigation.goBack();
      toast('Statement imported', {
        subtitle: `${r.insertedTransactions} expenses, ${r.insertedIncome} income${r.skipped ? `, ${r.skipped} already there` : ''}`,
        action: {
          label: 'Undo',
          onPress: () => { undoImport(r.batchId).then(() => toast('Import undone')).catch(() => toast("Couldn't undo the import", { tone: 'error' })); },
        },
      });
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Could not import these rows.');
    } finally {
      setSaving(false);
    }
  };

  const header = (
    <View>
      <Card style={s.card}>
        <Text style={s.title}>1. Choose the statement</Text>
        <Text style={s.muted}>CSV from net banking works best. PDF statements work too, including password-protected ones.</Text>
        <Pressable style={s.drop} onPress={pick} accessibilityRole="button" accessibilityLabel="Choose a statement file">
          <Ionicons name="document-attach-outline" size={28} color={c.primary} />
          <Text style={s.dropTitle} numberOfLines={1}>{file ? file.name : 'Choose a CSV or PDF'}</Text>
          <Text style={s.mutedSmall}>{file ? `${Math.ceil(file.size / 1024)} KB` : 'From Files, iCloud Drive or Downloads · up to 6 MB'}</Text>
        </Pressable>

        <Text style={s.label}>Which account is this?</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
          <Chip label="Bank account" icon="wallet-outline" selected={methodId === ''} onPress={() => setMethodId('')} />
          {methods.map((m) => (
            <Chip key={m.id} label={paymentMethodLabel(m)} icon={m.kind === 'upi' ? 'phone-portrait-outline' : 'card-outline'} selected={methodId === m.id} onPress={() => setMethodId(m.id)} />
          ))}
        </ScrollView>

        {needsPassword && (
          <Field
            label="PDF password"
            icon="lock-closed-outline"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            trailing={(
              <Pressable onPress={() => setShowPassword((v) => !v)} accessibilityRole="button" accessibilityLabel={showPassword ? 'Hide password' : 'Show password'} hitSlop={12}>
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={c.textSubtle} />
              </Pressable>
            )}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="go"
            onSubmitEditing={read}
          />
        )}
        {!!error && <Text style={s.error} accessibilityRole="alert">{error}</Text>}
        <Text style={s.mutedSmall}>The file is read once and not stored. PDF text goes to Google Gemini with account numbers masked; if Gemini is busy an offline parser reads it.</Text>
        <Button label={reading ? 'Reading statement…' : 'Read statement'} onPress={read} loading={reading} disabled={!file || (needsPassword && !password)} style={s.cta} />
      </Card>

      {preview && (
        <View style={s.reviewHead}>
          <View style={s.rowBetween}>
            <Text style={s.title}>2. Review {rows.length}</Text>
            <Badge label={PARSER_LABEL[preview.parser]} tone={preview.parser === 'local' ? 'warning' : 'primary'} />
          </View>
          <Text style={s.muted}>
            {shortDate(preview.summary.periodStart)} – {shortDate(preview.summary.periodEnd)}
            {preview.summary.last4 ? ` · ending ${preview.summary.last4}` : ''}
            {preview.summary.duplicates ? ` · ${preview.summary.duplicates} already recorded (unticked)` : ''}
          </Text>
          <Text style={s.mutedSmall}>Tap a row to change its label. Imported rows are history only: balances are not changed.</Text>
        </View>
      )}
    </View>
  );

  const footer = preview ? (
    <View style={s.footer}>
      {isBank && closing !== null && (
        <View style={s.switchRow}>
          <Text style={[s.muted, s.flex]}>Set my bank balance to the closing balance, {formatCurrency(closing)}</Text>
          <Switch value={setBalance} onValueChange={setSetBalance} trackColor={{ true: c.primary }} />
        </View>
      )}
      <Text style={s.mutedSmall}>{formatCurrency(out)} out · {formatCurrency(inn)} in</Text>
      <Button label={`Import ${chosen.length} row${chosen.length === 1 ? '' : 's'}`} onPress={save} loading={saving} disabled={!chosen.length} style={s.cta} />
    </View>
  ) : undefined;

  return (
    <View style={s.screen}>
      <FlatList
        data={preview ? rows : []}
        keyExtractor={(r) => r.rowId}
        ListHeaderComponent={header}
        ListFooterComponent={footer}
        contentContainerStyle={{ paddingTop: headerHeight + 8, paddingBottom: insets.bottom + 32, paddingHorizontal: 16 }}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        initialNumToRender={20}
        renderItem={({ item: r }) => {
          const on = selected.has(r.rowId);
          return (
            <View style={[s.row, !on && s.rowOff]}>
              <Pressable onPress={() => toggle(r.rowId)} hitSlop={8} accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={`Import ${r.description}`}>
                <Ionicons name={on ? 'checkbox' : 'square-outline'} size={22} color={on ? c.primary : c.textSubtle} />
              </Pressable>
              <Pressable style={s.flex} onPress={() => r.direction === 'debit' && setEditing(r)} accessibilityRole="button" accessibilityLabel={`${r.description}, ${formatCurrency(r.amount)}`}>
                <Text style={s.rowDesc} numberOfLines={1}>{r.description || '—'}</Text>
                <Text style={s.rowMeta} numberOfLines={1}>
                  {shortDate(r.date)} · {r.direction === 'debit' ? `${emojiFor(r.category)} ${r.category} · ${r.type}` : `Income · ${r.source}`}
                </Text>
                {(r.duplicate || (r.needsReview && !r.userEdited && r.direction === 'debit')) && (
                  <Text style={s.flag}>{r.duplicate === 'imported' ? 'Already imported' : r.duplicate === 'possible' ? 'Possible duplicate' : 'Check label'}</Text>
                )}
              </Pressable>
              <Text style={[s.amount, r.direction === 'credit' && { color: c.successStrong }]}>
                {r.direction === 'credit' ? '+' : '−'}{formatCurrency(r.amount)}
              </Text>
            </View>
          );
        }}
      />

      <Sheet visible={!!editing} onClose={() => setEditing(null)} title={editing?.description?.slice(0, 40) || 'Label'}>
        <ScrollView style={s.sheetScroll} showsVerticalScrollIndicator={false}>
          <CategoryGrid items={CATEGORY_ITEMS} isSelected={(key) => key === editing?.category} onPress={(key) => editRow({ category: key })} />
          <Text style={s.label}>Type</Text>
          <SegmentedControl
            segments={TYPES.map((t) => ({ key: t, label: t, dot: { Need: c.info, Want: c.warningStrong, Investment: c.successStrong }[t] }))}
            value={(editing?.type ?? 'Need') as (typeof TYPES)[number]}
            onChange={(t) => editRow({ type: t })}
            accessibilityLabel="Type"
          />
          <Button label="Done" onPress={() => setEditing(null)} style={s.cta} />
        </ScrollView>
      </Sheet>

      <ScreenHeader title="Import statement" onBack={() => navigation.goBack()} />
    </View>
  );
}

const useStyles = createStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.bg },
  flex: { flex: 1 },
  card: { marginBottom: 16 },
  title: { ...typeScale.headline, color: c.text },
  muted: { ...typeScale.body, fontSize: 14, color: c.textMuted, marginTop: 4 },
  mutedSmall: { ...typeScale.caption, color: c.textSubtle, marginTop: 8 },
  label: { ...typeScale.overline, color: c.textSubtle, marginTop: 18, marginBottom: 10 },
  drop: { marginTop: 14, alignItems: 'center', gap: 4, paddingVertical: 22, paddingHorizontal: 12, borderRadius: radius.lg, borderWidth: 1.5, borderStyle: 'dashed', borderColor: c.borderStrong, backgroundColor: c.surfaceAlt },
  dropTitle: { ...typeScale.label, color: c.text, maxWidth: '100%' },
  chips: { gap: 8, paddingRight: 8 },
  error: { ...typeScale.label, color: c.dangerStrong, marginTop: 12 },
  cta: { marginTop: 16 },
  reviewHead: { marginBottom: 8, paddingHorizontal: 4 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 12, marginBottom: 8, borderRadius: radius.md, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border },
  rowOff: { opacity: 0.5 },
  rowDesc: { ...typeScale.label, color: c.text },
  rowMeta: { ...typeScale.caption, color: c.textMuted, marginTop: 2 },
  flag: { ...typeScale.caption, color: c.warningStrong, marginTop: 2, fontWeight: '700' },
  amount: { ...typeScale.label, color: c.text, ...tabular },
  footer: { marginTop: 8 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  sheetScroll: { maxHeight: 560 },
}));
