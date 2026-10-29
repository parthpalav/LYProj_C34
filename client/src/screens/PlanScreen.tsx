import React, { useCallback, useState } from 'react';
import { RefreshControl, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { getAssets, getCurrentFamily, getGoals, getIncomeFlow, getLiabilities } from '../services/api';
import { Asset, FamilySummary, Goal, IncomeFlowData, Liability } from '../types';
import { createStyles, typeScale, useTheme } from '../theme';
import { enterUp } from '../motion';
import { formatCurrency, monthlyEquivalent } from '../utils/format';
import { Card } from '../components/ui/Card';
import { IconTile } from '../components/ui/Bits';
import { LargeTitle, ScreenHeader, useHeaderHeight, useScrollHeader } from '../components/ui/ScreenHeader';
import { AnimatedBar } from '../components/motion/AnimatedBar';
import { useTabBarSpace } from '../components/navigation/TabBar';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

type PlanData = {
  goals?: Goal[];
  liabilities?: Liability[];
  assets?: Asset[];
  income?: IncomeFlowData;
  family?: FamilySummary | null;
};

const settled = <T,>(r: PromiseSettledResult<T>) => (r.status === 'fulfilled' ? r.value : undefined);

/** Hub for everything forward-looking: goals, bills, wealth, income, household and the outlook. */
export function PlanScreen(): React.ReactElement {
  const styles = useStyles();
  const { c } = useTheme();
  const navigation = useNavigation<any>();
  const headerHeight = useHeaderHeight();
  const bottomSpace = useTabBarSpace();
  const { y, onScroll } = useScrollHeader({ hidesTabBar: true });
  const [data, setData] = useState<PlanData>({});
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [goals, liabilities, assets, income, family] = await Promise.allSettled([
      getGoals(), getLiabilities(), getAssets(), getIncomeFlow(), getCurrentFamily(),
    ]);
    setData({ goals: settled(goals), liabilities: settled(liabilities), assets: settled(assets), income: settled(income), family: settled(family) });
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const goals = data.goals;
  const saved = goals?.reduce((s, g) => s + (g.savedAmount || 0), 0) ?? 0;
  const target = goals?.reduce((s, g) => s + (g.targetAmount || 0), 0) ?? 0;
  const bills = data.liabilities?.filter((l) => l.status !== 'deleted');
  const monthlyBills = bills?.reduce((s, l) => s + monthlyEquivalent(l.amount, l.frequency), 0) ?? 0;
  const netAssets = data.assets?.reduce((s, a) => s + (a.currentValue || 0), 0);
  const memberCount = data.family?.members?.length ?? 0;

  const tiles: { key: string; route: string; icon: IconName; tint: string; title: string; value: string; caption: string; progress?: number }[] = [
    {
      key: 'goals', route: 'Goals', icon: 'flag', tint: c.success, title: 'Goals',
      value: goals ? (goals.length ? `${Math.round(target ? (saved / target) * 100 : 0)}%` : 'Start one') : '—',
      caption: goals ? (goals.length ? `${formatCurrency(saved)} of ${formatCurrency(target)}` : 'Save for something') : 'Loading…',
      progress: target ? saved / target : undefined,
    },
    {
      key: 'bills', route: 'Liabilities', icon: 'calendar', tint: c.warning, title: 'Bills',
      value: bills ? formatCurrency(monthlyBills) : '—',
      caption: bills ? `${bills.length} active · per month` : 'Loading…',
    },
    {
      key: 'assets', route: 'Assets', icon: 'pie-chart', tint: c.info, title: 'Assets',
      value: netAssets !== undefined ? formatCurrency(netAssets) : '—',
      caption: data.assets ? `${data.assets.length} holdings` : 'Loading…',
    },
    {
      key: 'income', route: 'IncomeFlow', icon: 'wallet', tint: c.purple, title: 'Income',
      value: data.income ? formatCurrency(data.income.total) : '—',
      caption: data.income ? `${data.income.incomeCount} receipt${data.income.incomeCount === 1 ? '' : 's'} this month` : 'Loading…',
    },
  ];

  return (
    <View style={styles.root}>
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingTop: headerHeight, paddingBottom: bottomSpace }}
        refreshControl={<RefreshControl refreshing={refreshing} progressViewOffset={headerHeight} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
      >
        <LargeTitle title="Plan" subtitle="Goals, bills, wealth and the road ahead." />

        <View style={styles.body}>
          <Animated.View entering={enterUp(0)}>
            <Card variant="hero" onPress={() => navigation.navigate('FinancialOutlook')} accessibilityLabel="Open Future Outlook">
              <View style={styles.heroRow}>
                <View style={styles.heroIcon}>
                  <Ionicons name="telescope" size={22} color={c.onAurora} />
                </View>
                <View style={styles.flex}>
                  <Text style={styles.heroTitle}>Future Outlook</Text>
                  <Text style={styles.heroBody}>Retirement odds, 10,000 simulated markets and what-if scenarios.</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={c.onAuroraMuted} />
              </View>
            </Card>
          </Animated.View>

          <View style={styles.grid}>
            {tiles.map((t, i) => (
              <Animated.View key={t.key} entering={enterUp(i + 1)} style={styles.cell}>
                <Card onPress={() => navigation.navigate(t.route)} style={styles.tile} accessibilityLabel={`${t.title}: ${t.value}, ${t.caption}`}>
                  <IconTile icon={t.icon} tint={t.tint} size={36} />
                  <Text style={styles.tileTitle}>{t.title}</Text>
                  <Text style={styles.tileValue} numberOfLines={1} adjustsFontSizeToFit>{t.value}</Text>
                  {t.progress !== undefined && <AnimatedBar progress={t.progress} color={t.tint} height={5} style={styles.tileBar} />}
                  <Text style={styles.tileCaption} numberOfLines={2}>{t.caption}</Text>
                </Card>
              </Animated.View>
            ))}
          </View>

          <Animated.View entering={enterUp(5)}>
            <Card onPress={() => navigation.navigate('Insights')} style={styles.wide} accessibilityLabel="Open spending insights">
              <IconTile icon="analytics" tint={c.info} />
              <View style={styles.flex}>
                <Text style={styles.wideTitle}>Insights</Text>
                <Text style={styles.wideBody}>Budget pace, categories, a spending calendar and habits.</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={c.textSubtle} />
            </Card>
          </Animated.View>

          <Animated.View entering={enterUp(6)}>
            <Card onPress={() => navigation.navigate('FMI')} style={styles.wide} accessibilityLabel="Open Financial Maturity Index">
              <IconTile icon="pulse" tint={c.primary} />
              <View style={styles.flex}>
                <Text style={styles.wideTitle}>Financial Maturity Index</Text>
                <Text style={styles.wideBody}>What's driving your score and how to lift it.</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={c.textSubtle} />
            </Card>
          </Animated.View>

          <Animated.View entering={enterUp(7)} style={styles.pair}>
            <Card onPress={() => navigation.navigate('Recap')} style={styles.half} accessibilityLabel="Play your monthly recap">
              <IconTile icon="albums" tint={c.chart[3]} size={36} />
              <Text style={styles.wideTitle}>Monthly recap</Text>
              <Text style={styles.wideBody}>Your month as a quick story.</Text>
            </Card>
            <Card onPress={() => navigation.navigate('Envelopes')} style={styles.half} accessibilityLabel="Open round-up savings">
              <IconTile icon="sparkles" tint={c.success} size={36} />
              <Text style={styles.wideTitle}>Round-ups</Text>
              <Text style={styles.wideBody}>Vault the loose change.</Text>
            </Card>
          </Animated.View>

          <Animated.View entering={enterUp(8)}>
            <Card onPress={() => navigation.navigate('Family')} style={styles.wide} accessibilityLabel="Open Family and Household">
              <IconTile icon="people" tint={c.chart[3]} />
              <View style={styles.flex}>
                <Text style={styles.wideTitle}>{data.family ? data.family.name || 'Your household' : 'Family & Household'}</Text>
                <Text style={styles.wideBody}>
                  {data.family ? `${memberCount} member${memberCount === 1 ? '' : 's'} · shared health and spending` : 'Invite someone to plan together. Your transactions stay private.'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={c.textSubtle} />
            </Card>
          </Animated.View>
        </View>
      </Animated.ScrollView>
      <ScreenHeader title="Plan" y={y} />
    </View>
  );
}

const useStyles = createStyles((c) => ({
  root: {
    flex: 1,
    backgroundColor: c.bg,
  },
  body: {
    paddingHorizontal: 16,
    gap: 12,
  },
  flex: {
    flex: 1,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 6,
  },
  heroIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  heroTitle: {
    ...typeScale.headline,
    color: c.onAurora,
  },
  heroBody: {
    ...typeScale.caption,
    color: c.onAuroraMuted,
    marginTop: 3,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  cell: {
    width: '50%',
    padding: 6,
  },
  tile: {
    minHeight: 150,
  },
  tileTitle: {
    ...typeScale.label,
    color: c.textMuted,
    marginTop: 12,
  },
  tileValue: {
    ...typeScale.title,
    color: c.text,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  tileBar: {
    marginTop: 8,
  },
  tileCaption: {
    ...typeScale.caption,
    color: c.textSubtle,
    marginTop: 6,
  },
  pair: {
    flexDirection: 'row',
    gap: 12,
  },
  half: {
    flex: 1,
    gap: 8,
  },
  wide: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  wideTitle: {
    ...typeScale.headline,
    fontSize: 16,
    color: c.text,
  },
  wideBody: {
    ...typeScale.caption,
    color: c.textMuted,
    marginTop: 2,
  },
}));
