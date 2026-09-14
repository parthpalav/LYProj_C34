import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FamilyDashboard } from '../../types';

// ── Design Tokens ──────────────────────────────────────────
const BLUE = '#2563EB';
const GREEN = '#10B981';
const AMBER = '#F59E0B';
const PURPLE = '#7C3AED';
const PURPLE_LIGHT = '#F3E8FF';
const DARK = '#0F172A';
const GRAY_600 = '#475569';
const GRAY_400 = '#94A3B8';
const BORDER = '#E2E8F0';
const BG_CARD = '#FFFFFF';
const BG_SUBTLE = '#F8FAFC';

// ── Formatting Helpers ─────────────────────────────────────
function formatCurrency(n: number | null | undefined): string {
  if (n === null || n === undefined || isNaN(n)) return '₹0';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Math.round(n));
}

function getFmiBadge(score: number, fallbackLabel?: string): { text: string; bg: string; border: string; label: string } {
  const label = fallbackLabel || (
    score >= 80 ? 'Excellent' :
    score >= 65 ? 'Good' :
    score >= 50 ? 'Fair' :
    score >= 35 ? 'Needs Attention' : 'Critical'
  );
  if (score >= 80) return { text: '#059669', bg: '#ECFDF5', border: '#A7F3D0', label };
  if (score >= 65) return { text: '#10B981', bg: '#ECFDF5', border: '#A7F3D0', label };
  if (score >= 50) return { text: '#D97706', bg: '#FFFBEB', border: '#FDE68A', label };
  if (score >= 35) return { text: '#F59E0B', bg: '#FFFBEB', border: '#FDE68A', label };
  return { text: '#DC2626', bg: '#FEF2F2', border: '#FECACA', label };
}

export interface FamilyOverviewCardProps {
  dashboard: FamilyDashboard;
  onPressViewDetails: () => void;
}

export function FamilyOverviewCard({
  dashboard,
  onPressViewDetails,
}: FamilyOverviewCardProps): React.ReactElement {
  const fmi = dashboard?.fmi;
  const fmiScore = fmi?.score ?? 0;
  const badge = getFmiBadge(fmiScore, fmi?.fmiLabel);
  const memberCount = dashboard?.family?.memberCount || dashboard?.family?.members?.length || 2;
  const firstInsight = fmi?.insights && fmi.insights.length > 0 ? fmi.insights[0] : null;

  const accessibleCardLabel = `Household Financial Maturity Index, ${Math.round(fmiScore)} out of 100, ${badge.label}. Combined view of your Family's finances. View Family Details.`;

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.88}
      onPress={onPressViewDetails}
      accessibilityRole="button"
      accessibilityLabel={accessibleCardLabel}
    >
      {/* ── 1. Card Header ─────────────────────────────────── */}
      <View style={styles.cardHeader}>
        <View style={styles.titleRow}>
          <View style={styles.iconBadge}>
            <Ionicons name="people" size={18} color={PURPLE} />
          </View>
          <View style={styles.headerTextWrap}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              Household Overview
            </Text>
            <Text style={styles.cardSubtitle} numberOfLines={1}>
              Combined view of your Family's finances
            </Text>
          </View>
        </View>
        <View style={styles.memberPill}>
          <Ionicons name="people-outline" size={12} color={PURPLE} />
          <Text style={styles.memberPillText} numberOfLines={1}>
            {memberCount} Members
          </Text>
        </View>
      </View>

      {/* ── 2. Household FMI Mini-Widget ───────────────────── */}
      <View style={styles.fmiContainer}>
        <View style={styles.fmiHeader}>
          <View style={styles.fmiLabelWrap}>
            <Text style={styles.fmiLabel}>Household FMI</Text>
            <Text style={styles.fmiSubLabel}>Financial Maturity Index</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: badge.bg, borderColor: badge.border }]}>
            <Text style={[styles.statusBadgeText, { color: badge.text }]} numberOfLines={1}>
              {badge.label}
            </Text>
          </View>
        </View>

        <View style={styles.fmiScoreRow}>
          <View style={styles.fmiScoreWrap}>
            <Text
              style={[styles.fmiScoreNumber, { color: badge.text }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
            >
              {Math.round(fmiScore)}
            </Text>
            <Text style={styles.fmiScoreDenominator}>/100</Text>
          </View>
          <View style={styles.fmiDescWrap}>
            <Text style={styles.fmiDescText} numberOfLines={2}>
              Based on combined household saving, spending and behavioural patterns.
            </Text>
          </View>
        </View>
      </View>

      {/* ── 3. 2x2 Household Financial Metrics Grid ────────── */}
      <View style={styles.metricsGrid}>
        {/* Metric 1: Effective Monthly Income */}
        <View style={styles.metricCell}>
          <Text style={styles.metricLabel} numberOfLines={1}>Household Income</Text>
          <Text
            style={[styles.metricValue, { color: DARK }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
          >
            {formatCurrency(dashboard.income?.effectiveMonthlyIncome)}
          </Text>
          <Text style={styles.metricCaption} numberOfLines={1}>Effective monthly</Text>
        </View>

        {/* Metric 2: Household Spending (Need + Want only) */}
        <View style={styles.metricCell}>
          <Text style={styles.metricLabel} numberOfLines={1}>Household Spending</Text>
          <Text
            style={[styles.metricValue, { color: AMBER }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
          >
            {formatCurrency(dashboard.spending?.totalNonInvestment)}
          </Text>
          <Text style={styles.metricCaption} numberOfLines={1}>Need + Want spend</Text>
        </View>

        {/* Metric 3: Invested This Month */}
        <View style={styles.metricCell}>
          <Text style={styles.metricLabel} numberOfLines={1}>Invested This Month</Text>
          <Text
            style={[styles.metricValue, { color: PURPLE }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
          >
            {formatCurrency(dashboard.investments?.monthlyFlow)}
          </Text>
          <Text style={styles.metricCaption} numberOfLines={1}>
            {dashboard.investments?.investmentRatePercent != null
              ? `${dashboard.investments.investmentRatePercent}% of income`
              : 'Monthly flow'}
          </Text>
        </View>

        {/* Metric 4: Net Cash Position */}
        <View style={styles.metricCell}>
          <Text style={styles.metricLabel} numberOfLines={1}>Net Cash Position</Text>
          <Text
            style={[
              styles.metricValue,
              { color: (dashboard.cashFlow?.netCashPosition ?? 0) >= 0 ? GREEN : '#DC2626' },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
          >
            {formatCurrency(dashboard.cashFlow?.netCashPosition)}
          </Text>
          <Text style={styles.metricCaption} numberOfLines={1}>Monthly surplus</Text>
        </View>
      </View>

      {/* ── 4. Household Insight Preview (at most 1) ────────── */}
      {firstInsight && (
        <View style={styles.insightBanner}>
          <View style={styles.insightIconBadge}>
            <Ionicons name="bulb-outline" size={15} color={AMBER} />
          </View>
          <View style={styles.insightTextWrap}>
            <Text style={styles.insightTitle}>Household Insight</Text>
            <Text style={styles.insightText} numberOfLines={2}>
              {firstInsight}
            </Text>
          </View>
        </View>
      )}

      {/* ── 5. Action Footer ───────────────────────────────── */}
      <View style={styles.actionRow}>
        <Text style={styles.actionLink}>View Family Details</Text>
        <Ionicons name="chevron-forward" size={14} color={BLUE} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: BG_CARD,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  iconBadge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: PURPLE_LIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextWrap: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: DARK,
    letterSpacing: -0.2,
  },
  cardSubtitle: {
    fontSize: 11,
    color: GRAY_600,
    marginTop: 1,
  },
  memberPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: PURPLE_LIGHT,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  memberPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: PURPLE,
  },
  fmiContainer: {
    backgroundColor: BG_SUBTLE,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: BORDER,
  },
  fmiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  fmiLabelWrap: {
    flex: 1,
  },
  fmiLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: DARK,
  },
  fmiSubLabel: {
    fontSize: 10,
    color: GRAY_400,
    marginTop: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  fmiScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  fmiScoreWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  fmiScoreNumber: {
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -1,
  },
  fmiScoreDenominator: {
    fontSize: 12,
    fontWeight: '600',
    color: GRAY_400,
    marginLeft: 2,
  },
  fmiDescWrap: {
    flex: 1,
  },
  fmiDescText: {
    fontSize: 11,
    color: GRAY_600,
    lineHeight: 15,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  metricCell: {
    flex: 1,
    minWidth: '46%',
    backgroundColor: BG_SUBTLE,
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: BORDER,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: GRAY_600,
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  metricCaption: {
    fontSize: 10,
    color: GRAY_400,
    marginTop: 2,
  },
  insightBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#FFFBEB',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginBottom: 12,
  },
  insightIconBadge: {
    marginTop: 1,
  },
  insightTextWrap: {
    flex: 1,
  },
  insightTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#92400E',
    marginBottom: 2,
  },
  insightText: {
    fontSize: 11,
    color: '#78350F',
    lineHeight: 15,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    paddingTop: 4,
  },
  actionLink: {
    fontSize: 12,
    fontWeight: '600',
    color: BLUE,
  },
});
