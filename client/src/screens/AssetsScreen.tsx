import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
  RefreshControl,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { getAssets, createAsset, updateAsset, deleteAsset } from '../services/api';
import { Asset, AssetClass, AssetLiquidity } from '../types';

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

const ASSET_CLASS_MAP: Record<AssetClass, { label: string; sub: string; color: string; bg: string }> = {
  FIRE_INVESTABLE: {
    label: 'Retirement / Investable',
    sub: 'Included in FIRE projections if enabled',
    color: '#10B981',
    bg: '#064E3B40',
  },
  SEMI_LIQUID: {
    label: 'Liquid / Emergency',
    sub: 'Liquid buffer & short-term reserve',
    color: '#38BDF8',
    bg: '#0C4A6E40',
  },
  NON_INVESTABLE: {
    label: 'Net-Worth Asset Only',
    sub: 'Excluded from retirement portfolio',
    color: '#94A3B8',
    bg: '#33415540',
  },
};

const LIQUIDITY_MAP: Record<AssetLiquidity, { label: string; sub: string; icon: string }> = {
  liquid: { label: 'Liquid', sub: 'Readily accessible', icon: 'water' },
  locked: { label: 'Locked', sub: 'Not immediately available (e.g. FD / PF)', icon: 'lock' },
  restricted: { label: 'Restricted', sub: 'Conditional access only', icon: 'shield-alert-outline' },
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

export default function AssetsScreen() {
  const navigation = useNavigation<any>();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [saving, setSaving] = useState(false);

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
    } catch (err: any) {
      console.error('Failed to fetch assets:', err);
      Alert.alert('Error', 'Unable to load financial assets. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchAssets();
  };

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
    setAnnualReturnRate(
      ast.annualReturnRate !== undefined && ast.annualReturnRate !== null
        ? String(ast.annualReturnRate > 1 ? ast.annualReturnRate : ast.annualReturnRate * 100)
        : ''
    );
    setAssetClass(ast.assetClass);
    setIncludedInFireCorpus(ast.includedInFireCorpus);
    setLiquidity(ast.liquidity || 'liquid');
    setNotes(ast.notes || '');
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
    if (!name.trim()) {
      Alert.alert('Validation Error', 'Please enter an asset name.');
      return;
    }
    const finalType = assetType === 'Other' ? customType.trim() : assetType;
    if (!finalType) {
      Alert.alert('Validation Error', 'Please select or specify an asset type.');
      return;
    }
    const val = parseFloat(currentValue);
    if (isNaN(val) || val < 0) {
      Alert.alert('Validation Error', 'Please enter a valid non-negative current value.');
      return;
    }
    if (assetClass === 'NON_INVESTABLE' && includedInFireCorpus) {
      Alert.alert('Validation Error', 'Non-investable assets cannot be included in your FIRE corpus.');
      return;
    }

    let parsedRate: number | null = null;
    if (annualReturnRate.trim() !== '') {
      const rateNum = parseFloat(annualReturnRate.trim());
      if (isNaN(rateNum) || rateNum < 0 || rateNum > 100) {
        Alert.alert('Validation Error', 'Annual return / interest rate must be a valid number between 0% and 100%.');
        return;
      }
      parsedRate = rateNum > 1 ? rateNum / 100 : rateNum;
    }

    setSaving(true);
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

      if (editingAsset) {
        await updateAsset(editingAsset.id, payload);
      } else {
        await createAsset(payload);
      }
      setModalVisible(false);
      fetchAssets();
    } catch (err: any) {
      console.error('Failed to save asset:', err);
      const msg = err.response?.data?.error || 'Failed to save asset. Please verify inputs.';
      Alert.alert('Error', msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (ast: Asset) => {
    Alert.alert(
      'Delete Asset',
      `Are you sure you want to remove "${ast.name}"? This will update your future net worth and retirement projections.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAsset(ast.id);
              fetchAssets();
            } catch (err: any) {
              console.error('Failed to delete asset:', err);
              Alert.alert('Error', 'Failed to delete asset.');
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

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          accessibilityLabel="Go back"
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color="#F8FAFC" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Financial Assets</Text>
          <Text style={styles.headerSubtitle}>Investable wealth, deposits & liquidity</Text>
        </View>
        <TouchableOpacity
          style={styles.addHeaderBtn}
          onPress={openAddModal}
          accessibilityLabel="Add new asset"
        >
          <MaterialCommunityIcons name="plus" size={22} color="#38BDF8" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#38BDF8" />}
      >
        {/* Summary Metrics */}
        <View style={styles.metricsContainer}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Total Recorded Assets</Text>
            <Text style={styles.metricValue}>{formatINR(totalAssets)}</Text>
            <Text style={styles.metricSub}>{assets.length} total holdings</Text>
          </View>

          <View style={styles.dualMetricRow}>
            <View style={[styles.metricCardMini, { borderColor: '#10B98140' }]}>
              <View style={styles.miniHeader}>
                <MaterialCommunityIcons name="shield-star" size={16} color="#10B981" />
                <Text style={[styles.metricLabelMini, { color: '#10B981' }]}>FIRE Corpus</Text>
              </View>
              <Text style={styles.metricValueMini}>{formatINR(fireInvestableCorpus)}</Text>
              <Text style={styles.metricSubMini}>Starting retirement capital</Text>
            </View>

            <View style={[styles.metricCardMini, { borderColor: '#38BDF840' }]}>
              <View style={styles.miniHeader}>
                <MaterialCommunityIcons name="water" size={16} color="#38BDF8" />
                <Text style={[styles.metricLabelMini, { color: '#38BDF8' }]}>Liquid Buffer</Text>
              </View>
              <Text style={styles.metricValueMini}>{formatINR(liquidEmergencyBuffer)}</Text>
              <Text style={styles.metricSubMini}>Emergency reserves</Text>
            </View>
          </View>
        </View>

        {/* Assets Section */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Your Holdings</Text>
          <TouchableOpacity onPress={openAddModal} style={styles.inlineAddBtn}>
            <MaterialCommunityIcons name="plus-circle" size={16} color="#38BDF8" />
            <Text style={styles.inlineAddText}>Add Asset</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#38BDF8" style={{ marginTop: 40 }} />
        ) : assets.length === 0 ? (
          <View style={styles.emptyCard}>
            <MaterialCommunityIcons name="bank-plus" size={48} color="#64748B" />
            <Text style={styles.emptyTitle}>No assets added yet</Text>
            <Text style={styles.emptyText}>
              Add your Fixed Deposits, mutual funds, EPF/PPF, bank accounts, or gold to power accurate FIRE
              predictability and emergency buffer insights.
            </Text>
            <TouchableOpacity style={styles.emptyCtaBtn} onPress={openAddModal}>
              <Text style={styles.emptyCtaText}>+ Add First Asset</Text>
            </TouchableOpacity>
          </View>
        ) : (
          assets.map((ast) => {
            const classConfig = ASSET_CLASS_MAP[ast.assetClass] || ASSET_CLASS_MAP.FIRE_INVESTABLE;
            const liqConfig = LIQUIDITY_MAP[ast.liquidity || 'liquid'] || LIQUIDITY_MAP.liquid;

            return (
              <View key={ast.id} style={styles.assetCard}>
                <View style={styles.assetCardTop}>
                  <View style={styles.assetTitleBlock}>
                    <Text style={styles.assetName}>{ast.name}</Text>
                    <Text style={styles.assetType}>{ast.assetType}</Text>
                  </View>
                  <Text style={styles.assetValue}>{formatINR(ast.currentValue)}</Text>
                </View>

                {/* Badges */}
                <View style={styles.badgeRow}>
                  <View style={[styles.classBadge, { backgroundColor: classConfig.bg }]}>
                    <Text style={[styles.classBadgeText, { color: classConfig.color }]}>
                      {classConfig.label}
                    </Text>
                  </View>

                  {ast.includedInFireCorpus && ast.assetClass !== 'NON_INVESTABLE' ? (
                    <View style={[styles.statusBadge, { backgroundColor: '#10B98120' }]}>
                      <MaterialCommunityIcons name="check-circle" size={12} color="#10B981" />
                      <Text style={[styles.statusBadgeText, { color: '#10B981' }]}>FIRE Corpus</Text>
                    </View>
                  ) : (
                    <View style={[styles.statusBadge, { backgroundColor: '#33415560' }]}>
                      <Text style={[styles.statusBadgeText, { color: '#94A3B8' }]}>Excluded from FIRE</Text>
                    </View>
                  )}

                  <View style={[styles.statusBadge, { backgroundColor: '#38BDF820' }]}>
                    <MaterialCommunityIcons name={liqConfig.icon as any} size={12} color="#38BDF8" />
                    <Text style={[styles.statusBadgeText, { color: '#38BDF8' }]}>{liqConfig.label}</Text>
                  </View>

                  {ast.annualReturnRate !== undefined && ast.annualReturnRate !== null ? (
                    <View style={[styles.statusBadge, { backgroundColor: '#10B98120' }]}>
                      <MaterialCommunityIcons name="trending-up" size={12} color="#10B981" />
                      <Text style={[styles.statusBadgeText, { color: '#10B981' }]}>
                        {ast.assetType.toLowerCase().includes('deposit') || ast.assetType.toLowerCase().includes('fd') || ast.assetType.toLowerCase().includes('rd') ? 'Interest: ' : 'Return: '}
                        {(ast.annualReturnRate > 1 ? ast.annualReturnRate : ast.annualReturnRate * 100).toFixed(2)}% p.a.
                      </Text>
                    </View>
                  ) : null}
                </View>

                {ast.notes ? <Text style={styles.assetNotes}>{ast.notes}</Text> : null}

                {/* Actions */}
                <View style={styles.cardActionRow}>
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => openEditModal(ast)}
                    accessibilityLabel={`Edit ${ast.name}`}
                  >
                    <MaterialCommunityIcons name="pencil-outline" size={16} color="#94A3B8" />
                    <Text style={styles.actionBtnText}>Edit</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => handleDelete(ast)}
                    accessibilityLabel={`Delete ${ast.name}`}
                  >
                    <MaterialCommunityIcons name="trash-can-outline" size={16} color="#EF4444" />
                    <Text style={[styles.actionBtnText, { color: '#EF4444' }]}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Add / Edit Asset Modal */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingAsset ? 'Edit Financial Asset' : 'Add Financial Asset'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <MaterialCommunityIcons name="close" size={24} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalForm}>
              {/* Asset Name */}
              <Text style={styles.fieldLabel}>Asset Name / Description *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. HDFC Fixed Deposit, Nifty 50 Fund"
                placeholderTextColor="#64748B"
                value={name}
                onChangeText={setName}
              />

              {/* Asset Type Presets */}
              <Text style={styles.fieldLabel}>Asset Type</Text>
              <View style={styles.presetChipWrap}>
                {ASSET_TYPE_PRESETS.map((preset) => (
                  <TouchableOpacity
                    key={preset}
                    style={[styles.presetChip, assetType === preset && styles.presetChipActive]}
                    onPress={() => handleTypeSelect(preset)}
                  >
                    <Text
                      style={[
                        styles.presetChipText,
                        assetType === preset && styles.presetChipTextActive,
                      ]}
                    >
                      {preset}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {assetType === 'Other' ? (
                <TextInput
                  style={[styles.input, { marginTop: 8 }]}
                  placeholder="Enter custom asset type"
                  placeholderTextColor="#64748B"
                  value={customType}
                  onChangeText={setCustomType}
                />
              ) : null}

              {/* Current Value */}
              <Text style={styles.fieldLabel}>Current Value (₹) *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 1000000"
                placeholderTextColor="#64748B"
                keyboardType="numeric"
                value={currentValue}
                onChangeText={setCurrentValue}
              />

              {/* Annual Return / Interest Rate */}
              {(() => {
                const rateInfo = getRateLabel(assetType === 'Other' ? customType : assetType);
                return (
                  <View style={{ marginTop: 12 }}>
                    <Text style={styles.fieldLabel}>{rateInfo.label}</Text>
                    <TextInput
                      style={styles.input}
                      placeholder={rateInfo.placeholder}
                      placeholderTextColor="#64748B"
                      keyboardType="numeric"
                      value={annualReturnRate}
                      onChangeText={setAnnualReturnRate}
                    />
                  </View>
                );
              })()}

              {/* Asset Class */}
              <Text style={styles.fieldLabel}>Planning Classification</Text>
              {(['FIRE_INVESTABLE', 'SEMI_LIQUID', 'NON_INVESTABLE'] as AssetClass[]).map((cls) => {
                const conf = ASSET_CLASS_MAP[cls];
                const isSelected = assetClass === cls;
                return (
                  <TouchableOpacity
                    key={cls}
                    style={[styles.radioCard, isSelected && styles.radioCardActive]}
                    onPress={() => handleClassChange(cls)}
                  >
                    <MaterialCommunityIcons
                      name={isSelected ? 'radiobox-marked' : 'radiobox-blank'}
                      size={20}
                      color={isSelected ? '#38BDF8' : '#64748B'}
                    />
                    <View style={styles.radioTextWrap}>
                      <Text style={[styles.radioTitle, isSelected && { color: '#F8FAFC' }]}>
                        {conf.label}
                      </Text>
                      <Text style={styles.radioSub}>{conf.sub}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}

              {/* Count toward FIRE Toggle */}
              {assetClass !== 'NON_INVESTABLE' ? (
                <TouchableOpacity
                  style={styles.toggleRow}
                  onPress={() => setIncludedInFireCorpus(!includedInFireCorpus)}
                >
                  <MaterialCommunityIcons
                    name={includedInFireCorpus ? 'checkbox-marked' : 'checkbox-blank-outline'}
                    size={22}
                    color={includedInFireCorpus ? '#10B981' : '#64748B'}
                  />
                  <View style={styles.toggleTextWrap}>
                    <Text style={styles.toggleTitle}>Count toward FIRE Corpus</Text>
                    <Text style={styles.toggleSub}>
                      Treated as wealth available for retirement portfolio compounding.
                    </Text>
                  </View>
                </TouchableOpacity>
              ) : (
                <View style={styles.infoBanner}>
                  <MaterialCommunityIcons name="information-outline" size={18} color="#94A3B8" />
                  <Text style={styles.infoBannerText}>
                    Non-investable assets (e.g. primary home) represent net worth but cannot be drawn down for retirement spending.
                  </Text>
                </View>
              )}

              {/* Liquidity */}
              <Text style={styles.fieldLabel}>Liquidity / Emergency Buffer Status</Text>
              {(['liquid', 'locked', 'restricted'] as AssetLiquidity[]).map((liq) => {
                const conf = LIQUIDITY_MAP[liq];
                const isSelected = liquidity === liq;
                return (
                  <TouchableOpacity
                    key={liq}
                    style={[styles.radioCard, isSelected && styles.radioCardActive]}
                    onPress={() => setLiquidity(liq)}
                  >
                    <MaterialCommunityIcons
                      name={isSelected ? 'radiobox-marked' : 'radiobox-blank'}
                      size={20}
                      color={isSelected ? '#38BDF8' : '#64748B'}
                    />
                    <View style={styles.radioTextWrap}>
                      <Text style={[styles.radioTitle, isSelected && { color: '#F8FAFC' }]}>
                        {conf.label}
                      </Text>
                      <Text style={styles.radioSub}>{conf.sub}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}

              {/* Notes */}
              <Text style={styles.fieldLabel}>Notes (Optional)</Text>
              <TextInput
                style={[styles.input, { height: 60 }]}
                placeholder="e.g. Matures in 2028, 7.2% annual interest"
                placeholderTextColor="#64748B"
                multiline
                value={notes}
                onChangeText={setNotes}
              />

              {/* Action Buttons */}
              <View style={styles.modalBtnRow}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                  onPress={handleSave}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color="#0F172A" />
                  ) : (
                    <Text style={styles.saveBtnText}>Save Asset</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B132B',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    backgroundColor: '#0F172A',
  },
  backBtn: {
    padding: 6,
  },
  headerTitleContainer: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 1,
  },
  addHeaderBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#38BDF820',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  metricsContainer: {
    marginBottom: 20,
  },
  metricCard: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  metricLabel: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '500',
  },
  metricValue: {
    fontSize: 26,
    fontWeight: '800',
    color: '#F8FAFC',
    marginVertical: 4,
  },
  metricSub: {
    fontSize: 12,
    color: '#64748B',
  },
  dualMetricRow: {
    flexDirection: 'row',
    gap: 10,
  },
  metricCardMini: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
  },
  miniHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metricLabelMini: {
    fontSize: 12,
    fontWeight: '600',
  },
  metricValueMini: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F8FAFC',
    marginVertical: 4,
  },
  metricSubMini: {
    fontSize: 11,
    color: '#64748B',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  inlineAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  inlineAddText: {
    fontSize: 13,
    color: '#38BDF8',
    fontWeight: '600',
  },
  emptyCard: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#334155',
    borderStyle: 'dashed',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
    marginTop: 12,
  },
  emptyText: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
    paddingHorizontal: 8,
  },
  emptyCtaBtn: {
    marginTop: 16,
    backgroundColor: '#38BDF8',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
  emptyCtaText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  assetCard: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  assetCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  assetTitleBlock: {
    flex: 1,
    marginRight: 8,
  },
  assetName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  assetType: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  assetValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  classBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  classBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  assetNotes: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 8,
    fontStyle: 'italic',
  },
  cardActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 16,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#33415550',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    borderWidth: 1,
    borderColor: '#334155',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  modalForm: {
    padding: 18,
    paddingBottom: 40,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94A3B8',
    marginTop: 14,
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#F8FAFC',
  },
  presetChipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  presetChip: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  presetChipActive: {
    backgroundColor: '#38BDF820',
    borderColor: '#38BDF8',
  },
  presetChipText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  presetChipTextActive: {
    color: '#38BDF8',
    fontWeight: '600',
  },
  radioCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 10,
    padding: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  radioCardActive: {
    borderColor: '#38BDF8',
    backgroundColor: '#0C4A6E20',
  },
  radioTextWrap: {
    marginLeft: 10,
    flex: 1,
  },
  radioTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94A3B8',
  },
  radioSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 10,
    padding: 12,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  toggleTextWrap: {
    marginLeft: 10,
    flex: 1,
  },
  toggleTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#F8FAFC',
  },
  toggleSub: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  infoBanner: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    borderRadius: 8,
    padding: 10,
    marginVertical: 8,
    gap: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  infoBannerText: {
    flex: 1,
    fontSize: 11,
    color: '#94A3B8',
    lineHeight: 16,
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#1E293B',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94A3B8',
  },
  saveBtn: {
    flex: 1,
    backgroundColor: '#38BDF8',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
});
