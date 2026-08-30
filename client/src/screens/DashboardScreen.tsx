import React, { useCallback, useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import {
  getDashboard,
  getPredictability,
  getLiabilities,
  getFMI,
  getUserProfile,
  getAssets,
  getIncome
} from '../services/api';
import { useStore } from '../store/useStore';
import {
  DashboardData,
  PredictabilitySnapshot,
  Liability,
  FMIResponse,
  User,
  Asset,
  IncomeRecord
} from '../types';
import { UpdateBalanceScreen } from './UpdateBalanceScreen';

const { width: SCREEN_W } = Dimensions.get('window');

// ── Design Tokens ──────────────────────────────────────────
const BLUE = '#2563EB';
const BLUE_LIGHT = '#EFF6FF';
const GREEN = '#10B981';
const GREEN_LIGHT = '#ECFDF5';
const AMBER = '#F59E0B';
const AMBER_LIGHT = '#FFFBEB';
const RED = '#EF4444';
const RED_LIGHT = '#FEF2F2';
const PURPLE = '#7C3AED';
const PURPLE_LIGHT = '#F3E8FF';
const DARK = '#0F172A';
const GRAY_600 = '#475569';
const GRAY_400 = '#94A3B8';
const BORDER = '#E2E8F0';
const BG = '#F8FAFC';

// ── Formatting Helpers ─────────────────────────────────────
function formatCurrency(n: number | null | undefined): string {
  if (n === null || n === undefined || isNaN(n)) return '₹0';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Math.round(n));
}

function formatShortDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
}

function fmiStatusColor(score: number): { text: string; bg: string; border: string; label: string } {
  if (score >= 70) {
    return { text: '#059669', bg: GREEN_LIGHT, border: '#A7F3D0', label: 'Strong' };
  }
  if (score >= 45) {
    return { text: '#D97706', bg: AMBER_LIGHT, border: '#FDE68A', label: 'Fair' };
  }
  return { text: '#DC2626', bg: RED_LIGHT, border: '#FECACA', label: 'Needs Attention' };
}

// ═══════════════════════════════════════════════════════════
// MAIN DASHBOARD COMPONENT
// ═══════════════════════════════════════════════════════════
export function DashboardScreen(): React.ReactElement {
  const navigation = useNavigation();
  const { user, setUser, dashboard, setDashboard } = useStore();

  // Screen state
  const [loading, setLoading] = useState(!dashboard);
  const [refreshing, setRefreshing] = useState(false);
  const [showUpdateBalance, setShowUpdateBalance] = useState(false);

  // Subsystem data
  const [predictability, setPredictability] = useState<PredictabilitySnapshot | null>(null);
  const [liabilities, setLiabilities] = useState<Liability[]>([]);
  const [fmiData, setFmiData] = useState<FMIResponse | null>(null);
  const [assets, setAssets] = useState<Asset[] | null>(null);
  const [income, setIncome] = useState<IncomeRecord[] | null>(null);
  const [dataLoaded, setDataLoaded] = useState(false);

  // ── Parallel Data Fetcher with Failure Isolation ─────────
  const fetchAllData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else if (!dataLoaded) setLoading(true);

    try {
      const results = await Promise.allSettled([
        getDashboard(),
        getPredictability(),
        getLiabilities(),
        getFMI(),
        getUserProfile(),
        getAssets(),
        getIncome(),
      ]);

      // 1. Dashboard
      if (results[0].status === 'fulfilled' && results[0].value) {
        setDashboard(results[0].value);
      }

      // 2. Predictability
      if (results[1].status === 'fulfilled' && results[1].value) {
        setPredictability(results[1].value);
      }

      // 3. Liabilities
      if (results[2].status === 'fulfilled' && Array.isArray(results[2].value)) {
        setLiabilities(results[2].value);
      }

      // 4. FMI
      if (results[3].status === 'fulfilled' && results[3].value?.current) {
        setFmiData(results[3].value.current);
      }

      // 5. User Profile
      if (results[4].status === 'fulfilled' && results[4].value) {
        setUser(results[4].value);
      }

      // 6. Assets
      if (results[5].status === 'fulfilled' && Array.isArray(results[5].value)) {
        setAssets(results[5].value);
      }

      // 7. Income receipts
      if (results[6].status === 'fulfilled' && Array.isArray(results[6].value)) {
        setIncome(results[6].value);
      }

      setDataLoaded(true);
    } catch {
      // Non-blocking fallback
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [dataLoaded, setDashboard, setUser]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // ── Computed Values ───────────────────────────────────────
  const fmiScore = fmiData?.score ?? dashboard?.fmiScore ?? 50;
  const fmiConfig = fmiStatusColor(fmiScore);

  const balance = user?.currentBalance ?? dashboard?.balance ?? 0;
  const incomeThisMonth = dashboard?.totalIncome ?? user?.monthlyIncome ?? predictability?.income?.meanMonthlyIncome ?? 0;
  const spendingThisMonth = dashboard?.wantsNeedsBreakdown?.total ?? fmiData?.totalSpent ?? 0;
  const investmentsThisMonth = dashboard?.wantsNeedsBreakdown?.investments?.amount ?? fmiData?.totalSaved ?? 0;

  const wantsNeeds = dashboard?.wantsNeedsBreakdown;
  const hasSpendingData = wantsNeeds && wantsNeeds.total > 0;

  // Upcoming liabilities
  const activeLiabilities = useMemo(() => {
    return liabilities.filter((l) => !l.status || l.status === 'active');
  }, [liabilities]);

  // Asset summary (simple presentation aggregate only from direct Assets API)
  const assetSummary = useMemo(() => {
    if (!assets) return null; // still loading
    const totalValue = assets.reduce((sum, a) => sum + (a.currentValue || 0), 0);
    return { totalValue, count: assets.length };
  }, [assets]);

  // First-logged assets (earliest created) for the Home preview
  const previewAssets = useMemo(() => {
    if (!assets || assets.length === 0) return [];
    return [...assets]
      .sort((a, b) => {
        const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return ta - tb;
      })
      .slice(0, 2);
  }, [assets]);

  // Latest income receipts for the Home preview
  const latestReceipts = useMemo(() => {
    if (!income || income.length === 0) return [];
    return [...income]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 2);
  }, [income]);

  const nearestLiability = useMemo(() => {
    const sorted = [...activeLiabilities]
      .filter((l) => l.nextDueDate)
      .sort((a, b) => new Date(a.nextDueDate!).getTime() - new Date(b.nextDueDate!).getTime());
    return sorted[0] || null;
  }, [activeLiabilities]);

  // Days until nearest liability
  const daysUntilLiability = useMemo(() => {
    if (!nearestLiability?.nextDueDate) return null;
    const due = new Date(nearestLiability.nextDueDate).getTime();
    const now = new Date().getTime();
    const diff = Math.ceil((due - now) / (1000 * 60 * 60 * 24));
    return diff;
  }, [nearestLiability]);

  // Predictability metrics
  const mcProb = predictability?.probabilistic?.estimatedFire?.probabilityFundedAtTargetAge;
  const targetAge = predictability?.retirement?.retirementAge ?? user?.retirementAge ?? 60;
  const rec = predictability?.probabilistic?.contributionRecommendation;
  const isMcAvailable = predictability?.probabilistic?.available === true && mcProb !== null && mcProb !== undefined;
  const isMcDegraded = predictability?.probabilistic?.available === true && (predictability?.probabilistic?.dataQuality === 'LOW' || predictability?.probabilistic?.dataQuality === 'INSUFFICIENT');
  const isHistoryInsufficient = predictability?.forecastStatus?.available === false || predictability?.dataQuality?.incomeDataQuality?.dataQualityLevel === 'INSUFFICIENT';

  // ── Smart Next Action Logic (Proactive Guidance Driven) ──
  const smartAction = useMemo(() => {
    const guidance = predictability?.proactiveGuidance;

    // Priority 1: Insufficient history / LIMITED_DATA
    if (guidance?.status === 'LIMITED_DATA' || isHistoryInsufficient || (dashboard?.spendingSeries && dashboard.spendingSeries.length < 2)) {
      return {
        icon: 'sparkles',
        iconColor: PURPLE,
        iconBg: PURPLE_LIGHT,
        badge: 'Getting Started',
        title: guidance?.headline || 'More Financial History Needed',
        message: guidance?.explanation || 'Log a few more transactions to build your behavioral history and unlock saving guidance.',
        actionText: 'Log Transaction',
        actionTarget: 'Transactions' as const,
      };
    }

    // Priority 2: TEMPORARILY_UNAVAILABLE (service down, deterministic still active)
    if (guidance?.status === 'TEMPORARILY_UNAVAILABLE') {
      return {
        icon: 'cloud-offline-outline',
        iconColor: GRAY_400,
        iconBg: '#F1F5F9',
        badge: 'Service Notice',
        title: guidance.headline,
        message: guidance.explanation,
        actionText: 'View Forecast',
        actionTarget: 'FinancialOutlook' as const,
      };
    }

    // Priority 3: ON_TRACK
    if (guidance?.status === 'ON_TRACK') {
      return {
        icon: 'checkmark-circle',
        iconColor: GREEN,
        iconBg: GREEN_LIGHT,
        badge: 'Plan On Track',
        title: guidance.headline,
        message: guidance.explanation,
        actionText: 'View Outlook',
        actionTarget: 'FinancialOutlook' as const,
      };
    }

    // Priority 4: IMPROVEMENT_RECOMMENDED
    if (guidance?.status === 'IMPROVEMENT_RECOMMENDED') {
      const isKnownZero = guidance.investmentBaseline === 'KNOWN_ZERO';
      const isAggressive = guidance.feasibilityStatus === 'AGGRESSIVE';
      const variableNote = guidance.isVariableIncome
        ? ' Because your income varies, treat this as an average target.'
        : '';

      let message = guidance.explanation;
      if (guidance.additionalMonthlyContribution != null && guidance.additionalMonthlyContribution > 0 && !isKnownZero) {
        message = `Increasing monthly investments by ${formatCurrency(guidance.additionalMonthlyContribution)}/mo could improve your modeled retirement path toward age ${targetAge}.${variableNote}`;
      } else if (isKnownZero && guidance.recommendedMonthlyContribution != null) {
        message = `Starting at approximately ${formatCurrency(guidance.recommendedMonthlyContribution)}/mo could move you toward the modeled funding target.${variableNote}`;
      }

      return {
        icon: isKnownZero ? 'rocket-outline' : 'trending-up',
        iconColor: isAggressive ? AMBER : BLUE,
        iconBg: isAggressive ? AMBER_LIGHT : BLUE_LIGHT,
        badge: isKnownZero ? 'Start Investing' : 'Retirement Outlook',
        title: guidance.headline,
        message,
        actionText: 'View Outlook',
        actionTarget: 'FinancialOutlook' as const,
      };
    }

    // Priority 5: ACTION_NEEDED (timeline alternatives)
    if (guidance?.status === 'ACTION_NEEDED') {
      return {
        icon: 'time-outline',
        iconColor: AMBER,
        iconBg: AMBER_LIGHT,
        badge: 'Action Needed',
        title: guidance.headline,
        message: guidance.retirementAlternativeAvailable
          ? 'Reaching your target at the current retirement age may require a large increase. Extending the timeline could reduce the required monthly amount.'
          : guidance.explanation,
        actionText: 'View Alternatives',
        actionTarget: 'FinancialOutlook' as const,
      };
    }

    // Priority 6: Upcoming liability due soon (within 7 days) — non-guidance priority
    if (nearestLiability && daysUntilLiability !== null && daysUntilLiability >= 0 && daysUntilLiability <= 7) {
      const dueLabel = daysUntilLiability === 0 ? 'today' : daysUntilLiability === 1 ? 'tomorrow' : `in ${daysUntilLiability} days`;
      return {
        icon: 'calendar',
        iconColor: AMBER,
        iconBg: AMBER_LIGHT,
        badge: 'Upcoming Due Date',
        title: `${nearestLiability.name} Due ${dueLabel}`,
        message: `${formatCurrency(nearestLiability.amount)} payment scheduled for ${formatShortDate(nearestLiability.nextDueDate)}${nearestLiability.autoDeduct ? ' (Auto Deduct enabled)' : ''}.`,
        actionText: 'View Liabilities',
        actionTarget: 'Liabilities' as const,
      };
    }

    // Priority 7: Emergency fund gap
    if (predictability?.emergencyFund && predictability.emergencyFund.fundingGap > 0) {
      return {
        icon: 'shield-checkmark',
        iconColor: GREEN,
        iconBg: GREEN_LIGHT,
        badge: 'Emergency Reserve',
        title: 'Build Safety Reserve',
        message: `Your liquid emergency reserve is ${formatCurrency(predictability.emergencyFund.fundingGap)} below the recommended ${predictability.emergencyFund.targetMonths || 6}-month essential buffer.`,
        actionText: 'View Buffer',
        actionTarget: 'FinancialOutlook' as const,
      };
    }

    // Priority 8: Fallback — contribution recommendation from raw solver (legacy path / no proactiveGuidance)
    if (rec?.solved && rec.additionalMonthlyContributionRequired > 0) {
      const stepUpText = rec.annualContributionGrowthRate && rec.annualContributionGrowthRate > 0
        ? ` (+${Math.round(rec.annualContributionGrowthRate * 100)}%/yr annual step-up)`
        : '';
      return {
        icon: 'trending-up',
        iconColor: BLUE,
        iconBg: BLUE_LIGHT,
        badge: 'Retirement Outlook',
        title: 'Boost Target Confidence',
        message: `Increasing initial investments by ${formatCurrency(rec.additionalMonthlyContributionRequired)}/mo${stepUpText} improves your modeled retirement path toward age ${targetAge}.`,
        actionText: 'View Outlook',
        actionTarget: 'FinancialOutlook' as const,
      };
    }

    // Priority 9: Default on-track state
    return {
      icon: 'checkmark-circle',
      iconColor: GREEN,
      iconBg: GREEN_LIGHT,
      badge: 'Plan On Track',
      title: 'Current Plan Aligned',
      message: `Your current savings and investment trajectory meets your modeled retirement target for age ${targetAge}.`,
      actionText: 'View Outlook',
      actionTarget: 'FinancialOutlook' as const,
    };
  }, [
    predictability?.proactiveGuidance,
    isHistoryInsufficient,
    dashboard?.spendingSeries,
    rec,
    targetAge,
    nearestLiability,
    daysUntilLiability,
    predictability?.emergencyFund,
  ]);

  // Supporting FMI insight
  const fmiInsight = useMemo(() => {
    if (fmiData?.insights && fmiData.insights.length > 0) {
      return fmiData.insights[0];
    }
    if (dashboard?.insights && dashboard.insights.length > 0) {
      return dashboard.insights[0];
    }
    return 'Your saving discipline and spending control determine your overall financial health.';
  }, [fmiData, dashboard]);

  // Greeting
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    const timeGreeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    const firstName = user?.name ? user.name.trim().split(' ')[0] : 'there';
    return `${timeGreeting}, ${firstName}`;
  }, [user?.name]);

  const todayFormatted = useMemo(() => {
    return new Date().toLocaleDateString('en-IN', {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
    });
  }, []);

  // ── Loading Skeleton / Spinner ───────────────────────────
  if (loading && !dataLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={BLUE} />
        <Text style={styles.loadingTitle}>Loading your financial pulse…</Text>
        <Text style={styles.loadingSubtitle}>Gathering real-time health, cash flow & forecast data</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchAllData(true)}
            tintColor={BLUE}
            colors={[BLUE]}
          />
        }
      >
        {/* ── A. HEADER ────────────────────────────────────── */}
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerGreeting} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
              {greeting}
            </Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {todayFormatted} · Live Financial Pulse
            </Text>
          </View>
          <TouchableOpacity
            style={styles.profileAvatarBtn}
            onPress={() => (navigation as any).navigate('Profile')}
            activeOpacity={0.8}
            accessibilityLabel="View User Profile"
          >
            {user?.avatarLocalUri || user?.avatar ? (
              <Image
                key={user.avatarLocalUri || (user.avatar as string).slice(-24)}
                source={{ uri: (user.avatarLocalUri || user.avatar) as string }}
                style={styles.profileAvatarImg}
              />
            ) : (
              <Ionicons name="person-circle-outline" size={36} color={BLUE} />
            )}
          </TouchableOpacity>
        </View>

        {/* ── B. CURRENT FINANCIAL HEALTH (FMI) ─────────────── */}
        <TouchableOpacity
          style={styles.fmiCard}
          activeOpacity={0.88}
          onPress={() => (navigation as any).navigate('FMI')}
          accessibilityLabel="View Financial Health Details"
        >
          <View style={styles.fmiCardHeader}>
            <View style={styles.fmiTitleRow}>
              <View style={styles.fmiIconBadge}>
                <Ionicons name="pulse" size={18} color="#059669" />
              </View>
              <Text style={styles.cardTitle} numberOfLines={1}>
                Financial Health
              </Text>
            </View>
            <View style={[styles.statusPill, { backgroundColor: fmiConfig.bg, borderColor: fmiConfig.border }]}>
              <Text style={[styles.statusPillText, { color: fmiConfig.text }]} numberOfLines={1}>
                {fmiConfig.label}
              </Text>
            </View>
          </View>

          <View style={styles.fmiScoreRow}>
            <View style={styles.fmiScoreWrap}>
              <Text
                style={[styles.fmiScoreNumber, { color: fmiConfig.text }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
              >
                {Math.round(fmiScore)}
              </Text>
              <Text style={styles.fmiScoreDenominator}>/100</Text>
            </View>
            <View style={styles.fmiInsightWrap}>
              <Text style={styles.fmiInsightText} numberOfLines={2}>
                {fmiInsight}
              </Text>
            </View>
          </View>

          {/* FMI Pillar Progress Bars */}
          {fmiData?.pillars && (
            <View style={styles.pillarRow}>
              <View style={styles.pillarItem}>
                <Text style={styles.pillarLabel} numberOfLines={1}>Saving</Text>
                <View style={styles.pillarTrack}>
                  <View
                    style={[
                      styles.pillarFill,
                      {
                        width: `${Math.min(100, Math.max(5, fmiData.pillars.D1_savingDiscipline.score))}%`,
                        backgroundColor: GREEN,
                      },
                    ]}
                  />
                </View>
              </View>
              <View style={styles.pillarItem}>
                <Text style={styles.pillarLabel} numberOfLines={1}>Discipline</Text>
                <View style={styles.pillarTrack}>
                  <View
                    style={[
                      styles.pillarFill,
                      {
                        width: `${Math.min(100, Math.max(5, fmiData.pillars.D2_spendingControl.score))}%`,
                        backgroundColor: BLUE,
                      },
                    ]}
                  />
                </View>
              </View>
              <View style={styles.pillarItem}>
                <Text style={styles.pillarLabel} numberOfLines={1}>Stability</Text>
                <View style={styles.pillarTrack}>
                  <View
                    style={[
                      styles.pillarFill,
                      {
                        width: `${Math.min(100, Math.max(5, fmiData.pillars.D3_behavioralRisk.score))}%`,
                        backgroundColor: PURPLE,
                      },
                    ]}
                  />
                </View>
              </View>
            </View>
          )}

          <View style={styles.cardActionRow}>
            <Text style={styles.cardActionLink}>View Financial Health breakdown</Text>
            <Ionicons name="chevron-forward" size={14} color={BLUE} />
          </View>
        </TouchableOpacity>

        {/* ── C. CASH POSITION / MONTH SNAPSHOT ────────────── */}
        <View style={styles.cashSection}>
          {/* Main Current Balance Card */}
          <View style={styles.balanceHeroCard}>
            <View style={styles.balanceHeader}>
              <Text style={styles.balanceLabel} numberOfLines={1}>Current Balance</Text>
              <TouchableOpacity
                style={styles.updateBalanceBtn}
                onPress={() => setShowUpdateBalance(true)}
                activeOpacity={0.8}
                accessibilityLabel="Update Current Balance"
              >
                <Ionicons name="create-outline" size={14} color="#FFFFFF" />
                <Text style={styles.updateBalanceBtnText}>Update</Text>
              </TouchableOpacity>
            </View>
            <Text
              style={styles.balanceAmount}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            >
              {formatCurrency(balance)}
            </Text>

            {/* 3-Column Monthly Cash Flow Grid */}
            <View style={styles.cashGrid}>
              <TouchableOpacity
                style={styles.cashCol}
                onPress={() => (navigation as any).navigate('IncomeFlow')}
                activeOpacity={0.75}
                accessibilityLabel="Manage Income Streams and History"
              >
                <Text style={styles.cashColLabel} numberOfLines={1}>Income ↗</Text>
                <Text
                  style={[styles.cashColValue, { color: '#6EE7B7' }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.75}
                >
                  {formatCurrency(incomeThisMonth)}
                </Text>
              </TouchableOpacity>
              <View style={styles.cashColDivider} />
              <View style={styles.cashCol}>
                <Text style={styles.cashColLabel} numberOfLines={1}>Spent</Text>
                <Text
                  style={[styles.cashColValue, { color: '#FCD34D' }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.75}
                >
                  {formatCurrency(spendingThisMonth)}
                </Text>
              </View>
              <View style={styles.cashColDivider} />
              <View style={styles.cashCol}>
                <Text style={styles.cashColLabel} numberOfLines={1}>Invested</Text>
                <Text
                  style={[styles.cashColValue, { color: '#C4B5FD' }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.75}
                >
                  {formatCurrency(investmentsThisMonth)}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* ── F. PREDICTABILITY SNAPSHOT (FUTURE OUTLOOK) ───── */}
        <TouchableOpacity
          style={styles.outlookCard}
          activeOpacity={0.88}
          onPress={() => (navigation as any).navigate('FinancialOutlook')}
          accessibilityLabel="View Financial Outlook and Monte Carlo Simulation"
        >
          <View style={styles.outlookCardHeader}>
            <View style={styles.outlookTitleRow}>
              <View style={styles.outlookIconBadge}>
                <Ionicons name="compass" size={18} color={BLUE} />
              </View>
              <Text style={styles.cardTitle}>Future Outlook</Text>
            </View>
            <View style={styles.outlookPill}>
              <Text style={styles.outlookPillText}>FIRE & Monte Carlo</Text>
            </View>
          </View>

          {isMcAvailable ? (
            <View style={styles.outlookBody}>
              <View style={styles.outlookProbRow}>
                <View style={styles.outlookProbCircleContainer}>
                  <View style={styles.outlookProbCircle}>
                    <Text
                      style={styles.outlookProbPercent}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.7}
                    >
                      {Math.round((mcProb || 0) * 100)}
                    </Text>
                    <Text style={styles.outlookProbDenominator}>/100</Text>
                  </View>
                  <View style={styles.outlookProbPill}>
                    <Text style={styles.outlookProbPillText} numberOfLines={1}>
                      {(mcProb || 0) >= 0.75
                        ? 'Good Predictability'
                        : (mcProb || 0) >= 0.5
                          ? 'Fair Predictability'
                          : 'Action Needed'}
                    </Text>
                  </View>
                </View>
                <View style={styles.outlookProbInfo}>
                  <Text style={styles.outlookProbHeadline} numberOfLines={2}>
                    Modeled chance of fully funded retirement
                  </Text>
                  <Text style={styles.outlookProbSubtitle} numberOfLines={2}>
                    Target Age {targetAge} · 10,000 market paths simulated
                  </Text>
                </View>
              </View>

              {/* Recommendation summary note */}
              {rec && rec.solved && (
                <View style={styles.outlookRecBanner}>
                  <Ionicons
                    name={rec.additionalMonthlyContributionRequired > 0 ? 'arrow-up-circle' : 'checkmark-circle'}
                    size={16}
                    color={rec.additionalMonthlyContributionRequired > 0 ? BLUE : GREEN}
                  />
                  <Text style={styles.outlookRecText} numberOfLines={2}>
                    {rec.additionalMonthlyContributionRequired > 0
                      ? `Recommended initial monthly investment: ${formatCurrency(rec.recommendedMonthlyContribution)}/mo`
                      : `Current plan meets the ${Math.round((rec.targetProbability || 0.75) * 100)}% modeled target.`}
                  </Text>
                </View>
              )}
            </View>
          ) : isMcDegraded ? (
            <View style={styles.outlookDegradedBody}>
              <Text style={styles.outlookDegradedTitle}>Probabilistic Model Calibrating</Text>
              <Text style={styles.outlookDegradedText} numberOfLines={3}>
                Market volatility is derived from your expected return. Deterministic projection is active.
              </Text>
            </View>
          ) : (
            <View style={styles.outlookEmptyBody}>
              <Text style={styles.outlookEmptyTitle}>More History Needed for Monte Carlo</Text>
              <Text style={styles.outlookEmptyText} numberOfLines={3}>
                Log recurring transactions and incomes to activate 10,000-path probabilistic forecasts.
              </Text>
            </View>
          )}

          <View style={styles.cardActionRow}>
            <Text style={styles.cardActionLink}>View full Financial Outlook & simulations</Text>
            <Ionicons name="chevron-forward" size={14} color={BLUE} />
          </View>
        </TouchableOpacity>

        {/* ── D. SPENDING SNAPSHOT (NEEDS vs WANTS) ─────────── */}
        <TouchableOpacity
          style={styles.spendingCard}
          activeOpacity={0.88}
          onPress={() => (navigation as any).navigate('Transactions')}
          accessibilityLabel="View Spending and Transactions"
        >
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleRow}>
              <View style={[styles.iconBadge, { backgroundColor: AMBER_LIGHT }]}>
                <Ionicons name="pie-chart" size={18} color={AMBER} />
              </View>
              <Text style={styles.cardTitle}>Spending Snapshot</Text>
            </View>
            <Text style={styles.headerTimeframe}>This Month</Text>
          </View>

          {hasSpendingData && wantsNeeds ? (
            <View style={styles.spendingBody}>
              {/* Segmented Proportion Bar */}
              <View style={styles.segmentedTrack}>
                {wantsNeeds.needs.pct > 0 && (
                  <View style={[styles.segment, { width: `${wantsNeeds.needs.pct}%`, backgroundColor: GREEN }]} />
                )}
                {wantsNeeds.wants.pct > 0 && (
                  <View style={[styles.segment, { width: `${wantsNeeds.wants.pct}%`, backgroundColor: AMBER }]} />
                )}
                {wantsNeeds.investments.pct > 0 && (
                  <View style={[styles.segment, { width: `${wantsNeeds.investments.pct}%`, backgroundColor: PURPLE }]} />
                )}
              </View>

              {/* 3 Categories Breakdown */}
              <View style={styles.spendingLegendRow}>
                <View style={styles.spendingLegendItem}>
                  <View style={[styles.legendDot, { backgroundColor: GREEN }]} />
                  <Text style={styles.legendLabel} numberOfLines={1}>Needs</Text>
                  <Text
                    style={styles.legendAmount}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.75}
                  >
                    {formatCurrency(wantsNeeds.needs.amount)}
                  </Text>
                  <Text style={styles.legendPct} numberOfLines={1}>({wantsNeeds.needs.pct}%)</Text>
                </View>
                <View style={styles.spendingLegendItem}>
                  <View style={[styles.legendDot, { backgroundColor: AMBER }]} />
                  <Text style={styles.legendLabel} numberOfLines={1}>Wants</Text>
                  <Text
                    style={styles.legendAmount}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.75}
                  >
                    {formatCurrency(wantsNeeds.wants.amount)}
                  </Text>
                  <Text style={styles.legendPct} numberOfLines={1}>({wantsNeeds.wants.pct}%)</Text>
                </View>
                <View style={styles.spendingLegendItem}>
                  <View style={[styles.legendDot, { backgroundColor: PURPLE }]} />
                  <Text style={styles.legendLabel} numberOfLines={1}>Invest</Text>
                  <Text
                    style={styles.legendAmount}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.75}
                  >
                    {formatCurrency(wantsNeeds.investments.amount)}
                  </Text>
                  <Text style={styles.legendPct} numberOfLines={1}>({wantsNeeds.investments.pct}%)</Text>
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.emptyInlineState}>
              <Text style={styles.emptyInlineText}>No transactions recorded yet this month.</Text>
            </View>
          )}

          <View style={styles.cardActionRow}>
            <Text style={styles.cardActionLink}>View all categorized transactions</Text>
            <Ionicons name="chevron-forward" size={14} color={BLUE} />
          </View>
        </TouchableOpacity>

        {/* ── E. MANAGE · ASSETS / INCOME / LIABILITIES ─────── */}
        <View style={styles.manageCard}>
        {/* Assets */}
        <TouchableOpacity
          style={styles.manageSection}
          activeOpacity={0.7}
          onPress={() => (navigation as any).navigate('Assets')}
          accessibilityLabel="View and Manage Financial Assets"
        >
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleRow}>
              <View style={[styles.iconBadge, { backgroundColor: GREEN_LIGHT }]}>
                <Ionicons name="pie-chart" size={18} color={GREEN} />
              </View>
              <Text style={styles.cardTitle} numberOfLines={1}>Assets</Text>
            </View>
            {assetSummary && assetSummary.count > 0 && (
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText} numberOfLines={1}>{assetSummary.count} logged</Text>
              </View>
            )}
          </View>

          {previewAssets.length > 0 ? (
            <View style={styles.miniList}>
              {previewAssets.map((a) => (
                <View key={a.id} style={styles.miniRow}>
                  <View style={styles.miniInfo}>
                    <Text style={styles.miniName} numberOfLines={1}>{a.name}</Text>
                    <Text style={styles.miniSub} numberOfLines={1}>{a.assetType}</Text>
                  </View>
                  <Text
                    style={styles.miniAmount}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.8}
                  >
                    {formatCurrency(a.currentValue)}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyInlineState}>
              <Text style={styles.emptyInlineText}>
                {assets !== null
                  ? 'No assets logged yet — tap to add your first.'
                  : 'Track your FDs, mutual funds, stocks & more.'}
              </Text>
            </View>
          )}

          <View style={styles.manageSectionAction}>
            <Text style={styles.cardActionLink}>View all assets</Text>
            <Ionicons name="chevron-forward" size={14} color={BLUE} />
          </View>
        </TouchableOpacity>

        <View style={styles.manageDivider} />

        {/* Income receipts */}
        <TouchableOpacity
          style={styles.manageSection}
          activeOpacity={0.7}
          onPress={() => (navigation as any).navigate('IncomeFlow')}
          accessibilityLabel="View, Log and Manage Income Receipts"
        >
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleRow}>
              <View style={[styles.iconBadge, { backgroundColor: BLUE_LIGHT }]}>
                <Ionicons name="wallet" size={18} color={BLUE} />
              </View>
              <Text style={styles.cardTitle} numberOfLines={1}>Income Receipts</Text>
            </View>
            {income && income.length > 0 && (
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText} numberOfLines={1}>{income.length} logged</Text>
              </View>
            )}
          </View>

          {latestReceipts.length > 0 ? (
            <View style={styles.miniList}>
              {latestReceipts.map((r) => (
                <View key={r.id} style={styles.miniRow}>
                  <View style={styles.miniInfo}>
                    <Text style={styles.miniName} numberOfLines={1}>
                      {r.description || r.source || 'Income'}
                    </Text>
                    <Text style={styles.miniSub} numberOfLines={1}>
                      {r.source
                        ? `${r.source} · ${formatShortDate(r.timestamp)}`
                        : formatShortDate(r.timestamp)}
                    </Text>
                  </View>
                  <Text
                    style={[styles.miniAmount, { color: GREEN }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.8}
                  >
                    +{formatCurrency(r.amount)}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyInlineState}>
              <Text style={styles.emptyInlineText}>
                {income !== null
                  ? 'No receipts logged yet — tap to log income.'
                  : 'Log salary, freelance & other receipts.'}
              </Text>
            </View>
          )}

          <View style={styles.manageSectionAction}>
            <Text style={styles.cardActionLink}>View all logged receipts</Text>
            <Ionicons name="chevron-forward" size={14} color={BLUE} />
          </View>
        </TouchableOpacity>

        <View style={styles.manageDivider} />

        {/* Upcoming liabilities */}
        <TouchableOpacity
          style={styles.manageSection}
          activeOpacity={0.7}
          onPress={() => (navigation as any).navigate('Liabilities')}
          accessibilityLabel="View Liabilities and Scheduled Deductions"
        >
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleRow}>
              <View style={[styles.iconBadge, { backgroundColor: RED_LIGHT }]}>
                <Ionicons name="calendar-outline" size={18} color={RED} />
              </View>
              <Text style={styles.cardTitle} numberOfLines={1}>Upcoming Liabilities</Text>
            </View>
            {activeLiabilities.length > 0 && (
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText} numberOfLines={1}>{activeLiabilities.length} active</Text>
              </View>
            )}
          </View>

          {nearestLiability ? (
            <View style={styles.miniList}>
              <View style={styles.miniRow}>
                <View style={styles.liabilityIconWrap}>
                  <Ionicons
                    name={nearestLiability.autoDeduct ? 'flash' : 'time-outline'}
                    size={18}
                    color={nearestLiability.autoDeduct ? BLUE : GRAY_600}
                  />
                </View>
                <View style={styles.miniInfo}>
                  <Text style={styles.miniName} numberOfLines={1}>{nearestLiability.name}</Text>
                  <Text style={styles.miniSub} numberOfLines={1}>
                    Due {formatShortDate(nearestLiability.nextDueDate)}
                    {daysUntilLiability !== null && daysUntilLiability >= 0
                      ? ` (${daysUntilLiability === 0 ? 'Today' : `in ${daysUntilLiability}d`})`
                      : ''}
                    {nearestLiability.autoDeduct ? ' · Auto Deduct' : ''}
                  </Text>
                </View>
                <Text
                  style={styles.miniAmount}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.8}
                >
                  {formatCurrency(nearestLiability.amount)}
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.emptyInlineState}>
              <Text style={styles.emptyInlineText}>No recurring liabilities or auto-deductions scheduled.</Text>
            </View>
          )}

          <View style={styles.manageSectionAction}>
            <Text style={styles.cardActionLink}>View all commitments</Text>
            <Ionicons name="chevron-forward" size={14} color={BLUE} />
          </View>
        </TouchableOpacity>
        </View>

        {/* ── G. SMART NEXT ACTION ─────────────────────────── */}
        <TouchableOpacity
          style={styles.smartActionCard}
          activeOpacity={0.88}
          onPress={() => (navigation as any).navigate(smartAction.actionTarget)}
          accessibilityLabel={`Smart Next Action: ${smartAction.title}`}
        >
          <View style={styles.smartActionHeader}>
            <View style={[styles.smartActionIconWrap, { backgroundColor: smartAction.iconBg }]}>
              <Ionicons name={smartAction.icon as any} size={20} color={smartAction.iconColor} />
            </View>
            <View style={styles.smartActionTitleWrap}>
              <View style={styles.smartActionBadge}>
                <Text style={styles.smartActionBadgeText} numberOfLines={1}>{smartAction.badge}</Text>
              </View>
              <Text style={styles.smartActionTitle} numberOfLines={1}>{smartAction.title}</Text>
            </View>
          </View>
          <Text style={styles.smartActionMessage} numberOfLines={3}>{smartAction.message}</Text>
          <View style={styles.smartActionButtonRow}>
            <Text style={styles.smartActionBtnText} numberOfLines={1}>{smartAction.actionText}</Text>
            <Ionicons name="arrow-forward" size={14} color={BLUE} />
          </View>
        </TouchableOpacity>
      </ScrollView>

      {/* Update Balance Modal */}
      <Modal
        visible={showUpdateBalance}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowUpdateBalance(false);
          fetchAllData(true);
        }}
      >
        <UpdateBalanceScreen
          onClose={() => {
            setShowUpdateBalance(false);
            fetchAllData(true);
          }}
        />
      </Modal>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
    position: 'relative',
  },
  screen: {
    flex: 1,
    backgroundColor: BG,
  },
  content: {
    padding: 16,
    gap: 16,
    paddingBottom: 48,
  },

  // Loading State
  loadingContainer: {
    flex: 1,
    backgroundColor: BG,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  loadingTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: DARK,
    marginTop: 8,
  },
  loadingSubtitle: {
    fontSize: 13,
    color: GRAY_600,
    textAlign: 'center',
    lineHeight: 18,
  },

  // Header
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
    gap: 8,
  },
  headerLeft: {
    flex: 1,
    flexShrink: 1,
  },
  headerGreeting: {
    fontSize: 22,
    fontWeight: '800',
    color: DARK,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 13,
    color: GRAY_600,
    fontWeight: '500',
    marginTop: 2,
  },
  profileAvatarBtn: {
    padding: 4,
    flexShrink: 0,
  },
  profileAvatarImg: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: BLUE_LIGHT,
  },

  // Manage card (Assets / Income / Liabilities previews clubbed in one rectangle)
  manageCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: BORDER,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  manageSection: {
    paddingVertical: 16,
  },
  manageDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginLeft: 44,
  },
  manageSectionAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  miniList: {
    gap: 10,
  },
  miniRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  miniInfo: {
    flex: 1,
    flexShrink: 1,
  },
  miniName: {
    fontSize: 13,
    fontWeight: '700',
    color: DARK,
  },
  miniSub: {
    fontSize: 11,
    fontWeight: '500',
    color: GRAY_600,
    marginTop: 2,
  },
  miniAmount: {
    fontSize: 13,
    fontWeight: '800',
    color: DARK,
    flexShrink: 0,
    maxWidth: 128,
  },

  // Card Base
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: DARK,
    letterSpacing: -0.2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    gap: 6,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    flexShrink: 1,
  },
  iconBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  cardActionLink: {
    fontSize: 12,
    fontWeight: '600',
    color: BLUE,
  },

  // FMI Financial Health Card
  fmiCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  fmiCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    gap: 6,
  },
  fmiTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    flexShrink: 1,
  },
  fmiIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: GREEN_LIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    flexShrink: 0,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  fmiScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 12,
  },
  fmiScoreWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexShrink: 0,
  },
  fmiScoreNumber: {
    fontSize: 38,
    fontWeight: '800',
    letterSpacing: -1,
  },
  fmiScoreDenominator: {
    fontSize: 13,
    fontWeight: '700',
    color: GRAY_400,
    marginLeft: 2,
  },
  fmiInsightWrap: {
    flex: 1,
    flexShrink: 1,
  },
  fmiInsightText: {
    fontSize: 13,
    color: GRAY_600,
    lineHeight: 18,
    fontWeight: '500',
  },
  pillarRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  pillarItem: {
    flex: 1,
    minWidth: 50,
  },
  pillarLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: GRAY_600,
    marginBottom: 4,
  },
  pillarTrack: {
    height: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: 3,
    overflow: 'hidden',
  },
  pillarFill: {
    height: '100%',
    borderRadius: 3,
  },

  // Cash Section / Hero Balance
  cashSection: {
    gap: 12,
  },
  balanceHeroCard: {
    backgroundColor: '#1E293B',
    borderRadius: 20,
    padding: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  balanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    gap: 8,
  },
  balanceLabel: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '600',
    flexShrink: 1,
  },
  updateBalanceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    flexShrink: 0,
  },
  updateBalanceBtnText: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  balanceAmount: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -1,
    marginBottom: 14,
  },
  cashGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 6,
  },
  cashCol: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  cashColLabel: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
    marginBottom: 2,
  },
  cashColValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  cashColDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },

  // Future Outlook (Predictability)
  outlookCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#C7D2FE',
    shadowColor: BLUE,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  outlookCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    gap: 6,
  },
  outlookTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    flexShrink: 1,
  },
  outlookIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: BLUE_LIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  outlookPill: {
    backgroundColor: PURPLE_LIGHT,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    flexShrink: 0,
  },
  outlookPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: PURPLE,
  },
  outlookBody: {
    gap: 10,
  },
  outlookProbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  outlookProbCircleContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  outlookProbCircle: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: BLUE_LIGHT,
    borderWidth: 2,
    borderColor: BLUE,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
  },
  outlookProbPercent: {
    fontSize: 20,
    fontWeight: '800',
    color: BLUE,
    lineHeight: 22,
    letterSpacing: -0.5,
  },
  outlookProbDenominator: {
    fontSize: 10,
    fontWeight: '700',
    color: GRAY_400,
    marginTop: -2,
  },
  outlookProbPill: {
    marginTop: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: BLUE_LIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlookProbPillText: {
    fontSize: 9,
    fontWeight: '700',
    color: BLUE,
    textAlign: 'center',
  },
  outlookProbInfo: {
    flex: 1,
    flexShrink: 1,
  },
  outlookProbHeadline: {
    fontSize: 14,
    fontWeight: '700',
    color: DARK,
    lineHeight: 18,
  },
  outlookProbSubtitle: {
    fontSize: 12,
    color: GRAY_600,
    marginTop: 2,
    lineHeight: 16,
  },
  outlookRecBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
  },
  outlookRecText: {
    fontSize: 12,
    fontWeight: '600',
    color: DARK,
    flex: 1,
    lineHeight: 16,
  },
  outlookDegradedBody: {
    paddingVertical: 8,
  },
  outlookDegradedTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: DARK,
  },
  outlookDegradedText: {
    fontSize: 12,
    color: GRAY_600,
    marginTop: 2,
    lineHeight: 16,
  },
  outlookEmptyBody: {
    paddingVertical: 8,
  },
  outlookEmptyTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: DARK,
  },
  outlookEmptyText: {
    fontSize: 12,
    color: GRAY_600,
    marginTop: 2,
    lineHeight: 16,
  },

  // Spending Snapshot
  spendingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  headerTimeframe: {
    fontSize: 11,
    fontWeight: '600',
    color: GRAY_600,
    flexShrink: 0,
  },
  spendingBody: {
    gap: 12,
  },
  segmentedTrack: {
    flexDirection: 'row',
    height: 10,
    borderRadius: 5,
    backgroundColor: '#F1F5F9',
    overflow: 'hidden',
  },
  segment: {
    height: '100%',
  },
  spendingLegendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 4,
  },
  spendingLegendItem: {
    alignItems: 'center',
    flex: 1,
    minWidth: 50,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginBottom: 4,
  },
  legendLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: GRAY_600,
  },
  legendAmount: {
    fontSize: 12,
    fontWeight: '700',
    color: DARK,
    marginTop: 1,
  },
  legendPct: {
    fontSize: 10,
    color: GRAY_400,
    marginTop: 1,
  },

  // Liabilities Card
  liabilityCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  countBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    flexShrink: 0,
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: GRAY_600,
  },
  liabilityItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  liabilityIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: BORDER,
    flexShrink: 0,
  },
  liabilityInfo: {
    flex: 1,
    flexShrink: 1,
  },
  liabilityName: {
    fontSize: 14,
    fontWeight: '700',
    color: DARK,
  },
  liabilityDueDate: {
    fontSize: 12,
    color: GRAY_600,
    marginTop: 2,
  },
  liabilityAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: DARK,
    flexShrink: 0,
    marginLeft: 4,
  },

  // Smart Next Action Card
  smartActionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#DBEAFE',
    shadowColor: BLUE,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  smartActionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  smartActionIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  smartActionTitleWrap: {
    flex: 1,
    flexShrink: 1,
  },
  smartActionBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: 2,
  },
  smartActionBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: BLUE,
    textTransform: 'uppercase',
  },
  smartActionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: DARK,
  },
  smartActionMessage: {
    fontSize: 13,
    color: GRAY_600,
    lineHeight: 18,
    marginBottom: 10,
  },
  smartActionButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
  },
  smartActionBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: BLUE,
  },

  // Assets Card
  assetsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#D1FAE5',
    shadowColor: GREEN,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  assetsBody: {
    gap: 8,
  },
  assetsMetricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  assetsMetric: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  assetsMetricLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: GRAY_600,
    marginBottom: 2,
  },
  assetsMetricValue: {
    fontSize: 15,
    fontWeight: '800',
    color: DARK,
  },
  assetsMetricDivider: {
    width: 1,
    height: 28,
    backgroundColor: BORDER,
  },
  assetsBufferRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    padding: 8,
    borderRadius: 10,
  },
  assetsBufferText: {
    fontSize: 12,
    fontWeight: '500',
    color: GRAY_600,
    flex: 1,
    lineHeight: 16,
  },
  assetsDirectRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  assetsDirectLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: GRAY_600,
  },
  assetsDirectValue: {
    fontSize: 16,
    fontWeight: '800',
    color: DARK,
  },
  assetsDirectSubtext: {
    fontSize: 12,
    color: GRAY_600,
    marginTop: 2,
  },

  // Empty Inline States
  emptyInlineState: {
    paddingVertical: 8,
  },
  emptyInlineText: {
    fontSize: 12,
    color: GRAY_600,
    fontStyle: 'italic',
  },
});
