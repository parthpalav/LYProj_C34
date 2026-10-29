import React, { useState, useCallback } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated from 'react-native-reanimated';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getAssets, createAsset, updateAsset, deleteAsset } from '../services/api';
import { Asset, AssetClass, AssetLiquidity } from '../types';
import { toast } from '../store/useCelebrationStore';
import { enterUp, exitFade, listLayout } from '../motion';
import { Palette, createStyles, radius, tabular, typeScale, useTheme } from '../theme';
import { AnimatedSegment } from '../components/motion/AnimatedBar';
import { SkeletonCard } from '../components/motion/Skeleton';
import { Card } from '../components/ui/Card';
import { Badge, Chip, EmptyState, ErrorState, IconTile, MoneyText, SectionHeader } from '../components/ui/Bits';
import { Button } from '../components/ui/Button';
import { Field } from '../components/ui/Field';
import { LargeTitle, ScreenHeader, useHeaderHeight, useScrollHeader } from '../components/ui/ScreenHeader';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const ASSET_TYPE_PRESETS = [
  'Fixed Deposit',
  'Mutual Fund',
  'Stocks / Equity',
  'Bank / Savings',
  'EPF / PPF',
  'NPS',
  'Gold',
  'Real Estate',
  'Cash',
  'Other',
];

const TYPE_ICON: Record<string, IconName> = {
  'Fixed Deposit': 'lock-closed',
  'Mutual Fund': 'trending-up',
  'Stocks / Equity': 'stats-chart',
  'Bank / Savings': 'card',
  'EPF / PPF': 'shield-checkmark',
  NPS: 'umbrella',
  Gold: 'diamond',
  'Real Estate': 'home',
  Cash: 'cash',
};

const ASSET_CLASS_MAP = (c: Palette): Record<AssetClass, { label: string; sub: string; color: string; tone: 'success' | 'primary' | 'neutral' }> => ({
  FIRE_INVESTABLE: {
    label: 'Retirement / Investable',
    sub: 'Grows towards retirement',
    color: c.success,
    tone: 'success',
  },
  SEMI_LIQUID: {
    label: 'Liquid / Emergency',
    sub: 'Your safety buffer',
    color: c.info,
    tone: 'primary',
  },
  NON_INVESTABLE: {
    label: 'Net-Worth Asset Only',
    sub: 'Counts for net worth, not retirement',
    color: c.textSubtle,
    tone: 'neutral',
  },
});

const LIQUIDITY_MAP: Record<AssetLiquidity, { label: string; sub: string; icon: IconName }> = {
  liquid: { label: 'Liquid', sub: 'Readily accessible', icon: 'water-outline' },
  locked: { label: 'Locked', sub: 'Not immediately available (e.g. FD / PF)', icon: 'lock-closed-outline' },
  restricted: { label: 'Restricted', sub: 'Conditional access only', icon: 'alert-circle-outline' },
};

function formatINR(val: number): string {
  if (!Number.isFinite(val)) return '₹0';
  return '₹' + Math.round(val).toLocaleString('en-IN');
}

export function getRateLabel(type: string): { label: string; placeholder: string } {
  const t = type?.toLowerCase() || '';
  if (t.includes('deposit') || t.includes('fd') || t.includes('rd') || t.includes('recurring')) {
    return { label: 'Interest Rate (% p.a.)', placeholder: 'e.g. 7.25' };
  }
  if (t.includes('mutual') || t.includes('stock') || t.includes('equity') || t.includes('etf')) {
    return { label: 'Expected Return (% p.a.)', placeholder: 'e.g. 12.00' };
  }
  return { label: 'Expected Annual Return (% p.a.)', placeholder: 'e.g. 8.00' };
}

/** Stored rates are fractions (0.07); very old records stored whole percents (7), so both display as 7%. */
const ratePercent = (ast: Asset) =>
  ast.annualReturnRate !== undefined && ast.annualReturnRate !== null
    ? (ast.annualReturnRate > 1 ? ast.annualReturnRate : ast.annualReturnRate * 100)
    : null;

export default function AssetsScreen() {
  const { c } = useTheme();
  const styles = useStyles();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { y, onScroll } = useScrollHeader();
  const classes = ASSET_CLASS_MAP(c);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [formError, setFormError] = useState('');

  // Form Fields
  const [name, setName] = useState('');
  const [assetType, setAssetType] = useState('Fixed Deposit');
  const [customType, setCustomType] = useState('');
  const [currentValue, setCurrentValue] = useState('');
  const [annualReturnRate, setAnnualReturnRate] = useState('');
  const [assetClass, setAssetClass] = useState<AssetClass>('FIRE_INVESTABLE');
  const [includedInFireCorpus, setIncludedInFireCorpus] = useState(true);
  const [liquidity, setLiquidity] = useState<AssetLiquidity>('locked');
  const [notes, setNotes] = useState('');

  const fetchAssets = useCallback(async () => {
    try {
      const data = await getAssets();
      setAssets(data || []);
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { fetchAssets(); }, [fetchAssets]));

  const openAddModal = () => {
    setEditingAsset(null);
    setName('');
    setAssetType('Fixed Deposit');
    setCustomType('');
    setCurrentValue('');
    setAnnualReturnRate('');
    setAssetClass('FIRE_INVESTABLE');
    setIncludedInFireCorpus(true);
    setLiquidity('locked');
    setNotes('');
    setFormError('');
    setModalVisible(true);
  };

  const openEditModal = (ast: Asset) => {
    setEditingAsset(ast);
    setName(ast.name);
    if (ASSET_TYPE_PRESETS.includes(ast.assetType)) {
      setAssetType(ast.assetType);
      setCustomType('');
    } else {
      setAssetType('Other');
      setCustomType(ast.assetType);
    }
    setCurrentValue(String(ast.currentValue));
    setAnnualReturnRate(ratePercent(ast) !== null ? String(+ratePercent(ast)!.toFixed(2)) : '');
    setAssetClass(ast.assetClass);
    setIncludedInFireCorpus(ast.includedInFireCorpus);
    setLiquidity(ast.liquidity || 'liquid');
    setNotes(ast.notes || '');
    setFormError('');
    setModalVisible(true);
  };

  const handleClassChange = (newClass: AssetClass) => {
    setAssetClass(newClass);
    if (newClass === 'NON_INVESTABLE') {
      setIncludedInFireCorpus(false);
    } else if (newClass === 'FIRE_INVESTABLE') {
      setIncludedInFireCorpus(true);
    }
  };

  const handleTypeSelect = (type: string) => {
    setAssetType(type);
    // Sensible defaults based on preset
    if (type === 'Fixed Deposit') {
      setAssetClass('FIRE_INVESTABLE');
      setIncludedInFireCorpus(true);
      setLiquidity('locked');
    } else if (type === 'Bank / Savings' || type === 'Cash') {
      setAssetClass('SEMI_LIQUID');
      setIncludedInFireCorpus(false);
      setLiquidity('liquid');
    } else if (type === 'Mutual Fund' || type === 'Stocks / Equity') {
      setAssetClass('FIRE_INVESTABLE');
      setIncludedInFireCorpus(true);
      setLiquidity('liquid');
    } else if (type === 'EPF / PPF' || type === 'NPS') {
      setAssetClass('FIRE_INVESTABLE');
      setIncludedInFireCorpus(true);
      setLiquidity('locked');
    } else if (type === 'Real Estate') {
      setAssetClass('NON_INVESTABLE');
      setIncludedInFireCorpus(false);
      setLiquidity('locked');
    }
  };

  const handleSave = async () => {
    if (!name.trim()) return setFormError('Give this asset a name.');
    const finalType = assetType === 'Other' ? customType.trim() : assetType;
    if (!finalType) return setFormError('Pick a type, or describe it under Other.');
    const val = parseFloat(currentValue);
    if (isNaN(val) || val < 0) return setFormError('Enter the current value (zero or more).');
    if (assetClass === 'NON_INVESTABLE' && includedInFireCorpus) return setFormError('Net-worth-only assets cannot count towards FIRE.');

    let parsedRate: number | null = null;
    if (annualReturnRate.trim() !== '') {
      const rateNum = parseFloat(annualReturnRate.trim());
      if (isNaN(rateNum) || rateNum < 0 || rateNum > 100) return setFormError('Rate must be between 0% and 100%.');
      // The field is always a percentage, so "1" means 1% (it used to be read as 100%).
      parsedRate = rateNum / 100;
    }

    try {
      const payload: Partial<Asset> = {
        name: name.trim(),
        assetType: finalType,
        assetClass,
        currentValue: val,
        annualReturnRate: parsedRate,
        includedInFireCorpus: assetClass === 'NON_INVESTABLE' ? false : includedInFireCorpus,
        liquidity,
        notes: notes.trim(),
      };
      if (editingAsset) await updateAsset(editingAsset.id, payload);
      else await createAsset(payload);
      setModalVisible(false);
      fetchAssets();
      toast(editingAsset ? 'Asset updated' : 'Asset added', {
        subtitle: `${name.trim()} · ${formatINR(val)}${!editingAsset && payload.includedInFireCorpus ? ' · counts towards FIRE' : ''}`,
      });
    } catch (err: any) {
      setFormError(err.response?.data?.error || "Couldn't save. Check your connection and try again.");
    }
  };

  const handleDelete = (ast: Asset) => {
    Alert.alert(
      `Remove ${ast.name}?`,
      'Your net worth and retirement projections will update without it.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAsset(ast.id);
              fetchAssets();
              toast('Asset removed', { tone: 'info', subtitle: ast.name });
            } catch {
              toast("Couldn't remove that asset", { tone: 'error' });
            }
          },
        },
      ]
    );
  };

  // Aggregates
  const totalAssets = assets.reduce((sum, a) => sum + (a.currentValue || 0), 0);
  const fireInvestableCorpus = assets
    .filter((a) => a.includedInFireCorpus && a.assetClass !== 'NON_INVESTABLE')
    .reduce((sum, a) => sum + (a.currentValue || 0), 0);
  const liquidEmergencyBuffer = assets
    .filter((a) => {
      const typeLow = (a.assetType || '').toLowerCase();
      const isEmergencyType =
        a.assetClass === 'SEMI_LIQUID' ||
        typeLow === 'cash' ||
        typeLow === 'bank' ||
        typeLow === 'savings' ||
        typeLow === 'bank / savings' ||
        typeLow === 'liquid fund';
      return isEmergencyType && a.liquidity === 'liquid' && a.assetClass !== 'NON_INVESTABLE';
    })
    .reduce((sum, a) => sum + (a.currentValue || 0), 0);
  const byClass = (k: AssetClass) => assets.filter((a) => a.assetClass === k).reduce((s, a) => s + (a.currentValue || 0), 0);
  const composition = (['FIRE_INVESTABLE', 'SEMI_LIQUID', 'NON_INVESTABLE'] as AssetClass[])
    .map((k) => ({ k, value: byClass(k) }))
    .filter((x) => x.value > 0);

  const body = () => {
    if (loading) return <View style={styles.body}>{[0, 1].map((i) => <SkeletonCard key={i} style={styles.gap} />)}</View>;
    if (loadFailed && assets.length === 0) return <ErrorState onRetry={fetchAssets} />;
    return (
      <View style={styles.body}>
        <Animated.View entering={enterUp(0)}>
          <Card variant="hero">
            <Text style={styles.heroLabel}>Total Recorded Assets</Text>
            <MoneyText value={totalAssets} style={styles.heroValue} />
            {composition.length > 0 && (
              <>
                <View style={styles.track}>
                  {composition.map((x, i) => (
                    <AnimatedSegment key={x.k} pct={(x.value / totalAssets) * 100} color={i === 0 ? '#34D399' : i === 1 ? '#7DD3FC' : 'rgba(255,255,255,0.55)'} delay={i * 150} style={styles.segment} />
                  ))}
                </View>
                <View style={styles.legend}>
                  {composition.map((x, i) => (
                    <View key={x.k} style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: i === 0 ? '#34D399' : i === 1 ? '#7DD3FC' : 'rgba(255,255,255,0.55)' }]} />
                      <Text style={styles.legendText}>{classes[x.k].label.split(' /')[0]} {Math.round((x.value / totalAssets) * 100)}%</Text>
                    </View>
                  ))}
                </View>
              </>
            )}
            <View style={styles.heroRow}>
              <View style={styles.heroStat}>
                <Text style={styles.heroStatLabel}>FIRE Corpus</Text>
                <Text style={styles.heroStatValue}>{formatINR(fireInvestableCorpus)}</Text>
              </View>
              <View style={styles.heroStat}>
                <Text style={styles.heroStatLabel}>Liquid Buffer</Text>
                <Text style={styles.heroStatValue}>{formatINR(liquidEmergencyBuffer)}</Text>
              </View>
            </View>
          </Card>
        </Animated.View>

        <SectionHeader title="Holdings" action={assets.length ? 'Add' : undefined} onAction={openAddModal} />
        {assets.length === 0 ? (
          <EmptyState emoji="💼" title="No assets added yet" message="Add deposits, funds, PF or gold to see your net worth and retirement corpus." actionLabel="+ Add First Asset" onAction={openAddModal} />
        ) : (
          assets.map((ast, index) => {
            const cls = classes[ast.assetClass] || classes.NON_INVESTABLE;
            const liq = LIQUIDITY_MAP[ast.liquidity || 'liquid'];
            const rate = ratePercent(ast);
            return (
              <Animated.View key={ast.id} entering={enterUp(index)} exiting={exitFade} layout={listLayout}>
                <Card style={styles.gap}>
                  <View style={styles.assetTop}>
                    <IconTile icon={TYPE_ICON[ast.assetType] ?? 'ellipse'} tint={cls.color} />
                    <View style={styles.flex}>
                      <Text style={styles.assetName} numberOfLines={1}>{ast.name}</Text>
                      <Text style={styles.assetType}>{ast.assetType}{ast.annualReturnRate !== undefined && ast.annualReturnRate !== null && rate !== null ? ` · ${rate.toFixed(2)}% p.a.` : ''}</Text>
                    </View>
                    <Text style={styles.assetValue}>{formatINR(ast.currentValue)}</Text>
                  </View>
                  <View style={styles.badges}>
                    <Badge label={cls.label} tone={cls.tone} />
                    {ast.includedInFireCorpus && ast.assetClass !== 'NON_INVESTABLE' && <Badge label="In FIRE corpus" tone="success" />}
                    <Badge label={liq.label} />
                  </View>
                  {!!ast.notes && <Text style={styles.notes} numberOfLines={2}>{ast.notes}</Text>}
                  <View style={styles.actions}>
                    <Pressable style={styles.action} onPress={() => openEditModal(ast)} accessibilityRole="button" accessibilityLabel={`Edit ${ast.name}`}>
                      <Ionicons name="create-outline" size={16} color={c.textMuted} />
                      <Text style={[styles.actionText, { color: c.textMuted }]}>Edit</Text>
                    </Pressable>
                    <Pressable style={styles.action} onPress={() => handleDelete(ast)} accessibilityRole="button" accessibilityLabel={`Remove ${ast.name}`}>
                      <Ionicons name="trash-outline" size={16} color={c.danger} />
                      <Text style={[styles.actionText, { color: c.danger }]}>Remove</Text>
                    </Pressable>
                  </View>
                </Card>
              </Animated.View>
            );
          })
        )}
      </View>
    );
  };

  const rateLabel = getRateLabel(assetType === 'Other' ? customType : assetType);

  return (
    <View style={styles.container}>
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingTop: headerHeight, paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} progressViewOffset={headerHeight} onRefresh={() => { setRefreshing(true); fetchAssets(); }} />}
      >
        <LargeTitle
          title="Assets"
          subtitle="Investable wealth, deposits and liquidity"
          right={
            <Pressable style={styles.addBtn} onPress={openAddModal} accessibilityRole="button" accessibilityLabel="Add Financial Asset">
              <Ionicons name="add" size={22} color={c.onPrimary} />
            </Pressable>
          }
        />
        {body()}
      </Animated.ScrollView>
      <ScreenHeader title="Assets" y={y} onBack={() => navigation.goBack()} />

      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Pressable onPress={() => setModalVisible(false)} hitSlop={10} accessibilityRole="button">
              <Text style={styles.sheetCancel}>Cancel</Text>
            </Pressable>
            <Text style={styles.sheetTitle}>{editingAsset ? 'Edit Financial Asset' : 'Add Financial Asset'}</Text>
            <View style={styles.sheetSpacer} />
          </View>
          <ScrollView contentContainerStyle={styles.sheetBody} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={styles.label}>Type</Text>
            <View style={styles.chipWrap}>
              {ASSET_TYPE_PRESETS.map((t) => <Chip key={t} label={t} selected={assetType === t} onPress={() => handleTypeSelect(t)} />)}
            </View>
            {assetType === 'Other' && <Field label="Describe it" value={customType} onChangeText={setCustomType} placeholder="e.g. Bonds, Crypto" />}

            <Field label="Name" icon="pricetag-outline" value={name} onChangeText={(v) => { setName(v); setFormError(''); }} placeholder="e.g. HDFC FD, Nifty 50 Index Fund" />
            <Field label="Current value (₹)" icon="cash-outline" value={currentValue} onChangeText={(v) => { setCurrentValue(v); setFormError(''); }} keyboardType="numeric" placeholder="150000" />
            <Field label={rateLabel.label} icon="trending-up-outline" value={annualReturnRate} onChangeText={setAnnualReturnRate} keyboardType="numeric" placeholder={rateLabel.placeholder} hint="Optional. Enter a percentage, like 7.25." />

            <Text style={styles.label}>What is it for?</Text>
            {(Object.keys(classes) as AssetClass[]).map((k) => (
              <Pressable
                key={k}
                onPress={() => handleClassChange(k)}
                style={[styles.option, assetClass === k && styles.optionOn]}
                accessibilityRole="radio"
                accessibilityState={{ selected: assetClass === k }}
              >
                <Ionicons name={assetClass === k ? 'radio-button-on' : 'radio-button-off'} size={20} color={assetClass === k ? c.primary : c.textSubtle} />
                <View style={styles.flex}>
                  <Text style={styles.optionTitle}>{classes[k].label}</Text>
                  <Text style={styles.optionSub}>{classes[k].sub}</Text>
                </View>
              </Pressable>
            ))}

            <View style={[styles.switchRow, assetClass === 'NON_INVESTABLE' && styles.disabled]}>
              <View style={styles.flex}>
                <Text style={styles.optionTitle}>Count towards FIRE</Text>
                <Text style={styles.optionSub}>{assetClass === 'NON_INVESTABLE' ? 'Not available for net-worth-only assets' : 'Include in your retirement corpus'}</Text>
              </View>
              <Switch value={includedInFireCorpus} onValueChange={setIncludedInFireCorpus} disabled={assetClass === 'NON_INVESTABLE'} trackColor={{ true: c.primary }} />
            </View>

            <Text style={styles.label}>Access</Text>
            <View style={styles.chipRow}>
              {(Object.keys(LIQUIDITY_MAP) as AssetLiquidity[]).map((k) => (
                <Chip key={k} label={LIQUIDITY_MAP[k].label} icon={LIQUIDITY_MAP[k].icon} selected={liquidity === k} onPress={() => setLiquidity(k)} style={styles.flex} />
              ))}
            </View>
            <Text style={styles.optionSub}>{LIQUIDITY_MAP[liquidity].sub}</Text>

            <Field label="Notes" icon="document-text-outline" value={notes} onChangeText={setNotes} placeholder="Optional" style={styles.notesInput} />

            {!!formError && <Text style={styles.error} accessibilityRole="alert">{formError}</Text>}
            <Button label={editingAsset ? 'Save changes' : 'Add asset'} onPress={handleSave} style={styles.save} />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const useStyles = createStyles((c) => ({
  container: { flex: 1, backgroundColor: c.bg },
  flex: { flex: 1 },
  body: { paddingHorizontal: 16 },
  gap: { marginBottom: 12 },
  addBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: c.primary, marginBottom: 4 },
  heroLabel: { ...typeScale.caption, color: c.onAuroraMuted },
  heroValue: { ...typeScale.display, color: c.onAurora, marginTop: 2 },
  track: { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', marginTop: 16, backgroundColor: 'rgba(255,255,255,0.12)' },
  segment: { borderRightWidth: 2, borderRightColor: 'rgba(0,0,0,0.08)' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 12, color: c.onAuroraMuted },
  heroRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
  heroStat: { flex: 1, padding: 12, borderRadius: radius.md, backgroundColor: 'rgba(255,255,255,0.12)' },
  heroStatLabel: { fontSize: 11, color: c.onAuroraMuted },
  heroStatValue: { ...typeScale.headline, color: c.onAurora, marginTop: 2, ...tabular },
  assetTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  assetName: { fontSize: 16, fontWeight: '700', color: c.text },
  assetType: { fontSize: 12, color: c.textMuted, marginTop: 2 },
  assetValue: { fontSize: 16, fontWeight: '800', color: c.text, ...tabular },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  notes: { ...typeScale.caption, color: c.textMuted, marginTop: 10 },
  actions: { flexDirection: 'row', marginTop: 12, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
  action: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 4 },
  actionText: { fontSize: 13, fontWeight: '600' },
  sheet: { flex: 1, backgroundColor: c.bg },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  sheetCancel: { fontSize: 16, color: c.primary, width: 64 },
  sheetTitle: { ...typeScale.headline, color: c.text },
  sheetSpacer: { width: 64 },
  sheetBody: { padding: 20, paddingBottom: 48 },
  label: { ...typeScale.overline, color: c.textSubtle, marginTop: 6, marginBottom: 10 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chipRow: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.md, borderWidth: 1.5, borderColor: c.border, backgroundColor: c.surface, marginBottom: 8 },
  optionOn: { borderColor: c.primary, backgroundColor: c.primarySoft },
  optionTitle: { fontSize: 15, fontWeight: '600', color: c.text },
  optionSub: { fontSize: 12, color: c.textMuted, marginTop: 2, marginBottom: 12 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, paddingBottom: 2, borderRadius: radius.md, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, marginTop: 4, marginBottom: 12 },
  disabled: { opacity: 0.55 },
  notesInput: { marginTop: 4 },
  error: { fontSize: 13, color: c.danger, textAlign: 'center', marginTop: 8 },
  save: { marginTop: 16 },
}));
