/**
 * client/src/screens/FinancialOutlookScreen.tsx
 * 
 * Deterministic + Probabilistic Financial Outlook & Predictability Screen for FINAURA.
 * Read-only frontend view consuming backend GET /api/predictability.
 * 
 * Invariants:
 *  - Zero client-side financial recalculations (all formulas computed on backend).
 *  - Neutral, non-punitive presentation of irregular income & high CV.
 *  - Strict visual separation between estimated FIRE target and user-entered goal.
 *  - Honest presentation of data limitations and explicit model assumptions.
 *  - Progressive disclosure of probabilistic simulation and risk metrics.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { getPredictability } from '../services/api';
import { PredictabilitySnapshot } from '../types';

const { width: SCREEN_W } = Dimensions.get('window');

// ── Color Tokens ──────────────────────────────────────────────
const PRIMARY = '#3B3BDE';
const SUCCESS = '#10B981';
const WARNING = '#F59E0B';
const PURPLE  = '#7C3AED';
const SLATE   = '#64748B';
const DARK    = '#0F172A';
const MUTED   = '#6B7280';
const BORDER  = '#E2E8F0';
const CARD_BG = '#FFFFFF';
const APP_BG  = '#F8FAFC';

// ── Indian Currency Formatter ──────────────────────────────────
function formatCurrency(amount: number | null | undefined, compact = false): string {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) {
    return '—';
  }
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';

  if (compact) {
    if (abs >= 10000000) {
      return `${sign}₹${(abs / 10000000).toFixed(2)} Cr`;
    }
    if (abs >= 100000) {
      return `${sign}₹${(abs / 100000).toFixed(2)} L`;
    }
  }

  return `${sign}₹${Math.round(abs).toLocaleString('en-IN')}`;
}

function formatPercent(ratio: number | null | undefined): string {
  if (ratio === null || ratio === undefined || !Number.isFinite(ratio)) return '—';
  return `${(ratio * 100).toFixed(1)}%`;
}

function formatPercentInt(ratio: number | null | undefined): string {
  if (ratio === null || ratio === undefined || !Number.isFinite(ratio)) return '—';
  return `${Math.round(ratio * 100)}%`;
}

function formatAge(ageYears: number | null | undefined): string {
  if (ageYears === null || ageYears === undefined || !Number.isFinite(ageYears)) return '—';
  const wholeYears = Math.floor(ageYears);
  const months = Math.round((ageYears - wholeYears) * 12);
  if (months === 0 || months === 12) {
    return `Age ${months === 12 ? wholeYears + 1 : wholeYears}`;
  }
  return `Age ${wholeYears}y ${months}m`;
}

// ── Human Explanation Facts Mapping ────────────────────────────
function mapFactToMessage(code: string, value?: any): { title: string; desc: string; icon: keyof typeof Ionicons.glyphMap; color: string } {
  switch (code) {
    case 'INCOME_VARIABILITY_ZERO':
      return {
        title: 'Consistent Income',
        desc: 'Your recorded income has been completely steady across observed months.',
        icon: 'checkmark-circle-outline',
        color: SUCCESS
      };
    case 'INCOME_VARIABILITY_LOW':
      return {
        title: 'Low Income Variability',
        desc: 'Your monthly earnings show stable, predictable patterns.',
        icon: 'shield-checkmark-outline',
        color: SUCCESS
      };
    case 'INCOME_VARIABILITY_MODERATE':
      return {
        title: 'Moderate Income Variability',
        desc: 'Earnings fluctuate moderately across calendar months.',
        icon: 'analytics-outline',
        color: WARNING
      };
    case 'INCOME_VARIABILITY_HIGH':
      return {
        title: 'Variable Income Pattern',
        desc: 'Earnings vary substantially between months; planning uses conservative floor estimation.',
        icon: 'pulse-outline',
        color: PURPLE
      };
    case 'ESSENTIALS_COVERED_BY_CONSERVATIVE_INCOME':
      return {
        title: 'Essentials Covered',
        desc: 'Your 25th-percentile conservative income estimate safely covers essential outflows.',
        icon: 'checkmark-done-circle-outline',
        color: SUCCESS
      };
    case 'ESSENTIALS_UNCOVERED_BY_CONSERVATIVE_INCOME':
      return {
        title: 'Essentials Coverage Gap',
        desc: 'In lean months, baseline earnings fall below current essential spending needs.',
        icon: 'alert-circle-outline',
        color: WARNING
      };
    case 'BUFFER_RUNWAY_ADEQUATE':
      return {
        title: 'Adequate Buffer Runway',
        desc: 'Your recorded liquid reserves provide 3+ months of essential expenditure runway.',
        icon: 'shield-outline',
        color: SUCCESS
      };
    case 'BUFFER_RUNWAY_LOW':
      return {
        title: 'Buffer Runway Under 3 Months',
        desc: 'Current liquid emergency reserves cover less than 3 months of essential outflows.',
        icon: 'warning-outline',
        color: WARNING
      };
    case 'RETIREMENT_ON_TRACK':
      return {
        title: 'Retirement On Track',
        desc: 'Projected corpus at retirement meets or exceeds the estimated FIRE target under model assumptions.',
        icon: 'trending-up-outline',
        color: SUCCESS
      };
    case 'RETIREMENT_CONTRIBUTION_GAP':
      return {
        title: 'Modeled Contribution Gap',
        desc: 'Observed monthly investment is below the fixed amount modeled to reach the FIRE target.',
        icon: 'information-circle-outline',
        color: PRIMARY
      };
    case 'EMERGENCY_FUND_FULLY_FUNDED':
      return {
        title: 'Emergency Reserve Fully Funded',
        desc: 'Recorded liquid assets fully satisfy the target emergency fund duration.',
        icon: 'lock-closed-outline',
        color: SUCCESS
      };
    case 'EMERGENCY_FUND_DEFICIT':
      return {
        title: 'Emergency Fund In Progress',
        desc: 'Additional liquid buffer needed to reach your full emergency reserve target.',
        icon: 'hourglass-outline',
        color: WARNING
      };
    case 'PORTFOLIO_RISK_ESTIMATED':
      return {
        title: 'Forecast Risk Assumption',
        desc: 'Market variability is estimated from your expected return because portfolio allocation data is not yet recorded.',
        icon: 'git-branch-outline',
        color: SLATE
      };
    case 'MONTE_CARLO_AVAILABLE':
      return {
        title: 'Probabilistic Engine Active',
        desc: '10,000 future market paths simulated under current financial assumptions.',
        icon: 'sparkles-outline',
        color: PRIMARY
      };
    case 'MONTE_CARLO_PROBABILITY_FUNDED':
      return {
        title: 'Modeled Funding Chance',
        desc: 'Estimated probability of reaching retirement target corpus under market dispersion.',
        icon: 'pie-chart-outline',
        color: PRIMARY
      };
    case 'MONTE_CARLO_DATA_QUALITY_LOW':
      return {
        title: 'Preliminary Forecast Baseline',
        desc: 'Projections are based on early history and will calibrate as more months are observed.',
        icon: 'time-outline',
        color: WARNING
      };
    case 'MONTE_CARLO_UNAVAILABLE':
      return {
        title: 'Simulation Notice',
        desc: 'Probability-based forecast is temporarily unavailable; baseline projections remain active.',
        icon: 'alert-circle-outline',
        color: SLATE
      };
    default:
      return {
        title: 'Financial Observation',
        desc: `System note: ${code}`,
        icon: 'information-circle-outline',
        color: SLATE
      };
  }
}

export function FinancialOutlookScreen(): React.ReactElement {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  const [snapshot, setSnapshot] = useState<PredictabilitySnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAssumptions, setShowAssumptions] = useState(false);
  const [showAdvancedMc, setShowAdvancedMc] = useState(false);
  const [selectedScenarioKey, setSelectedScenarioKey] = useState<'conservative' | 'base' | 'optimistic'>('base');

  const fetchOutlook = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const data = await getPredictability();
      setSnapshot(data);
    } catch (err: any) {
      console.error('Failed to fetch predictability snapshot:', err);
      setError(err?.response?.data?.message || err?.message || 'Unable to load your financial outlook.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchOutlook();
  }, [fetchOutlook]);

  // ── Loading View ───────────────────────────────────────────
  if (loading && !snapshot) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={DARK} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Financial Outlook</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={PRIMARY} />
          <Text style={styles.loadingText}>Generating financial projections...</Text>
        </View>
      </View>
    );
  }

  // ── Error View ─────────────────────────────────────────────
  if (error && !snapshot) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={DARK} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Financial Outlook</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.centerContainer}>
          <Ionicons name="alert-circle-outline" size={54} color={WARNING} />
          <Text style={styles.errorTitle}>Unable to Load Outlook</Text>
          <Text style={styles.errorSubtitle}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => fetchOutlook()}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (!snapshot) return <View style={styles.container} />;

  // ── Destructure Snapshot ───────────────────────────────────
  const {
    currentState,
    income,
    resilience,
    assets,
    liabilities,
    emergencyFund,
    retirement,
    dataQuality,
    explanationFacts,
    limitations,
    probabilistic
  } = snapshot;

  // Target coverage progress calculation (pure presentation helper)
  const targetCoveragePct = (retirement?.estimatedFireCorpus ?? 0) > 0 && retirement?.projectedCorpusAtRetirement !== null
    ? Math.min(100, Math.max(0, Math.round((retirement!.projectedCorpusAtRetirement! / retirement!.estimatedFireCorpus) * 100)))
    : 0;

  // Income variability display label
  let variabilityLabel = 'Stable';
  let variabilityColor = SUCCESS;
  if (income.coefficientOfVariation === null) {
    variabilityLabel = 'Insufficient Data';
    variabilityColor = MUTED;
  } else if (income.coefficientOfVariation >= 0.5) {
    variabilityLabel = 'Variable';
    variabilityColor = PURPLE;
  } else if (income.coefficientOfVariation >= 0.2) {
    variabilityLabel = 'Moderate';
    variabilityColor = WARNING;
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* ── Top Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color={DARK} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Financial Outlook</Text>
          <Text style={styles.headerSubtitle}>Forecast & Predictability</Text>
        </View>
        <TouchableOpacity onPress={() => fetchOutlook(true)} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="refresh" size={20} color={PRIMARY} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchOutlook(true)} tintColor={PRIMARY} />}
        showsVerticalScrollIndicator={false}
      >
        {/* ══════════════════════════════════════════════════════
            SECTION A: HEADLINE SNAPSHOT CARDS
        ══════════════════════════════════════════════════════ */}
        <View style={styles.headlineGrid}>
          <View style={[styles.headlineCard, { borderLeftColor: PRIMARY, borderLeftWidth: 4 }]}>
            <Text style={styles.headlineLabel}>Projected Corpus</Text>
            <Text style={styles.headlineValue}>
              {retirement ? formatCurrency(retirement.projectedCorpusAtRetirement, true) : '—'}
            </Text>
            <Text style={styles.headlineSub}>at retirement age</Text>
          </View>

          <View style={[styles.headlineCard, { borderLeftColor: PURPLE, borderLeftWidth: 4 }]}>
            <Text style={styles.headlineLabel}>Estimated FIRE Target</Text>
            <Text style={styles.headlineValue}>
              {retirement ? formatCurrency(retirement.estimatedFireCorpus, true) : '—'}
            </Text>
            <Text style={styles.headlineSub}>lifestyle sustain basis</Text>
          </View>

          <View style={[styles.headlineCard, { borderLeftColor: SUCCESS, borderLeftWidth: 4 }]}>
            <Text style={styles.headlineLabel}>Emergency Runway</Text>
            <Text style={styles.headlineValue}>
              {resilience.bufferRunwayMonths !== null ? `${resilience.bufferRunwayMonths.toFixed(1)} mo` : '—'}
            </Text>
            <Text style={styles.headlineSub}>recorded liquid buffer</Text>
          </View>

          <View style={[styles.headlineCard, { borderLeftColor: WARNING, borderLeftWidth: 4 }]}>
            <Text style={styles.headlineLabel}>Essentials Coverage</Text>
            <Text style={styles.headlineValue}>
              {resilience.essentialCoverageRatio !== null ? `${resilience.essentialCoverageRatio.toFixed(1)}×` : '—'}
            </Text>
            <Text style={styles.headlineSub}>conservative income floor</Text>
          </View>
        </View>

        {/* ══════════════════════════════════════════════════════
            SECTION B: RETIREMENT & FIRE OUTLOOK (DETERMINISTIC)
        ══════════════════════════════════════════════════════ */}
        {!snapshot.forecastStatus.available ? (
          <View style={[styles.sectionCard, { backgroundColor: '#F8FAFC' }]}>
            <View style={styles.sectionHeader}>
              <Ionicons name="compass-outline" size={22} color={SLATE} />
              <Text style={styles.sectionTitle}>Retirement & FIRE Projection</Text>
            </View>
            <View style={{ paddingVertical: 16 }}>
              <Text style={{ fontSize: 15, color: SLATE, marginBottom: 12 }}>
                We need a little more financial history before we can estimate your FIRE trajectory reliably.
              </Text>
              {snapshot.forecastStatus.missingInputs.map((input, idx) => (
                <Text key={idx} style={{ fontSize: 13, color: WARNING, fontWeight: '600', marginBottom: 4 }}>
                  • {input.replace(/_/g, ' ')}
                </Text>
              ))}
            </View>
          </View>
        ) : retirement && (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Ionicons name="compass-outline" size={22} color={PRIMARY} />
              <Text style={styles.sectionTitle}>Retirement & FIRE Projection</Text>
            </View>

            {/* Progress Bar */}
            <View style={styles.progressContainer}>
              <View style={styles.progressHeaderRow}>
                <Text style={styles.progressLabel}>Projected Target Coverage</Text>
                <Text style={styles.progressPctText}>{targetCoveragePct}%</Text>
              </View>
              <View style={styles.progressBarTrack}>
                <View style={[styles.progressBarFill, { width: `${targetCoveragePct}%`, backgroundColor: targetCoveragePct >= 100 ? SUCCESS : PRIMARY }]} />
              </View>
              <Text style={styles.progressFootnote}>
                Projected real purchasing power vs estimated lifestyle target under model assumptions.
              </Text>
            </View>

            {/* Target Comparison Cards */}
            <View style={styles.comparisonRow}>
              <View style={styles.comparisonBox}>
                <Text style={styles.compBoxLabel}>FINAURA Estimated Target</Text>
                <Text style={styles.compBoxValue}>{formatCurrency(retirement.estimatedFireCorpus, true)}</Text>
                <Text style={styles.compBoxSub}>Based on ₹{(retirement.currentAnnualLifestyleSpending / 12).toFixed(0)}/mo spending</Text>
              </View>

              <View style={styles.comparisonBox}>
                <Text style={styles.compBoxLabel}>Your Retirement Goal</Text>
                <Text style={styles.compBoxValue}>
                  {retirement.userGoalCorpus > 0 ? formatCurrency(retirement.userGoalCorpus, true) : 'Not Set'}
                </Text>
                <Text style={styles.compBoxSub}>Personal target preference</Text>
              </View>
            </View>

            {/* Detail Rows */}
            <View style={styles.detailList}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Current FIRE-Investable Corpus</Text>
                <Text style={styles.detailValue}>{formatCurrency(assets.fireInvestableCorpus)}</Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Observed Monthly Investment</Text>
                <Text style={styles.detailValue}>{formatCurrency(retirement.monthlyContributionUsed)}/mo</Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Modeled Required Contribution</Text>
                <Text style={styles.detailValue}>
                  {retirement.requiredMonthlyContributionForEstimatedFire !== null
                    ? `${formatCurrency(retirement.requiredMonthlyContributionForEstimatedFire)}/mo`
                    : '—'}
                </Text>
              </View>

              {retirement.contributionGap !== null && (
                <View style={styles.detailRowHighlight}>
                  <Text style={styles.detailLabelHighlight}>
                    {retirement.contributionGap > 0 ? 'Modeled Contribution Gap' : 'Contribution Status'}
                  </Text>
                  <Text style={[styles.detailValueHighlight, { color: retirement.contributionGap > 0 ? PRIMARY : SUCCESS }]}>
                    {retirement.contributionGap > 0
                      ? `${formatCurrency(retirement.contributionGap)}/mo`
                      : 'Target Met by Current Outflow'}
                  </Text>
                </View>
              )}

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Timeline Horizon</Text>
                <Text style={styles.detailValue}>
                  {retirement.monthsUntilRetirement !== null
                    ? `${(retirement.monthsUntilRetirement / 12).toFixed(1)} yrs (${retirement.monthsUntilRetirement} mos)`
                    : 'Age missing'}
                </Text>
              </View>

              {retirement.projectedFire.reached && retirement.projectedFire.projectedAge && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Projected Target Timing</Text>
                  <Text style={[styles.detailValue, { color: SUCCESS, fontWeight: '700' }]}>
                    Age {retirement.projectedFire.projectedAge.toFixed(1)} (under baseline model)
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* ══════════════════════════════════════════════════════
            SECTION C: MODELED FUNDING OUTLOOK (MONTE CARLO V1)
        ══════════════════════════════════════════════════════ */}
        {probabilistic?.available && probabilistic.estimatedFire && (() => {
          const ef = probabilistic.estimatedFire;
          const pFunded = ef.probabilityFundedAtTargetAge ?? 0;
          const pFundedPct = Math.round(pFunded * 100);
          const targetAge = retirement?.retirementAge ?? 60;
          const rec = probabilistic.contributionRecommendation;
          const userGoal = probabilistic.userGoal;

          // Semantic band styling (visual support only)
          let bandColor = WARNING;
          let bandLabel = 'Needs Attention';
          if (pFundedPct >= 90) {
            bandColor = SUCCESS;
            bandLabel = 'High Modeled Likelihood';
          } else if (pFundedPct >= 75) {
            bandColor = PURPLE;
            bandLabel = 'Stronger Path';
          } else if (pFundedPct >= 50) {
            bandColor = PRIMARY;
            bandLabel = 'Developing Path';
          }

          return (
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Ionicons name="sparkles-outline" size={22} color={PRIMARY} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionTitle}>Modeled Funding Outlook</Text>
                  <Text style={styles.sectionSubtitle}>
                    10,000 simulated future paths under market variability
                  </Text>
                </View>
              </View>

              {/* 1. Headline Probability Card */}
              <View style={[styles.mcHeadlineCard, { borderLeftColor: bandColor, borderLeftWidth: 4 }]}>
                <View style={styles.mcHeadlineTopRow}>
                  <Text style={styles.mcHeadlineBadgeText}>MODELED CHANCE AT AGE {targetAge}</Text>
                  <View style={[styles.mcBandPill, { backgroundColor: `${bandColor}15` }]}>
                    <Text style={[styles.mcBandPillText, { color: bandColor }]}>{bandLabel}</Text>
                  </View>
                </View>

                <View style={styles.mcProbabilityRow}>
                  <Text style={[styles.mcProbabilityBig, { color: bandColor }]}>{pFundedPct}%</Text>
                  <View style={styles.mcProbabilityTextWrap}>
                    <Text style={styles.mcProbabilityTitle}>
                      {pFundedPct}% modeled chance of being funded by age {targetAge}
                    </Text>
                    <Text style={styles.mcProbabilitySub}>
                      Modeled likelihood of remaining funded for lifestyle needs at your target retirement age.
                    </Text>
                  </View>
                </View>

                {/* Probability Track */}
                <View style={styles.mcProgressTrack}>
                  <View style={[styles.mcProgressFill, { width: `${Math.min(100, Math.max(0, pFundedPct))}%`, backgroundColor: bandColor }]} />
                </View>
              </View>

              {/* 2. Simulated Retirement Outcomes (Median & Middle 50%) */}
              {ef.corpusPercentiles && (
                <View style={styles.mcOutcomeBlock}>
                  <Text style={styles.mcBlockHeader}>Simulated Retirement Outcomes</Text>
                  <View style={styles.comparisonRow}>
                    <View style={styles.comparisonBox}>
                      <Text style={styles.compBoxLabel}>Median Modeled Corpus</Text>
                      <Text style={styles.compBoxValue}>{formatCurrency(ef.corpusPercentiles.p50, true)}</Text>
                      <Text style={styles.compBoxSub}>50th percentile modeled outcome</Text>
                    </View>

                    <View style={styles.comparisonBox}>
                      <Text style={styles.compBoxLabel}>Middle 50% of Simulated Outcomes</Text>
                      <Text style={styles.compBoxValue}>
                        {formatCurrency(ef.corpusPercentiles.p25, true)} – {formatCurrency(ef.corpusPercentiles.p75, true)}
                      </Text>
                      <Text style={styles.compBoxSub}>Between 25th and 75th percentiles</Text>
                    </View>
                  </View>
                </View>
              )}

              {/* 3. Probabilistic FIRE Timing (fundedAge50 & fundedAge75) */}
              <View style={styles.mcTimingBlock}>
                <Text style={styles.mcBlockHeader}>Probabilistic Target Timing</Text>
                <View style={styles.detailList}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>50% Funded-Probability Age</Text>
                    <Text style={[styles.detailValue, { fontWeight: '700', color: ef.fundedAge50?.reached ? PRIMARY : SLATE }]}>
                      {ef.fundedAge50?.reached ? formatAge(ef.fundedAge50.ageYears) : 'Not reached in forecast horizon'}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>75% Funded-Probability Age</Text>
                    <Text style={[styles.detailValue, { fontWeight: '700', color: ef.fundedAge75?.reached ? SUCCESS : SLATE }]}>
                      {ef.fundedAge75?.reached ? formatAge(ef.fundedAge75.ageYears) : 'Not reached in forecast horizon'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* 4. Contribution Recommendation (What improves your odds) */}
              {rec && (
                <View style={styles.mcRecCard}>
                  <View style={styles.mcRecHeader}>
                    <Ionicons name="trending-up-outline" size={18} color={PRIMARY} />
                    <Text style={styles.mcRecTitle}>To Reach a 75% Modeled Probability</Text>
                  </View>

                  {rec.solved ? (
                    rec.additionalMonthlyContributionRequired > 0 ? (
                      <View style={styles.mcRecBody}>
                        <Text style={styles.mcRecAction}>
                          Increase monthly investments by {formatCurrency(rec.additionalMonthlyContributionRequired)}/mo
                        </Text>
                        <Text style={styles.mcRecFromTo}>
                          From {formatCurrency(rec.currentMonthlyContribution)} → {formatCurrency(rec.recommendedMonthlyContribution)} per month
                        </Text>
                        <Text style={styles.mcRecNote}>
                          Modeled to elevate funding likelihood from {formatPercentInt(rec.currentProbabilityFunded)} to {formatPercentInt(rec.achievedProbabilityFunded)}.
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.mcRecBody}>
                        <Text style={[styles.mcRecAction, { color: SUCCESS }]}>
                          Your current monthly investment already meets the 75% modeled-probability target.
                        </Text>
                        <Text style={styles.mcRecNote}>
                          {formatCurrency(rec.currentMonthlyContribution)}/mo provides a {formatPercentInt(rec.currentProbabilityFunded)} modeled chance of being funded by retirement.
                        </Text>
                      </View>
                    )
                  ) : (
                    <View style={styles.mcRecBody}>
                      <Text style={styles.mcRecUnsolvedText}>
                        We couldn't find a practical monthly contribution within the model's search range that reaches the selected probability target.
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {/* 5. Personal Goal Comparison (if personal goal exists) */}
              {userGoal && userGoal.targetAmountReal > 0 && (
                <View style={styles.mcGoalBlock}>
                  <Text style={styles.mcBlockHeader}>Estimated Requirement vs Your Goal</Text>
                  <View style={styles.comparisonRow}>
                    <View style={styles.comparisonBox}>
                      <Text style={styles.compBoxLabel}>FINAURA Estimated Target</Text>
                      <Text style={styles.compBoxValue}>{formatCurrency(ef.targetAmountReal, true)}</Text>
                      <Text style={[styles.compBoxSub, { color: PRIMARY, fontWeight: '700' }]}>
                        {formatPercentInt(ef.probabilityFundedAtTargetAge)} modeled chance
                      </Text>
                    </View>

                    <View style={styles.comparisonBox}>
                      <Text style={styles.compBoxLabel}>Your Personal Goal</Text>
                      <Text style={styles.compBoxValue}>{formatCurrency(userGoal.targetAmountReal, true)}</Text>
                      <Text style={[styles.compBoxSub, { color: PURPLE, fontWeight: '700' }]}>
                        {formatPercentInt(userGoal.probabilityFundedAtTargetAge)} modeled chance
                      </Text>
                    </View>
                  </View>
                </View>
              )}

              {/* 6. Data Quality Warning */}
              {snapshot.forecastStatus?.dataQuality === 'LOW' && (
                <View style={styles.mcWarningBanner}>
                  <Ionicons name="alert-circle-outline" size={16} color={WARNING} />
                  <Text style={styles.mcWarningText}>
                    This forecast is based on limited financial history and may change as FINAURA learns more about your spending and investment patterns.
                  </Text>
                </View>
              )}
            </View>
          );
        })()}

        {/* Fallback Notice if Probabilistic Service Unavailable */}
        {!probabilistic?.available && snapshot.forecastStatus?.available && probabilistic?.reason === 'SIMULATION_SERVICE_UNAVAILABLE' && (
          <View style={styles.mcServiceNotice}>
            <Ionicons name="information-circle-outline" size={16} color={SLATE} />
            <Text style={styles.mcServiceNoticeText}>
              Probability-based forecast is temporarily unavailable. Baseline projections remain active below.
            </Text>
          </View>
        )}

        {/* ══════════════════════════════════════════════════════
            SECTION D: PLANNING SCENARIOS (SENSITIVITY ANALYSIS)
        ══════════════════════════════════════════════════════ */}
        {snapshot.scenarios && (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Ionicons name="analytics-outline" size={22} color={PRIMARY} />
              <Text style={styles.sectionTitle}>Planning Scenarios (Sensitivity)</Text>
            </View>
            <Text style={styles.scenarioIntroText}>
              These scenarios illustrate how your outlook responds to varying long-term market conditions. Base represents your current profile assumptions.
            </Text>

            {/* Scenario Segmented Tabs */}
            <View style={styles.scenarioTabsRow}>
              {(['conservative', 'base', 'optimistic'] as const).map((key) => {
                const isSelected = selectedScenarioKey === key;
                const sc = snapshot.scenarios![key];
                return (
                  <TouchableOpacity
                    key={key}
                    style={[
                      styles.scenarioTabBtn,
                      isSelected && styles.scenarioTabBtnActive,
                      key === 'base' && !isSelected && styles.scenarioTabBtnBase
                    ]}
                    onPress={() => setSelectedScenarioKey(key)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.scenarioTabLabel, isSelected && styles.scenarioTabLabelActive]}>
                      {sc.label}
                    </Text>
                    {key === 'base' && (
                      <View style={[styles.baseBadge, isSelected && styles.baseBadgeActive]}>
                        <Text style={[styles.baseBadgeText, isSelected && styles.baseBadgeTextActive]}>Current</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Selected Scenario Active Summary Card */}
            {(() => {
              const activeSc = snapshot.scenarios![selectedScenarioKey];
              return (
                <View style={styles.activeScenarioCard}>
                  <View style={styles.activeScHeaderRow}>
                    <Text style={styles.activeScTitle}>{activeSc.label} Scenario Outlook</Text>
                    <View style={styles.realReturnPill}>
                      <Text style={styles.realReturnPillLabel}>Real Return: </Text>
                      <Text style={styles.realReturnPillValue}>
                        {(activeSc.assumptions.realReturn * 100).toFixed(2)}%
                      </Text>
                    </View>
                  </View>

                  <View style={styles.comparisonRow}>
                    <View style={styles.comparisonBox}>
                      <Text style={styles.compBoxLabel}>Estimated FIRE Target</Text>
                      <Text style={styles.compBoxValue}>{formatCurrency(activeSc.estimatedFireCorpus, true)}</Text>
                      <Text style={styles.compBoxSub}>@ {(activeSc.assumptions.withdrawalRate * 100).toFixed(1)}% SWR</Text>
                    </View>
                    <View style={styles.comparisonBox}>
                      <Text style={styles.compBoxLabel}>Projected Corpus</Text>
                      <Text style={styles.compBoxValue}>
                        {activeSc.projectedCorpusAtRetirement !== null ? formatCurrency(activeSc.projectedCorpusAtRetirement, true) : '—'}
                      </Text>
                      <Text style={styles.compBoxSub}>at target retirement age</Text>
                    </View>
                  </View>

                  <View style={styles.detailList}>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Required Monthly Investment</Text>
                      <Text style={[styles.detailValue, { fontWeight: '700', color: PRIMARY }]}>
                        {activeSc.requiredMonthlyContributionForEstimatedFire !== null
                          ? `${formatCurrency(activeSc.requiredMonthlyContributionForEstimatedFire)}/mo`
                          : '—'}
                      </Text>
                    </View>

                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Projected FIRE Timing</Text>
                      <Text style={[styles.detailValue, { color: activeSc.projectedFire.reached ? SUCCESS : SLATE, fontWeight: '700' }]}>
                        {activeSc.projectedFire.reached && activeSc.projectedFire.projectedAge !== null
                          ? `Age ${activeSc.projectedFire.projectedAge.toFixed(1)}`
                          : 'Not achieved by horizon'}
                      </Text>
                    </View>

                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Scenario Assumptions</Text>
                      <Text style={styles.detailValue}>
                        Nominal {(activeSc.assumptions.nominalReturn * 100).toFixed(1)}% | Inflation {(activeSc.assumptions.inflation * 100).toFixed(1)}%
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })()}

            {/* Quick 3-Way Scenario Matrix Table */}
            <View style={styles.scenarioMatrixWrap}>
              <Text style={styles.matrixTitle}>Scenario Comparison Matrix</Text>
              <View style={styles.matrixHeaderRow}>
                <Text style={[styles.matrixColHeader, { flex: 1.3 }]}>Metric</Text>
                <Text style={[styles.matrixColHeader, { flex: 1, textAlign: 'center' }]}>Cons.</Text>
                <Text style={[styles.matrixColHeader, { flex: 1, textAlign: 'center', color: PRIMARY }]}>Base</Text>
                <Text style={[styles.matrixColHeader, { flex: 1, textAlign: 'center' }]}>Opt.</Text>
              </View>

              <View style={styles.matrixRow}>
                <Text style={[styles.matrixLabel, { flex: 1.3 }]}>Real Return</Text>
                <Text style={[styles.matrixVal, { flex: 1 }]}>{(snapshot.scenarios!.conservative.assumptions.realReturn * 100).toFixed(1)}%</Text>
                <Text style={[styles.matrixVal, styles.matrixValBase, { flex: 1 }]}>{(snapshot.scenarios!.base.assumptions.realReturn * 100).toFixed(1)}%</Text>
                <Text style={[styles.matrixVal, { flex: 1 }]}>{(snapshot.scenarios!.optimistic.assumptions.realReturn * 100).toFixed(1)}%</Text>
              </View>

              <View style={styles.matrixRow}>
                <Text style={[styles.matrixLabel, { flex: 1.3 }]}>Projected Corpus</Text>
                <Text style={[styles.matrixVal, { flex: 1 }]}>
                  {snapshot.scenarios!.conservative.projectedCorpusAtRetirement !== null
                    ? formatCurrency(snapshot.scenarios!.conservative.projectedCorpusAtRetirement, true)
                    : '—'}
                </Text>
                <Text style={[styles.matrixVal, styles.matrixValBase, { flex: 1 }]}>
                  {snapshot.scenarios!.base.projectedCorpusAtRetirement !== null
                    ? formatCurrency(snapshot.scenarios!.base.projectedCorpusAtRetirement, true)
                    : '—'}
                </Text>
                <Text style={[styles.matrixVal, { flex: 1 }]}>
                  {snapshot.scenarios!.optimistic.projectedCorpusAtRetirement !== null
                    ? formatCurrency(snapshot.scenarios!.optimistic.projectedCorpusAtRetirement, true)
                    : '—'}
                </Text>
              </View>

              <View style={styles.matrixRow}>
                <Text style={[styles.matrixLabel, { flex: 1.3 }]}>Req. Monthly</Text>
                <Text style={[styles.matrixVal, { flex: 1 }]}>{formatCurrency(snapshot.scenarios!.conservative.requiredMonthlyContributionForEstimatedFire, true)}</Text>
                <Text style={[styles.matrixVal, styles.matrixValBase, { flex: 1 }]}>{formatCurrency(snapshot.scenarios!.base.requiredMonthlyContributionForEstimatedFire, true)}</Text>
                <Text style={[styles.matrixVal, { flex: 1 }]}>{formatCurrency(snapshot.scenarios!.optimistic.requiredMonthlyContributionForEstimatedFire, true)}</Text>
              </View>

              <View style={styles.matrixRow}>
                <Text style={[styles.matrixLabel, { flex: 1.3 }]}>Projected Age</Text>
                <Text style={[styles.matrixVal, { flex: 1 }]}>
                  {snapshot.scenarios!.conservative.projectedFire.reached && snapshot.scenarios!.conservative.projectedFire.projectedAge !== null
                    ? `${snapshot.scenarios!.conservative.projectedFire.projectedAge.toFixed(0)}y`
                    : '—'}
                </Text>
                <Text style={[styles.matrixVal, styles.matrixValBase, { flex: 1 }]}>
                  {snapshot.scenarios!.base.projectedFire.reached && snapshot.scenarios!.base.projectedFire.projectedAge !== null
                    ? `${snapshot.scenarios!.base.projectedFire.projectedAge.toFixed(0)}y`
                    : '—'}
                </Text>
                <Text style={[styles.matrixVal, { flex: 1 }]}>
                  {snapshot.scenarios!.optimistic.projectedFire.reached && snapshot.scenarios!.optimistic.projectedFire.projectedAge !== null
                    ? `${snapshot.scenarios!.optimistic.projectedFire.projectedAge.toFixed(0)}y`
                    : '—'}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* ══════════════════════════════════════════════════════
            SECTION E: INCOME & RESILIENCE
        ══════════════════════════════════════════════════════ */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="wallet-outline" size={22} color={SUCCESS} />
            <Text style={styles.sectionTitle}>Income Intelligence & Resilience</Text>
          </View>

          <View style={styles.metricRow}>
            <View style={styles.metricCol}>
              <Text style={styles.metricColLabel}>Typical Monthly Income</Text>
              <Text style={styles.metricColVal}>{formatCurrency(income.medianMonthlyIncome)}</Text>
              <Text style={styles.metricColSub}>Spike-resistant median</Text>
            </View>

            <View style={styles.metricCol}>
              <Text style={styles.metricColLabel}>Conservative Income Floor</Text>
              <Text style={styles.metricColVal}>{formatCurrency(income.reliableMonthlyIncome)}</Text>
              <Text style={styles.metricColSub}>25th percentile conservative basis</Text>
            </View>
          </View>

          <View style={styles.badgeRow}>
            <View style={[styles.badge, { backgroundColor: '#F1F5F9' }]}>
              <Text style={styles.badgeLabel}>Income Pattern: </Text>
              <Text style={[styles.badgeValue, { color: variabilityColor }]}>{variabilityLabel}</Text>
            </View>

            <View style={[styles.badge, { backgroundColor: '#F1F5F9' }]}>
              <Text style={styles.badgeLabel}>History: </Text>
              <Text style={styles.badgeValue}>{dataQuality.incomeDataQuality.monthsObserved} mos recorded</Text>
            </View>
          </View>

          <View style={styles.detailList}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Conservative Essential Spend Coverage</Text>
              <Text style={[styles.detailValue, { color: resilience.isCoverageAdequate ? SUCCESS : WARNING, fontWeight: '700' }]}>
                {resilience.essentialCoverageRatio !== null ? `${(resilience.essentialCoverageRatio * 100).toFixed(0)}%` : '—'}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Zero-Income Months</Text>
              <Text style={styles.detailValue}>{income.zeroIncomeMonthsCount} observed</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Worst Rolling Quarter</Text>
              <Text style={styles.detailValue}>
                {income.worstRollingQuarter.available && income.worstRollingQuarter.amount !== null
                  ? `${formatCurrency(income.worstRollingQuarter.amount)} total`
                  : 'Requires 3+ months history'}
              </Text>
            </View>
          </View>
        </View>

        {/* ══════════════════════════════════════════════════════
            SECTION F: EMERGENCY BUFFER
        ══════════════════════════════════════════════════════ */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="shield-checkmark-outline" size={22} color={SUCCESS} />
            <Text style={styles.sectionTitle}>Emergency Reserve</Text>
          </View>

          <View style={styles.detailList}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Target Duration</Text>
              <Text style={styles.detailValue}>{emergencyFund.targetMonths} months of essential spend</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Target Reserve Amount</Text>
              <Text style={styles.detailValue}>{formatCurrency(emergencyFund.targetAmount)}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Recorded Liquid Reserve</Text>
              <Text style={styles.detailValue}>{formatCurrency(emergencyFund.knownLiquidEmergencyAssets)}</Text>
            </View>

            <View style={styles.detailRowHighlight}>
              <Text style={styles.detailLabelHighlight}>Reserve Status</Text>
              <Text style={[styles.detailValueHighlight, { color: emergencyFund.fundingGap === 0 ? SUCCESS : WARNING }]}>
                {emergencyFund.fundingGap === 0 ? 'Fully Funded' : `Deficit: ${formatCurrency(emergencyFund.fundingGap)}`}
              </Text>
            </View>
          </View>
        </View>

        {/* ══════════════════════════════════════════════════════
            SECTION G: CURRENT FINANCIAL POSITION & OUTFLOWS
        ══════════════════════════════════════════════════════ */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="pie-chart-outline" size={22} color={PRIMARY} />
            <Text style={styles.sectionTitle}>Current Position & Outflows</Text>
          </View>

          <View style={styles.detailList}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Current Operating Balance</Text>
              <Text style={styles.detailValue}>{formatCurrency(currentState.currentBalance)}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Average Monthly Needs</Text>
              <Text style={styles.detailValue}>{formatCurrency(currentState.averageMonthlyNeeds)}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Average Monthly Wants</Text>
              <Text style={styles.detailValue}>{formatCurrency(currentState.averageMonthlyWants)}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Monthly Liability Service</Text>
              <Text style={styles.detailValue}>{formatCurrency(currentState.liabilityService)}</Text>
            </View>

            <View style={styles.detailRowHighlight}>
              <Text style={styles.detailLabelHighlight}>Total Essential Outflows</Text>
              <Text style={styles.detailValueHighlight}>{formatCurrency(currentState.totalEssentialSpending)}/mo</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Known Recorded Net Worth</Text>
              <Text style={styles.detailValue}>{formatCurrency(assets.knownNetWorth)}</Text>
            </View>
          </View>
        </View>

        {/* ══════════════════════════════════════════════════════
            SECTION H: MODEL ASSUMPTIONS (EXPLAINABILITY)
        ══════════════════════════════════════════════════════ */}
        <View style={styles.sectionCard}>
          <TouchableOpacity
            style={styles.collapsibleHeader}
            onPress={() => setShowAssumptions(!showAssumptions)}
            activeOpacity={0.7}
          >
            <View style={styles.sectionHeaderNoMargin}>
              <Ionicons name="options-outline" size={22} color={SLATE} />
              <Text style={styles.sectionTitle}>Forecast Assumptions & Details</Text>
            </View>
            <Ionicons name={showAssumptions ? 'chevron-up' : 'chevron-down'} size={20} color={SLATE} />
          </TouchableOpacity>

          {showAssumptions && (
            <View style={styles.assumptionsBody}>
              {retirement && (
                <>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Expected Nominal Return</Text>
                    <Text style={styles.detailValue}>{formatPercent(retirement.assumptions.nominalReturn)}</Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Expected Inflation</Text>
                    <Text style={styles.detailValue}>{formatPercent(retirement.assumptions.inflation)}</Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Real Return (Fisher exact)</Text>
                    <Text style={styles.detailValue}>{formatPercent(retirement.assumptions.realReturn)}</Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Safe Withdrawal Rate</Text>
                    <Text style={styles.detailValue}>{formatPercent(retirement.assumptions.withdrawalRate)}</Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Lifestyle Adjustment Ratio</Text>
                    <Text style={styles.detailValue}>{formatPercent(retirement.assumptions.lifestyleAdjustmentRatio)}</Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Contribution Model</Text>
                    <Text style={styles.detailValue}>Fixed Nominal Monthly (NOMINAL_FLAT)</Text>
                  </View>
                </>
              )}

              {/* Probabilistic assumptions if available */}
              {probabilistic?.available && probabilistic.assumptions && (
                <>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Market Variability Assumption</Text>
                    <Text style={styles.detailValue}>{formatPercent(probabilistic.assumptions.portfolioVolatility)} annual</Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Simulation Sample</Text>
                    <Text style={styles.detailValue}>10,000 simulated future paths</Text>
                  </View>
                </>
              )}

              {/* Expandable Advanced Distribution Metrics */}
              {probabilistic?.available && probabilistic.estimatedFire && (
                <View style={{ marginTop: 8 }}>
                  <TouchableOpacity
                    style={styles.advancedToggleRow}
                    onPress={() => setShowAdvancedMc(!showAdvancedMc)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.advancedToggleText}>
                      {showAdvancedMc ? 'Hide Advanced Distribution Metrics' : 'Show Advanced Distribution Metrics (P10/P90)'}
                    </Text>
                    <Ionicons name={showAdvancedMc ? 'chevron-up' : 'chevron-down'} size={16} color={PRIMARY} />
                  </TouchableOpacity>

                  {showAdvancedMc && probabilistic.estimatedFire.corpusPercentiles && (
                    <View style={styles.advancedMetricsBox}>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>10th-Percentile Modeled Outcome</Text>
                        <Text style={styles.detailValue}>{formatCurrency(probabilistic.estimatedFire.corpusPercentiles.p10, true)}</Text>
                      </View>

                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>90th-Percentile Modeled Outcome</Text>
                        <Text style={styles.detailValue}>{formatCurrency(probabilistic.estimatedFire.corpusPercentiles.p90, true)}</Text>
                      </View>

                      {probabilistic.estimatedFire.probabilityReachedFireByTargetAge !== null && (
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Chance of Touching Target Once</Text>
                          <Text style={styles.detailValue}>
                            {formatPercentInt(probabilistic.estimatedFire.probabilityReachedFireByTargetAge)}
                          </Text>
                        </View>
                      )}

                      {probabilistic.estimatedFire.firstCrossing && (
                        <View style={styles.firstCrossingNote}>
                          <Text style={styles.firstCrossingNoteText}>
                            * First-crossing estimates when simulated paths first touch the FIRE target. A path may later fall below it.
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              )}

              <View style={styles.assumptionNote}>
                <Text style={styles.assumptionNoteText}>
                  * FINAURA simulated thousands of possible future market paths using these assumptions. These are modeled outcomes, not guarantees. We estimate market variability from your expected return because detailed portfolio allocation data isn't available yet.
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* ══════════════════════════════════════════════════════
            SECTION I: OBSERVATIONS & EXPLANATION FACTS
        ══════════════════════════════════════════════════════ */}
        {explanationFacts && explanationFacts.length > 0 && (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Ionicons name="bulb-outline" size={22} color={PRIMARY} />
              <Text style={styles.sectionTitle}>Engine Observations</Text>
            </View>

            <View style={styles.factsList}>
              {explanationFacts.map((fact, index) => {
                const mapped = mapFactToMessage(fact.code, fact.value);
                return (
                  <View key={`${fact.code}-${index}`} style={styles.factItem}>
                    <View style={[styles.factIconWrap, { backgroundColor: `${mapped.color}15` }]}>
                      <Ionicons name={mapped.icon} size={20} color={mapped.color} />
                    </View>
                    <View style={styles.factTextWrap}>
                      <Text style={styles.factTitle}>{mapped.title}</Text>
                      <Text style={styles.factDesc}>{mapped.desc}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* ══════════════════════════════════════════════════════
            SECTION J: DATA LIMITATIONS & NOTES
        ══════════════════════════════════════════════════════ */}
        {limitations && limitations.length > 0 && (
          <View style={[styles.sectionCard, { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }]}>
            <View style={styles.sectionHeader}>
              <Ionicons name="information-circle-outline" size={22} color={SLATE} />
              <Text style={[styles.sectionTitle, { color: SLATE }]}>Things to Keep in Mind</Text>
            </View>

            <View style={styles.limitationsList}>
              {limitations.map((limit, index) => (
                <View key={`lim-${index}`} style={styles.limitationItem}>
                  <Text style={styles.limitationBullet}>•</Text>
                  <Text style={styles.limitationText}>{limit}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: APP_BG,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    backgroundColor: CARD_BG,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: DARK,
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 11,
    fontWeight: '500',
    color: MUTED,
    marginTop: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: MUTED,
    fontWeight: '500',
  },
  errorTitle: {
    marginTop: 14,
    fontSize: 18,
    fontWeight: '700',
    color: DARK,
  },
  errorSubtitle: {
    marginTop: 6,
    fontSize: 13,
    color: MUTED,
    textAlign: 'center',
    marginBottom: 20,
  },
  retryBtn: {
    backgroundColor: PRIMARY,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  // Section A: Headline Grid
  headlineGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  headlineCard: {
    width: (SCREEN_W - 32 - 12) / 2,
    backgroundColor: CARD_BG,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: BORDER,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  headlineLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: MUTED,
    marginBottom: 4,
  },
  headlineValue: {
    fontSize: 18,
    fontWeight: '800',
    color: DARK,
    letterSpacing: -0.4,
  },
  headlineSub: {
    fontSize: 10,
    color: SLATE,
    marginTop: 4,
  },
  // Section Cards
  sectionCard: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  sectionHeaderNoMargin: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  collapsibleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: DARK,
    letterSpacing: -0.2,
  },
  sectionSubtitle: {
    fontSize: 11,
    color: MUTED,
    marginTop: 2,
  },
  // Progress Bar
  progressContainer: {
    marginBottom: 16,
  },
  progressHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: DARK,
  },
  progressPctText: {
    fontSize: 14,
    fontWeight: '800',
    color: PRIMARY,
  },
  progressBarTrack: {
    height: 10,
    backgroundColor: '#EEF2F6',
    borderRadius: 5,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 5,
  },
  progressFootnote: {
    fontSize: 11,
    color: MUTED,
    lineHeight: 15,
  },
  // Comparison Box
  comparisonRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  comparisonBox: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  compBoxLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: MUTED,
    marginBottom: 4,
  },
  compBoxValue: {
    fontSize: 16,
    fontWeight: '800',
    color: DARK,
  },
  compBoxSub: {
    fontSize: 10,
    color: SLATE,
    marginTop: 2,
  },
  // Detail List
  detailList: {
    gap: 10,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  detailRowHighlight: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 8,
    marginVertical: 4,
  },
  detailLabel: {
    fontSize: 13,
    color: MUTED,
    flex: 1,
  },
  detailLabelHighlight: {
    fontSize: 13,
    fontWeight: '600',
    color: DARK,
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '600',
    color: DARK,
  },
  detailValueHighlight: {
    fontSize: 13,
    fontWeight: '700',
  },
  // Metrics in Income section
  metricRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  metricCol: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  metricColLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: MUTED,
    marginBottom: 4,
  },
  metricColVal: {
    fontSize: 16,
    fontWeight: '800',
    color: DARK,
  },
  metricColSub: {
    fontSize: 10,
    color: SLATE,
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeLabel: {
    fontSize: 11,
    color: MUTED,
  },
  badgeValue: {
    fontSize: 11,
    fontWeight: '700',
  },
  // ── Monte Carlo UX Elements ──────────────────────────────────
  mcHeadlineCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  mcHeadlineTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  mcHeadlineBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: SLATE,
    letterSpacing: 0.5,
  },
  mcBandPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  mcBandPillText: {
    fontSize: 10,
    fontWeight: '800',
  },
  mcProbabilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  mcProbabilityBig: {
    fontSize: 38,
    fontWeight: '900',
    letterSpacing: -1,
  },
  mcProbabilityTextWrap: {
    flex: 1,
    marginLeft: 14,
  },
  mcProbabilityTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: DARK,
    marginBottom: 3,
  },
  mcProbabilitySub: {
    fontSize: 11,
    color: MUTED,
    lineHeight: 15,
  },
  mcProgressTrack: {
    height: 8,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  mcProgressFill: {
    height: '100%',
    borderRadius: 4,
  },
  mcOutcomeBlock: {
    marginBottom: 16,
  },
  mcTimingBlock: {
    marginBottom: 16,
  },
  mcGoalBlock: {
    marginBottom: 16,
  },
  mcBlockHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: DARK,
    marginBottom: 10,
  },
  mcRecCard: {
    backgroundColor: '#EEF2FF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#C7D2FE',
    marginBottom: 16,
  },
  mcRecHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  mcRecTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: PRIMARY,
  },
  mcRecBody: {
    gap: 4,
  },
  mcRecAction: {
    fontSize: 14,
    fontWeight: '800',
    color: DARK,
  },
  mcRecFromTo: {
    fontSize: 12,
    fontWeight: '600',
    color: PRIMARY,
  },
  mcRecNote: {
    fontSize: 11,
    color: SLATE,
    marginTop: 2,
    lineHeight: 15,
  },
  mcRecUnsolvedText: {
    fontSize: 12,
    color: SLATE,
    lineHeight: 16,
  },
  mcWarningBanner: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginTop: 6,
  },
  mcWarningText: {
    fontSize: 11,
    color: '#92400E',
    flex: 1,
    lineHeight: 15,
  },
  mcServiceNotice: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  mcServiceNoticeText: {
    fontSize: 12,
    color: SLATE,
    flex: 1,
    lineHeight: 16,
  },
  advancedToggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  advancedToggleText: {
    fontSize: 12,
    fontWeight: '600',
    color: PRIMARY,
  },
  advancedMetricsBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 10,
    gap: 8,
    marginTop: 6,
  },
  firstCrossingNote: {
    marginTop: 4,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  firstCrossingNoteText: {
    fontSize: 10,
    color: SLATE,
    fontStyle: 'italic',
    lineHeight: 14,
  },
  // Assumptions Body
  assumptionsBody: {
    marginTop: 16,
    gap: 10,
  },
  assumptionNote: {
    marginTop: 8,
    padding: 10,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
  },
  assumptionNoteText: {
    fontSize: 11,
    color: SLATE,
    lineHeight: 16,
  },
  // Facts List
  factsList: {
    gap: 12,
  },
  factItem: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  factIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  factTextWrap: {
    flex: 1,
  },
  factTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: DARK,
    marginBottom: 2,
  },
  factDesc: {
    fontSize: 12,
    color: MUTED,
    lineHeight: 16,
  },
  // Limitations List
  limitationsList: {
    gap: 6,
  },
  limitationItem: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  limitationBullet: {
    fontSize: 13,
    color: SLATE,
    lineHeight: 18,
  },
  limitationText: {
    fontSize: 12,
    color: SLATE,
    lineHeight: 18,
    flex: 1,
  },
  // Scenario Styles
  scenarioIntroText: {
    fontSize: 12,
    color: SLATE,
    lineHeight: 17,
    marginBottom: 14,
  },
  scenarioTabsRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 3,
    marginBottom: 14,
    gap: 4,
  },
  scenarioTabBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 4,
  },
  scenarioTabBtnActive: {
    backgroundColor: CARD_BG,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  scenarioTabBtnBase: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  scenarioTabLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: SLATE,
  },
  scenarioTabLabelActive: {
    color: PRIMARY,
    fontWeight: '800',
  },
  baseBadge: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  baseBadgeActive: {
    backgroundColor: '#EEF2FF',
  },
  baseBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: SLATE,
  },
  baseBadgeTextActive: {
    color: PRIMARY,
  },
  activeScenarioCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
  },
  activeScHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  activeScTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: DARK,
  },
  realReturnPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  realReturnPillLabel: {
    fontSize: 10,
    color: PRIMARY,
  },
  realReturnPillValue: {
    fontSize: 11,
    fontWeight: '800',
    color: PRIMARY,
  },
  scenarioMatrixWrap: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  matrixTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: DARK,
    marginBottom: 8,
  },
  matrixHeaderRow: {
    flexDirection: 'row',
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    marginBottom: 6,
  },
  matrixColHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: MUTED,
  },
  matrixRow: {
    flexDirection: 'row',
    paddingVertical: 4,
    alignItems: 'center',
  },
  matrixLabel: {
    fontSize: 11,
    color: SLATE,
    fontWeight: '500',
  },
  matrixVal: {
    fontSize: 11,
    color: DARK,
    fontWeight: '600',
    textAlign: 'center',
  },
  matrixValBase: {
    color: PRIMARY,
    fontWeight: '800',
  },
});
