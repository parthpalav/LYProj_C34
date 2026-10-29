import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, Image, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated from 'react-native-reanimated';
import {
  getAlerts,
  getAssets,
  getCurrentFamily,
  getReceivedFamilyInvitations,
  getDashboard,
  getFamilyDashboard,
  getFMI,
  getGoals,
  getIncome,
  getLiabilities,
  getPredictability,
  getTransactions,
  getUserProfile,
} from '../services/api';
import { useStore } from '../store/useStore';
import {
  Asset,
  FamilyDashboard,
  FamilySummary,
  FMIResponse,
  IncomeRecord,
  Liability,
  PredictabilitySnapshot,
} from '../types';
import { createStyles, Palette, radius, tabular, typeScale, useTheme } from '../theme';
import { enterUp } from '../motion';
import { dueDatesWithin } from '../utils/bills';
import { monthlyEquivalent } from '../utils/format';
import { buildSeries, rangeFor } from '../utils/spending';
import { AnimatedBar, AnimatedSegment } from '../components/motion/AnimatedBar';
import { SkeletonCard } from '../components/motion/Skeleton';
import { useTabBarSpace } from '../components/navigation/TabBar';
import { Card } from '../components/ui/Card';
import { Badge, ErrorState, IconTile, MoneyText, SectionHeader } from '../components/ui/Bits';
import { Ring, Sparkline, svgReady } from '../components/ui/Charts';
import { ScreenHeader, useHeaderHeight, useScrollHeader } from '../components/ui/ScreenHeader';
import { FamilyOverviewCard } from '../components/family/FamilyOverviewCard';
import { UpdateBalanceScreen } from './UpdateBalanceScreen';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const { width: SCREEN_W } = Dimensions.get('window');
const FEED_W = SCREEN_W - 48;
// The Monte Carlo forecast is slow, so returning to Home only re-runs it once a minute.
const HEAVY_REFRESH_MS = 60_000;

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

function fmiStatusColor(score: number, c: Palette): { text: string; bg: string; border: string; label: string } {
  if (score >= 70) {
    return { text: c.successStrong, bg: c.successSoft, border: c.successSoft, label: 'Strong' };
  }
  if (score >= 45) {
    return { text: c.warningStrong, bg: c.warningSoft, border: c.warningSoft, label: 'Fair' };
  }
  return { text: c.dangerStrong, bg: c.dangerSoft, border: c.dangerSoft, label: 'Needs Attention' };
}

type FeedItem = {
  key: string;
  icon: IconName;
  tint: string;
  kicker: string;
  title: string;
  body: string;
  action: string;
  onPress: () => void;
};

// ═══════════════════════════════════════════════════════════
// HOME
// ═══════════════════════════════════════════════════════════
export function DashboardScreen(): React.ReactElement {
  const { c } = useTheme();
  const styles = useStyles();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const tabBarSpace = useTabBarSpace();
  const headerHeight = useHeaderHeight();
  const { y, onScroll } = useScrollHeader({ hidesTabBar: true });
  const user = useStore((s) => s.user);
  const setUser = useStore((s) => s.setUser);
  const dashboard = useStore((s) => s.dashboard);
  const setDashboard = useStore((s) => s.setDashboard);
  const goals = useStore((s) => s.goals);
  const transactions = useStore((s) => s.transactions);
  const setTransactions = useStore((s) => s.setTransactions);
  const setGoals = useStore((s) => s.setGoals);

  // Screen state
  const [loading, setLoading] = useState(!dashboard);
  const [refreshing, setRefreshing] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [showUpdateBalance, setShowUpdateBalance] = useState(false);
  const [feedPage, setFeedPage] = useState(0);

  // Subsystem data
  const [predictability, setPredictability] = useState<PredictabilitySnapshot | null>(null);
  const [liabilities, setLiabilities] = useState<Liability[]>([]);
  const [fmiData, setFmiData] = useState<FMIResponse | null>(null);
  const [assets, setAssets] = useState<Asset[] | null>(null);
  const [income, setIncome] = useState<IncomeRecord[] | null>(null);
  const [attention, setAttention] = useState(0);
  const loadedRef = useRef(false);
  const lastHeavyRef = useRef(0);

  // Household subsystem data (Contextual / Multi-member only)
  const [familySummary, setFamilySummary] = useState<FamilySummary | null>(null);
  const [familyDashboard, setFamilyDashboard] = useState<FamilyDashboard | null>(null);

  // ── Explicit Household Visibility Condition ──────────────
  const hasActiveHousehold =
    !!familySummary &&
    (
      typeof familySummary.memberCount === 'number'
        ? familySummary.memberCount > 1
        : Array.isArray(familySummary.members) && familySummary.members.length > 1
    );

  // ── Supplemental Family Data Fetcher (Non-Blocking) ──────
  const fetchFamilyContext = useCallback(async () => {
    try {
      const fam = await getCurrentFamily();
      if (!fam) {
        setFamilySummary(null);
        setFamilyDashboard(null);
        return;
      }
      const isMultiMember =
        typeof fam.memberCount === 'number'
          ? fam.memberCount > 1
          : Array.isArray(fam.members) && fam.members.length > 1;
      setFamilySummary(fam);
      if (!isMultiMember) {
        // Sole member: immediately clear dashboard, do not fetch dashboard
        setFamilyDashboard(null);
        return;
      }
      // Only fetch family dashboard when an active multi-member family exists
      setFamilyDashboard(await getFamilyDashboard());
    } catch {
      // Failure isolation: never throw or break personal Home
      setFamilySummary(null);
      setFamilyDashboard(null);
    }
  }, []);

  // Clear family context when authenticated user changes
  useEffect(() => {
    setFamilySummary(null);
    setFamilyDashboard(null);
  }, [user?.id, user?.email]);

  // ── Parallel Data Fetcher with Failure Isolation ─────────
  const fetchAllData = useCallback(async (isRefresh = false) => {
    const heavy = isRefresh || Date.now() - lastHeavyRef.current > HEAVY_REFRESH_MS;
    if (heavy) lastHeavyRef.current = Date.now();
    if (isRefresh) setRefreshing(true);
    else if (!loadedRef.current) setLoading(true);

    // Trigger supplemental family fetch in parallel without blocking main spinner
    void fetchFamilyContext();
    // Bell badge: alerts plus pending household invites; never blocks Home.
    void Promise.allSettled([getAlerts(), getReceivedFamilyInvitations()]).then(([a, inv]) => {
      setAttention(
        (a.status === 'fulfilled' ? a.value?.length ?? 0 : 0) +
        (inv.status === 'fulfilled' ? (inv.value ?? []).filter((i) => i.status === 'pending').length : 0),
      );
    });

    const results = await Promise.allSettled([
      getDashboard(),
      heavy ? getPredictability() : Promise.resolve(null),
      getLiabilities(),
      getFMI(),
      getUserProfile(),
      getAssets(),
      getIncome(),
      getGoals(),
      getTransactions(),
    ]);
    const [dash, pred, liab, fmi, profile, assetList, incomeList, goalList, txList] = results;
    if (dash.status === 'fulfilled' && dash.value) setDashboard(dash.value);
    if (pred.status === 'fulfilled' && pred.value) setPredictability(pred.value);
    if (liab.status === 'fulfilled' && Array.isArray(liab.value)) setLiabilities(liab.value);
    if (fmi.status === 'fulfilled' && fmi.value?.current) setFmiData(fmi.value.current);
    if (profile.status === 'fulfilled' && profile.value) setUser(profile.value);
    if (assetList.status === 'fulfilled' && Array.isArray(assetList.value)) setAssets(assetList.value);
    if (incomeList.status === 'fulfilled' && Array.isArray(incomeList.value)) setIncome(incomeList.value);
    // Savings goals live in the shared store, so GoalPlanner updates show here too
    if (goalList.status === 'fulfilled' && Array.isArray(goalList.value)) setGoals(goalList.value);
    if (txList.status === 'fulfilled' && Array.isArray(txList.value)) setTransactions(txList.value);

    // Only the core dashboard decides failure; other cards degrade on their own.
    setLoadFailed(dash.status === 'rejected');
    loadedRef.current = true;
    setLoading(false);
    setRefreshing(false);
  }, [fetchFamilyContext, setDashboard, setUser, setGoals]);

  // Refresh whenever Home comes back into view (after QuickAdd, Goals, Bills…).
  useFocusEffect(useCallback(() => { fetchAllData(); }, [fetchAllData]));

  // ── Computed Values ───────────────────────────────────────
  const fmiScore = fmiData?.score ?? dashboard?.fmiScore ?? null;
  const fmiConfig = fmiStatusColor(fmiScore ?? 0, c);

  const balance = user?.currentBalance ?? dashboard?.balance ?? 0;
  const incomeThisMonth = dashboard?.totalIncome ?? user?.monthlyIncome ?? predictability?.income?.meanMonthlyIncome ?? 0;
  const spendingThisMonth = dashboard?.wantsNeedsBreakdown?.total ?? fmiData?.totalSpent ?? 0;
  // Same daily series the Spending screen opens on, so the card and the full chart agree
  const dailySpend = useMemo(() => {
    const r = rangeFor('month', new Date());
    return buildSeries(transactions, r.start, r.end).buckets.map((b) => b.total);
  }, [transactions]);
  const investmentsThisMonth = dashboard?.wantsNeedsBreakdown?.investments?.amount ?? fmiData?.totalSaved ?? 0;
  const spentShare = incomeThisMonth > 0 ? Math.min(1, spendingThisMonth / incomeThisMonth) : 0;

  const goalsSummary = useMemo(() => {
    const saved = goals.reduce((sum, g) => sum + (g.savedAmount || 0), 0);
    const target = goals.reduce((sum, g) => sum + (g.targetAmount || 0), 0);
    return { saved, target, pct: target > 0 ? Math.min(1, saved / target) : 0 };
  }, [goals]);

  const wantsNeeds = dashboard?.wantsNeedsBreakdown;
  const hasSpendingData = !!wantsNeeds && wantsNeeds.total > 0;

  const activeLiabilities = useMemo(() => liabilities.filter((l) => !l.status || l.status === 'active'), [liabilities]);
  const monthlyBills = activeLiabilities.reduce((s, l) => s + monthlyEquivalent(l.amount, l.frequency), 0);

  // Bills falling due in the next 30 days, derived from each schedule (not only server nextDueDate).
  const upcomingBills = useMemo(
    () => activeLiabilities
      .flatMap((l) => dueDatesWithin(l, 30).slice(0, 1).map((date) => ({ l, date })))
      .sort((a, b) => a.date.getTime() - b.date.getTime()),
    [activeLiabilities],
  );

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
      .sort((a, b) => (a.createdAt ? new Date(a.createdAt).getTime() : 0) - (b.createdAt ? new Date(b.createdAt).getTime() : 0))
      .slice(0, 2);
  }, [assets]);

  const incomeReceived = useMemo(() => {
    if (!income) return null;
    const now = new Date();
    return income
      .filter((r) => { const d = new Date(r.timestamp); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); })
      .reduce((s, r) => s + r.amount, 0);
  }, [income]);

  const nearestBill = upcomingBills[0] ?? null;
  const daysUntilLiability = nearestBill
    ? Math.round((new Date(nearestBill.date).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86400000)
    : null;

  // Predictability metrics
  const mcProb = predictability?.probabilistic?.estimatedFire?.probabilityFundedAtTargetAge;
  const targetAge = predictability?.retirement?.retirementAge ?? user?.retirementAge ?? 60;
  const rec = predictability?.probabilistic?.contributionRecommendation;
  const isMcAvailable = predictability?.probabilistic?.available === true && mcProb !== null && mcProb !== undefined;
  const isHistoryInsufficient = predictability?.forecastStatus?.available === false || predictability?.dataQuality?.incomeDataQuality?.dataQualityLevel === 'INSUFFICIENT';

  // ── Smart Next Action Logic (Proactive Guidance Driven) ──
  const smartAction = useMemo((): Omit<FeedItem, 'key' | 'onPress'> & { actionTarget: string } => {
    const guidance = predictability?.proactiveGuidance;

    // Priority 1: Insufficient history / LIMITED_DATA
    if (guidance?.status === 'LIMITED_DATA' || isHistoryInsufficient || (dashboard?.spendingSeries && dashboard.spendingSeries.length < 2)) {
      return {
        icon: 'sparkles', tint: c.purple, kicker: 'Getting Started',
        title: guidance?.headline || 'More Financial History Needed',
        body: guidance?.explanation || 'Log a few more transactions to build your behavioral history and unlock saving guidance.',
        action: 'Log a transaction', actionTarget: 'QuickAdd',
      };
    }
    // Priority 2: TEMPORARILY_UNAVAILABLE (service down, deterministic still active)
    if (guidance?.status === 'TEMPORARILY_UNAVAILABLE') {
      return { icon: 'cloud-offline-outline', tint: c.textSubtle, kicker: 'Service Notice', title: guidance.headline, body: guidance.explanation, action: 'View forecast', actionTarget: 'FinancialOutlook' };
    }
    // Priority 3: ON_TRACK
    if (guidance?.status === 'ON_TRACK') {
      return { icon: 'checkmark-circle', tint: c.success, kicker: 'Plan On Track', title: guidance.headline, body: guidance.explanation, action: 'View outlook', actionTarget: 'FinancialOutlook' };
    }
    // Priority 4: IMPROVEMENT_RECOMMENDED
    if (guidance?.status === 'IMPROVEMENT_RECOMMENDED') {
      const isKnownZero = guidance.investmentBaseline === 'KNOWN_ZERO';
      const isAggressive = guidance.feasibilityStatus === 'AGGRESSIVE';
      const variableNote = guidance.isVariableIncome ? ' Because your income varies, treat this as an average target.' : '';
      let body = guidance.explanation;
      if (guidance.additionalMonthlyContribution != null && guidance.additionalMonthlyContribution > 0 && !isKnownZero) {
        body = `Investing ${formatCurrency(guidance.additionalMonthlyContribution)}/mo more could improve your modeled retirement path toward age ${targetAge}.${variableNote}`;
      } else if (isKnownZero && guidance.recommendedMonthlyContribution != null) {
        body = `Starting at about ${formatCurrency(guidance.recommendedMonthlyContribution)}/mo could move you toward the modeled funding target.${variableNote}`;
      }
      return {
        icon: isKnownZero ? 'rocket-outline' : 'trending-up', tint: isAggressive ? c.warning : c.primary,
        kicker: isKnownZero ? 'Start Investing' : 'Retirement Outlook', title: guidance.headline, body,
        action: 'View outlook', actionTarget: 'FinancialOutlook',
      };
    }
    // Priority 5: ACTION_NEEDED (timeline alternatives)
    if (guidance?.status === 'ACTION_NEEDED') {
      return {
        icon: 'time-outline', tint: c.warning, kicker: 'Action Needed', title: guidance.headline,
        body: guidance.retirementAlternativeAvailable
          ? 'Reaching your target at the current retirement age may need a large increase. Extending the timeline could lower the monthly amount.'
          : guidance.explanation,
        action: 'See alternatives', actionTarget: 'FinancialOutlook',
      };
    }
    // Priority 6: Upcoming bill due soon (within 7 days)
    if (nearestBill && daysUntilLiability !== null && daysUntilLiability >= 0 && daysUntilLiability <= 7) {
      const dueLabel = daysUntilLiability === 0 ? 'today' : daysUntilLiability === 1 ? 'tomorrow' : `in ${daysUntilLiability} days`;
      return {
        icon: 'calendar', tint: c.warning, kicker: 'Upcoming Due Date', title: `${nearestBill.l.name} Due ${dueLabel}`,
        body: `${formatCurrency(nearestBill.l.amount)} payment scheduled for ${formatShortDate(nearestBill.date.toISOString())}${nearestBill.l.autoDeduct ? ' (Auto Deduct enabled)' : ''}.`,
        action: 'View bills', actionTarget: 'Liabilities',
      };
    }
    // Priority 7: Emergency fund gap
    if (predictability?.emergencyFund && predictability.emergencyFund.fundingGap > 0) {
      return {
        icon: 'shield-checkmark', tint: c.success, kicker: 'Emergency Reserve', title: 'Build Safety Reserve',
        body: `Your liquid emergency reserve is ${formatCurrency(predictability.emergencyFund.fundingGap)} below the recommended ${predictability.emergencyFund.targetMonths || 6}-month essential buffer.`,
        action: 'View buffer', actionTarget: 'FinancialOutlook',
      };
    }
    // Priority 8: Fallback — contribution recommendation from raw solver (legacy path / no proactiveGuidance)
    if (rec?.solved && rec.additionalMonthlyContributionRequired > 0) {
      const stepUpText = rec.annualContributionGrowthRate && rec.annualContributionGrowthRate > 0
        ? ` (+${Math.round(rec.annualContributionGrowthRate * 100)}%/yr annual step-up)`
        : '';
      return {
        icon: 'trending-up', tint: c.primary, kicker: 'Retirement Outlook', title: 'Boost Target Confidence',
        body: `Increasing initial investments by ${formatCurrency(rec.additionalMonthlyContributionRequired)}/mo${stepUpText} improves your modeled retirement path toward age ${targetAge}.`,
        action: 'View outlook', actionTarget: 'FinancialOutlook',
      };
    }
    // Priority 9: Default on-track state
    return {
      icon: 'checkmark-circle', tint: c.success, kicker: 'Plan On Track', title: 'Current Plan Aligned',
      body: `Your current savings and investment trajectory meets your modeled retirement target for age ${targetAge}.`,
      action: 'View outlook', actionTarget: 'FinancialOutlook',
    };
  }, [predictability?.proactiveGuidance, predictability?.emergencyFund, isHistoryInsufficient, dashboard?.spendingSeries, rec, targetAge, nearestBill, daysUntilLiability, c]);

  // ── Today feed: the smart action first, then nudges from patterns and micro-actions ──
  const feed = useMemo<FeedItem[]>(() => {
    const items: FeedItem[] = [{ key: 'smart', ...smartAction, onPress: () => navigation.navigate(smartAction.actionTarget) }];
    upcomingBills
      .filter(({ date }) => date.getTime() - Date.now() < 3 * 86400000 && smartAction.actionTarget !== 'Liabilities')
      .slice(0, 1)
      .forEach(({ l, date }) => items.push({
        key: `bill-${l.id}`, icon: 'calendar', tint: c.warning, kicker: 'Due soon', title: `${l.name} · ${formatCurrency(l.amount)}`,
        body: `Due ${formatShortDate(date.toISOString())}${l.autoDeduct ? '. FINAURA will log it automatically.' : '. Remember to pay it.'}`,
        action: 'View bills', onPress: () => navigation.navigate('Liabilities'),
      }));
    (dashboard?.patterns ?? []).slice(0, 2).forEach((p, i) => items.push({
      key: `pattern-${i}`, icon: 'pulse', tint: p.severity === 'high' ? c.danger : c.warning, kicker: `${p.emoji} Spending pattern`,
      title: p.type.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase()), body: p.message,
      action: 'See transactions', onPress: () => navigation.navigate('Transactions'),
    }));
    (dashboard?.microActions ?? []).slice(0, 2).forEach((m) => items.push({
      key: `micro-${m.id}`, icon: 'flash', tint: c.primary, kicker: `Quick win · ${m.impact}`, title: m.title, body: m.description,
      action: m.actionText || 'Open plan', onPress: () => navigation.navigate('Plan'),
    }));
    const month = new Date().toLocaleDateString('en-IN', { month: 'long' });
    items.push({
      key: 'recap', icon: 'albums', tint: c.chart[3], kicker: 'Monthly recap', title: `Your ${month} so far`,
      body: 'Money in and out, where it went, and how your FMI score moved, as a quick story.',
      action: 'Play recap', onPress: () => navigation.navigate('Recap'),
    });
    return items;
  }, [smartAction, upcomingBills, dashboard?.patterns, dashboard?.microActions, navigation, c]);

  // Greeting: the time of day sits above the name so long names never truncate next to the buttons.
  const hour = new Date().getHours();
  const timeGreeting = hour < 5 ? 'Good evening' : hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = user?.name ? user.name.trim().split(' ')[0] : 'there';

  const todayFormatted = useMemo(
    () => new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' }),
    [],
  );

  const avatar = user?.avatarLocalUri || user?.avatar;
  const pillars = fmiData?.pillars
    ? [
      { label: 'Saving', score: fmiData.pillars.D1_savingDiscipline?.score ?? 0, color: c.success },
      { label: 'Spending', score: fmiData.pillars.D2_spendingControl?.score ?? 0, color: c.primary },
      { label: 'Behaviour', score: fmiData.pillars.D3_behavioralRisk?.score ?? 0, color: c.purple },
    ]
    : [];

  // ── Render ───────────────────────────────────────────────
  const content = () => {
    if (loading && !loadedRef.current) {
      return (
        <View style={styles.body}>
          {[0, 1, 2].map((i) => <SkeletonCard key={i} style={styles.gap} />)}
        </View>
      );
    }
    if (loadFailed && !dashboard) return <ErrorState onRetry={() => fetchAllData(true)} />;

    return (
      <View style={styles.body}>
        {/* ── Balance hero ─────────────────────────────── */}
        <Animated.View entering={enterUp(0)}>
          <Card variant="hero">
            <View style={styles.heroTop}>
              <View style={styles.heroMain}>
                <Text style={styles.heroLabel}>Current balance</Text>
                <Text style={styles.heroValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                  {formatCurrency(balance)}
                </Text>
              </View>
              <Pressable
                style={styles.updateBalanceBtn}
                onPress={() => setShowUpdateBalance(true)}
                accessibilityRole="button"
                accessibilityLabel="Update Current Balance"
              >
                <Ionicons name="create-outline" size={14} color={c.onAurora} />
                <Text style={styles.updateBalanceText}>Update</Text>
              </Pressable>
            </View>

            <View style={styles.heroBottom}>
              <Ring progress={spentShare} size={74} stroke={8} color="#FFFFFF" trackColor="rgba(255,255,255,0.18)">
                <Text style={styles.ringPct}>{Math.round(spentShare * 100)}%</Text>
              </Ring>
              <View style={styles.heroStats}>
                <Text style={styles.heroCaption} numberOfLines={2}>
                  {incomeThisMonth > 0 ? `of this month's ${formatCurrency(incomeThisMonth)} income spent` : 'Log income to track your pace'}
                </Text>
                <View style={styles.heroChips}>
                  <View style={styles.heroChip}>
                    <Text style={styles.heroChipLabel}>Spent</Text>
                    <Text style={styles.heroChipValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{formatCurrency(spendingThisMonth)}</Text>
                  </View>
                  <View style={styles.heroChip}>
                    <Text style={styles.heroChipLabel}>Invested</Text>
                    <Text style={styles.heroChipValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{formatCurrency(investmentsThisMonth)}</Text>
                  </View>
                </View>
              </View>
            </View>
          </Card>
        </Animated.View>

        {/* ── Today feed ───────────────────────────────── */}
        <SectionHeader title="Today" />
        <ScrollView
          horizontal
          pagingEnabled={false}
          snapToInterval={FEED_W + 12}
          decelerationRate="fast"
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.feed}
          onMomentumScrollEnd={(e) => setFeedPage(Math.round(e.nativeEvent.contentOffset.x / (FEED_W + 12)))}
        >
          {feed.map((item, i) => (
            <Animated.View key={item.key} entering={enterUp(i + 1)} style={{ width: FEED_W }}>
              <Card onPress={item.onPress} style={styles.feedCard} accessibilityLabel={`${item.kicker}: ${item.title}. ${item.action}`}>
                <View style={styles.feedTop}>
                  <IconTile icon={item.icon} tint={item.tint} size={36} />
                  <Text style={[styles.feedKicker, { color: item.tint }]} numberOfLines={1}>{item.kicker}</Text>
                </View>
                <Text style={styles.feedTitle} numberOfLines={2}>{item.title}</Text>
                <Text style={styles.feedBody} numberOfLines={3}>{item.body}</Text>
                <View style={styles.feedAction}>
                  <Text style={styles.feedActionText}>{item.action}</Text>
                  <Ionicons name="arrow-forward" size={14} color={c.primary} />
                </View>
              </Card>
            </Animated.View>
          ))}
        </ScrollView>
        {feed.length > 1 && (
          <View style={styles.pager}>
            {feed.map((f, i) => <View key={f.key} style={[styles.pagerDot, i === feedPage && styles.pagerDotOn]} />)}
          </View>
        )}

        {/* ── Financial Maturity Index ─────────────────────────── */}
        <SectionHeader title="Financial Maturity (FMI)" action="Details" onAction={() => navigation.navigate('FMI')} />
        <Card onPress={() => navigation.navigate('FMI')} style={styles.fmiCard} accessibilityLabel="View Financial Maturity Index details">
          <View style={styles.fmiScoreRow}>
            {/* Morphs into the FMI gauge on push once shared element transitions are built in. */}
            <Animated.View sharedTransitionTag="fmi-score">
              <Ring progress={(fmiScore ?? 0) / 100} size={84} stroke={9} color={fmiConfig.text}>
                <Text style={[styles.fmiScore, { color: fmiConfig.text }]}>{fmiScore ?? '—'}</Text>
              </Ring>
            </Animated.View>
            <View style={styles.fmiText}>
              <Badge label={fmiScore === null ? 'Not enough data' : fmiConfig.label} tone={fmiScore === null ? 'neutral' : fmiScore >= 70 ? 'success' : fmiScore >= 45 ? 'warning' : 'danger'} />
              <Text style={styles.fmiInsight} numberOfLines={3}>
                {fmiData?.insights?.[0] ?? dashboard?.insights?.[0] ?? 'Your saving discipline and spending control shape your score.'}
              </Text>
            </View>
          </View>
          {pillars.length > 0 && (
            <View style={styles.pillars}>
              {pillars.map((p, i) => (
                <View key={p.label} style={styles.pillar}>
                  <View style={styles.pillarTop}>
                    <Text style={styles.pillarLabel}>{p.label}</Text>
                    <Text style={styles.pillarScore}>{Math.round(p.score)}</Text>
                  </View>
                  <AnimatedBar progress={p.score / 100} color={p.color} height={5} delay={i * 120} />
                </View>
              ))}
            </View>
          )}
        </Card>

        {/* ── Spending ─────────────────────────────────── */}
        <SectionHeader title="Spending this month" action="Activity" onAction={() => navigation.navigate('Transactions')} />
        <Card onPress={() => navigation.navigate('Spending')} accessibilityLabel="Open the spending chart">
          <View style={styles.spendTop}>
            <MoneyText value={spendingThisMonth} style={styles.spendValue} />
            <View style={styles.spendHintRow}>
              <Text style={styles.spendHint}>Explore</Text>
              <Ionicons name="chevron-forward" size={14} color={c.textSubtle} />
            </View>
          </View>
          {svgReady && dailySpend.length > 1 && <Sparkline data={dailySpend} height={52} style={styles.spark} />}
          {hasSpendingData ? (
            <>
              <View style={styles.track}>
                {wantsNeeds!.needs.pct > 0 && <AnimatedSegment pct={wantsNeeds!.needs.pct} color={c.info} delay={0} />}
                {wantsNeeds!.wants.pct > 0 && <AnimatedSegment pct={wantsNeeds!.wants.pct} color={c.warning} delay={150} />}
                {wantsNeeds!.investments.pct > 0 && <AnimatedSegment pct={wantsNeeds!.investments.pct} color={c.success} delay={300} />}
              </View>
              <View style={styles.legend}>
                {[
                  { label: 'Needs', color: c.info, v: wantsNeeds!.needs },
                  { label: 'Wants', color: c.warning, v: wantsNeeds!.wants },
                  { label: 'Invest', color: c.success, v: wantsNeeds!.investments },
                ].map((x) => (
                  <View key={x.label} style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: x.color }]} />
                    <Text style={styles.legendLabel}>{x.label}</Text>
                    <Text style={styles.legendValue} numberOfLines={1}>{formatCurrency(x.v.amount)}</Text>
                  </View>
                ))}
              </View>
            </>
          ) : (
            <Text style={styles.muted}>No spending logged this month yet. Tap + to add your first.</Text>
          )}
        </Card>

        {/* ── Goals ────────────────────────────────────── */}
        <SectionHeader title="Goals" action="See all" onAction={() => navigation.navigate('Goals')} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.goalRow}>
          {goals.slice(0, 5).map((g, i) => {
            const pct = g.targetAmount > 0 ? Math.min(1, g.savedAmount / g.targetAmount) : 0;
            return (
              <Card key={g.id} onPress={() => navigation.navigate('Goals')} style={styles.goalCard} accessibilityLabel={`${g.name}, ${Math.round(pct * 100)}% saved`}>
                <Animated.Text sharedTransitionTag={`goal-${g.id}`} style={styles.goalEmoji}>{g.emoji || '🎯'}</Animated.Text>
                <Text style={styles.goalName} numberOfLines={1}>{g.name}</Text>
                <Text style={styles.goalAmount} numberOfLines={1}>{formatCurrency(g.savedAmount)}</Text>
                <AnimatedBar progress={pct} color={pct >= 1 ? c.success : c.primary} height={6} delay={i * 100} style={styles.goalBar} />
                <Text style={styles.goalOf} numberOfLines={1}>of {formatCurrency(g.targetAmount)}</Text>
              </Card>
            );
          })}
          <Card onPress={() => navigation.navigate('Goals')} style={[styles.goalCard, styles.goalNew]} accessibilityLabel="Open Savings Goals">
            <Ionicons name="add-circle" size={28} color={c.primary} />
            <Text style={styles.goalNewText}>{goals.length ? 'New goal' : 'Start a goal'}</Text>
            {goals.length > 0 && <Text style={styles.goalOf}>{Math.round(goalsSummary.pct * 100)}% of all goals</Text>}
          </Card>
        </ScrollView>

        {/* ── Bills ────────────────────────────────────── */}
        <SectionHeader title="Coming up" action="Bills" onAction={() => navigation.navigate('Liabilities')} />
        <Card padded={false} style={styles.list}>
          {upcomingBills.length === 0 ? (
            <Pressable onPress={() => navigation.navigate('Liabilities')} accessibilityRole="button" accessibilityLabel="View Liabilities and Scheduled Deductions">
              <Text style={styles.listEmpty}>
                {activeLiabilities.length ? 'Nothing due in the next 30 days.' : 'Add rent, EMIs or subscriptions to see what’s due.'}
              </Text>
            </Pressable>
          ) : (
            upcomingBills.slice(0, 3).map(({ l, date }, i) => (
              <Pressable key={l.id} onPress={() => navigation.navigate('Liabilities')} style={[styles.billRow, i > 0 && styles.divider]} accessibilityRole="button" accessibilityLabel={`${l.name}, ${formatCurrency(l.amount)}, due ${formatShortDate(date.toISOString())}`}>
                <View style={styles.datePill}>
                  <Text style={styles.datePillDay}>{date.getDate()}</Text>
                  <Text style={styles.datePillMonth}>{date.toLocaleDateString('en-IN', { month: 'short' })}</Text>
                </View>
                <View style={styles.flexShrink}>
                  <Text style={styles.rowTitle} numberOfLines={1}>{l.name}</Text>
                  <Text style={styles.rowSub}>{l.autoDeduct ? 'Auto deduct' : 'Pay manually'} · {l.frequency}</Text>
                </View>
                <Text style={styles.rowAmount}>{formatCurrency(l.amount)}</Text>
              </Pressable>
            ))
          )}
        </Card>

        {/* ── Money tiles ──────────────────────────────── */}
        <SectionHeader title="Your money" />
        <View style={styles.manageCard}>
          <Card onPress={() => navigation.navigate('Assets')} style={styles.tile} accessibilityLabel="View all assets">
            <IconTile icon="pie-chart" tint={c.info} size={34} />
            <Text style={styles.tileLabel}>Assets</Text>
            <Text style={styles.tileValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
              {assetSummary ? formatCurrency(assetSummary.totalValue) : '—'}
            </Text>
            <Text style={styles.tileSub} numberOfLines={2}>
              {assetSummary === null ? 'Loading…' : assetSummary.count === 0 ? 'No assets logged yet — tap to add your first.' : previewAssets.map((a) => a.name).join(', ')}
            </Text>
          </Card>
          <Card onPress={() => navigation.navigate('IncomeFlow')} style={styles.tile} accessibilityLabel="View, Log and Manage Income Receipts">
            <IconTile icon="wallet" tint={c.purple} size={34} />
            <Text style={styles.tileLabel}>Income</Text>
            <Text style={styles.tileValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
              {incomeReceived === null ? '—' : formatCurrency(incomeReceived)}
            </Text>
            <Text style={styles.tileSub} numberOfLines={2}>received this month</Text>
          </Card>
          <Card onPress={() => navigation.navigate('Liabilities')} style={styles.tile} accessibilityLabel="View Liabilities and Scheduled Deductions">
            <IconTile icon="calendar" tint={c.warning} size={34} />
            <Text style={styles.tileLabel}>Bills</Text>
            <Text style={styles.tileValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{formatCurrency(monthlyBills)}</Text>
            <Text style={styles.tileSub} numberOfLines={2}>{activeLiabilities.length} active · per month</Text>
          </Card>
        </View>

        {/* ── Outlook teaser ───────────────────────────── */}
        <SectionHeader title="Future outlook" action="Open" onAction={() => navigation.navigate('FinancialOutlook')} />
        <Card onPress={() => navigation.navigate('FinancialOutlook')} style={styles.outlook} accessibilityLabel="View Financial Outlook and Monte Carlo Simulation">
          <View style={styles.outlookProbCircleContainer}>
            <Ring progress={isMcAvailable ? (mcProb as number) : 0} size={88} stroke={9} color={isMcAvailable && (mcProb as number) >= 0.75 ? c.success : c.warning}>
              <View style={styles.outlookProbCircle}>
                <Text style={styles.outlookProbValue}>{isMcAvailable ? Math.round((mcProb as number) * 100) : '—'}</Text>
                <Text style={styles.outlookProbDenominator}>/100</Text>
              </View>
            </Ring>
          </View>
          <View style={styles.flexShrink}>
            <View style={styles.outlookProbPill}>
              <Text style={styles.outlookProbPillText}>{isMcAvailable ? ((mcProb as number) >= 0.75 ? 'On track' : 'Needs attention') : 'Calculating'}</Text>
            </View>
            <Text style={styles.outlookTitle} numberOfLines={2}>Modeled chance of a fully funded retirement</Text>
            <Text style={styles.outlookSub} numberOfLines={2}>Target age {targetAge} · 10,000 market paths simulated</Text>
          </View>
        </Card>

        {/* ── Household ────────────────────────────────── */}
        {hasActiveHousehold && familyDashboard ? (
          <Animated.View entering={enterUp(2)} style={styles.family}>
            <FamilyOverviewCard dashboard={familyDashboard} onPressViewDetails={() => navigation.navigate('Family')} />
          </Animated.View>
        ) : null}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: tabBarSpace }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchAllData(true)} tintColor={c.primary} progressViewOffset={insets.top} />}
      >
        {/* Greeting */}
        <View style={styles.header}>
          <View style={styles.flexShrink}>
            <Text style={styles.date} numberOfLines={1}>{timeGreeting} · {todayFormatted}</Text>
            <Text style={styles.greeting} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{firstName}</Text>
          </View>
          <Pressable
            onPress={() => navigation.navigate('Alerts')}
            style={styles.bell}
            accessibilityRole="button"
            accessibilityLabel={attention ? `Notifications, ${attention} new` : 'Notifications'}
          >
            <Ionicons name="notifications-outline" size={22} color={c.text} />
            {attention > 0 && <View style={styles.bellBadge}><Text style={styles.bellBadgeText}>{attention > 9 ? '9+' : attention}</Text></View>}
          </Pressable>
          <Pressable onPress={() => navigation.navigate('Profile')} style={styles.avatar} accessibilityRole="button" accessibilityLabel="View User Profile">
            {avatar ? <Image source={{ uri: avatar }} style={styles.avatarImg} /> : <Ionicons name="person" size={20} color={c.primary} />}
          </Pressable>
        </View>
        {content()}
      </Animated.ScrollView>
      {/* Blurs in once content scrolls under the status bar. */}
      <ScreenHeader title="Home" y={y} />

      <Modal
        visible={showUpdateBalance}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowUpdateBalance(false)}
      >
        <UpdateBalanceScreen
          onClose={() => {
            setShowUpdateBalance(false);
            fetchAllData();
          }}
        />
      </Modal>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════
const useStyles = createStyles((c) => ({
  container: { flex: 1, backgroundColor: c.bg },
  body: { paddingHorizontal: 16 },
  gap: { marginBottom: 12 },
  flexShrink: { flex: 1, flexShrink: 1 },
  muted: { ...typeScale.body, color: c.textMuted, marginTop: 8 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 18 },
  greeting: { ...typeScale.display, fontSize: 30, color: c.text, marginTop: 2 },
  date: { ...typeScale.label, color: c.textMuted },
  bell: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surface, borderWidth: 1, borderColor: c.border },
  bellBadge: { position: 'absolute', top: 6, right: 6, minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 3, alignItems: 'center', justifyContent: 'center', backgroundColor: c.danger },
  bellBadgeText: { fontSize: 10, fontWeight: '800', color: '#FFFFFF' },
  avatar: { width: 44, height: 44, borderRadius: 22, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: c.primarySoft },
  avatarImg: { width: '100%', height: '100%' },

  heroTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  heroMain: { flex: 1, flexShrink: 1 },
  heroLabel: { ...typeScale.caption, color: c.onAuroraMuted },
  heroValue: { ...typeScale.display, fontSize: 38, color: c.onAurora, marginTop: 2, ...tabular },
  updateBalanceBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.16)' },
  updateBalanceText: { fontSize: 13, fontWeight: '700', color: c.onAurora },
  heroBottom: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 18 },
  ringPct: { fontSize: 16, fontWeight: '800', color: c.onAurora, ...tabular },
  heroStats: { flex: 1, flexShrink: 1 },
  heroCaption: { ...typeScale.caption, color: c.onAuroraMuted },
  heroChips: { flexDirection: 'row', gap: 8, marginTop: 10 },
  heroChip: { flex: 1, paddingHorizontal: 10, paddingVertical: 8, borderRadius: radius.md, backgroundColor: 'rgba(255,255,255,0.12)' },
  heroChipLabel: { fontSize: 11, color: c.onAuroraMuted },
  heroChipValue: { ...typeScale.headline, fontSize: 15, color: c.onAurora, marginTop: 1, ...tabular },

  feed: { gap: 12, paddingRight: 16 },
  feedCard: { minHeight: 176 },
  feedTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  feedKicker: { ...typeScale.overline, flexShrink: 1 },
  feedTitle: { ...typeScale.headline, color: c.text, marginTop: 12 },
  feedBody: { ...typeScale.body, fontSize: 14, color: c.textMuted, marginTop: 4 },
  feedAction: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 'auto', paddingTop: 10 },
  feedActionText: { ...typeScale.label, color: c.primary },
  pager: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 10 },
  pagerDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: c.borderStrong },
  pagerDotOn: { width: 16, backgroundColor: c.primary },

  fmiCard: {},
  fmiScoreRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  fmiScore: { fontSize: 26, fontWeight: '800', ...tabular },
  fmiText: { flex: 1, flexShrink: 1, gap: 8 },
  fmiInsight: { ...typeScale.body, fontSize: 14, color: c.textMuted },
  pillars: { flexDirection: 'row', gap: 12, marginTop: 16 },
  pillar: { flex: 1, gap: 6 },
  pillarTop: { flexDirection: 'row', justifyContent: 'space-between' },
  pillarLabel: { fontSize: 12, color: c.textMuted },
  pillarScore: { fontSize: 12, fontWeight: '700', color: c.text, ...tabular },

  spendTop: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  spendValue: { ...typeScale.title, color: c.text },
  spendHintRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  spendHint: { ...typeScale.caption, color: c.textSubtle },
  spark: { marginTop: 8, marginHorizontal: -4 },
  track: { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', backgroundColor: c.surfaceAlt, marginTop: 14 },
  legend: { flexDirection: 'row', marginTop: 12 },
  legendItem: { flex: 1, gap: 2 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { fontSize: 12, color: c.textMuted, marginTop: 4 },
  legendValue: { fontSize: 14, fontWeight: '700', color: c.text, ...tabular },

  goalRow: { gap: 10, paddingRight: 16 },
  goalCard: { width: 148, padding: 14 },
  goalEmoji: { fontSize: 24 },
  goalName: { fontSize: 14, fontWeight: '600', color: c.text, marginTop: 8 },
  goalAmount: { ...typeScale.headline, color: c.text, marginTop: 2, ...tabular },
  goalBar: { marginTop: 8 },
  goalOf: { fontSize: 11, color: c.textSubtle, marginTop: 6 },
  goalNew: { alignItems: 'center', justifyContent: 'center', borderStyle: 'dashed', borderWidth: 1.5, borderColor: c.borderStrong, backgroundColor: 'transparent', boxShadow: 'none' },
  goalNewText: { ...typeScale.label, color: c.primary, marginTop: 6 },

  list: { paddingHorizontal: 14, paddingVertical: 4 },
  listEmpty: { ...typeScale.body, color: c.textMuted, paddingVertical: 14, textAlign: 'center' },
  billRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
  datePill: { width: 44, paddingVertical: 6, alignItems: 'center', borderRadius: radius.sm, backgroundColor: c.warningSoft },
  datePillDay: { ...typeScale.headline, color: c.warningStrong, ...tabular },
  datePillMonth: { fontSize: 10, fontWeight: '700', color: c.warningStrong },
  rowTitle: { fontSize: 15, fontWeight: '600', color: c.text },
  rowSub: { fontSize: 12, color: c.textMuted, marginTop: 2 },
  rowAmount: { fontSize: 15, fontWeight: '700', color: c.text, ...tabular },

  manageCard: { flexDirection: 'row', gap: 10 },
  tile: { flex: 1, padding: 14, minHeight: 150 },
  tileLabel: { fontSize: 12, color: c.textMuted, marginTop: 10 },
  tileValue: { ...typeScale.headline, color: c.text, marginTop: 2, ...tabular },
  tileSub: { fontSize: 11, color: c.textSubtle, marginTop: 4 },

  outlook: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  outlookProbCircleContainer: { alignItems: 'center', justifyContent: 'center' },
  outlookProbCircle: { alignItems: 'center' },
  outlookProbValue: { fontSize: 24, fontWeight: '800', color: c.text, ...tabular },
  outlookProbDenominator: { fontSize: 11, color: c.textSubtle, marginTop: -2 },
  outlookProbPill: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: c.primarySoft },
  outlookProbPillText: { fontSize: 11, fontWeight: '700', color: c.primary },
  outlookTitle: { ...typeScale.headline, fontSize: 15, color: c.text, marginTop: 8 },
  outlookSub: { ...typeScale.caption, color: c.textMuted, marginTop: 4 },
  family: { marginTop: 24 },
}));
