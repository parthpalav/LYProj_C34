import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Dimensions, NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, Share, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getMonthlyReport } from '../services/api';
import { MonthlyReport } from '../types';
import { createStyles, radius, tabular, typeScale } from '../theme';
import { formatCurrency } from '../utils/format';
import { AnimatedNumber } from '../components/motion/AnimatedNumber';
import { AnimatedBar } from '../components/motion/AnimatedBar';
import { AuroraBackground } from '../components/ui/AuroraBackground';
import { Button } from '../components/ui/Button';
import { Chip } from '../components/ui/Bits';

const { width: W } = Dimensions.get('window');
const PAGES = 6;

const enter = (i: number) => FadeInDown.delay(120 + i * 110).duration(520);

/** "Wrapped"-style story of one month: money in and out, where it went, mix, health score, surprises. */
export function RecapScreen() {
  const s = useStyles();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const scroller = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const now = new Date();
  const [offset, setOffset] = useState(0); // 0 = this month, 1 = last month
  const [report, setReport] = useState<MonthlyReport | null>(null);
  const [failed, setFailed] = useState(false);
  const [page, setPage] = useState(0);

  const load = useCallback(async () => {
    const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    setReport(null);
    setFailed(false);
    try {
      setReport(await getMonthlyReport(d.getFullYear(), d.getMonth() + 1));
    } catch {
      setFailed(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offset]);

  useEffect(() => { load(); }, [load]);

  const goTo = (p: number) => {
    const next = Math.max(0, Math.min(PAGES - 1, p));
    scroller.current?.scrollTo({ x: next * W, animated: true });
    setPage(next);
    Haptics.selectionAsync().catch(() => {});
  };

  const onEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const p = Math.round(e.nativeEvent.contentOffset.x / W);
    if (p !== page) Haptics.selectionAsync().catch(() => {});
    setPage(p);
  };

  const share = () => {
    if (!report) return;
    const top = report.topCategories[0];
    Share.share({
      message: `My ${report.periodLabel} on FINAURA: ${formatCurrency(report.totalIncome)} in, ${formatCurrency(report.totalExpenses)} out, ${report.savingsRate}% saved.${top ? ` Biggest category: ${top.category}.` : ''}`,
    }).catch(() => {});
  };

  const mixTotal = report ? report.spendingMix.Needs + report.spendingMix.Wants + report.spendingMix.Investments : 0;
  const mix = report
    ? [
      { label: 'Needs', value: report.spendingMix.Needs, color: '#93C5FD' },
      { label: 'Wants', value: report.spendingMix.Wants, color: '#FCD34D' },
      { label: 'Investments', value: report.spendingMix.Investments, color: '#6EE7B7' },
    ]
    : [];

  const pages = report ? [
    // 1 · Intro
    <View key="intro" style={s.page}>
      <Animated.Text entering={enter(0)} style={s.kicker}>Your month in money</Animated.Text>
      <Animated.Text entering={enter(1)} style={s.huge}>{report.periodLabel}</Animated.Text>
      <Animated.Text entering={enter(2)} style={s.body}>{report.transactionCount} transactions and {report.incomeCount} income receipt{report.incomeCount === 1 ? '' : 's'}. Swipe to see how it went.</Animated.Text>
      <Animated.View entering={enter(3)} style={s.chips}>
        <Chip label="This month" selected={offset === 0} onPress={() => setOffset(0)} />
        <Chip label="Last month" selected={offset === 1} onPress={() => setOffset(1)} />
      </Animated.View>
    </View>,
    // 2 · In and out
    <View key="flow" style={s.page}>
      <Animated.Text entering={enter(0)} style={s.kicker}>Money in, money out</Animated.Text>
      <Animated.View entering={enter(1)} style={s.stat}>
        <Text style={s.statLabel}>Came in</Text>
        <AnimatedNumber value={report.totalIncome} style={s.big} />
      </Animated.View>
      <Animated.View entering={enter(2)} style={s.stat}>
        <Text style={s.statLabel}>Went out</Text>
        <AnimatedNumber value={report.totalExpenses} style={s.big} />
      </Animated.View>
      <Animated.View entering={ZoomIn.delay(520).springify().damping(14)} style={s.badge}>
        <Text style={s.badgeText}>{report.netCashFlow >= 0 ? `You kept ${report.savingsRate}%` : `Overspent by ${formatCurrency(Math.abs(report.netCashFlow))}`}</Text>
      </Animated.View>
    </View>,
    // 3 · Where it went
    <View key="where" style={s.page}>
      <Animated.Text entering={enter(0)} style={s.kicker}>Where it went</Animated.Text>
      {report.topCategories.length === 0 ? (
        <Animated.Text entering={enter(1)} style={s.body}>No spending logged this month.</Animated.Text>
      ) : (
        report.topCategories.slice(0, 4).map((cat, i) => (
          <Animated.View key={cat.category} entering={enter(i + 1)} style={s.catRow}>
            <View style={s.catTop}>
              <Text style={s.catName}>{i + 1}. {cat.category}</Text>
              <Text style={s.catAmount}>{formatCurrency(cat.amount)}</Text>
            </View>
            <AnimatedBar progress={cat.pct / 100} color={i === 0 ? '#FFFFFF' : 'rgba(255,255,255,0.6)'} trackColor="rgba(255,255,255,0.15)" height={8} delay={200 + i * 120} />
          </Animated.View>
        ))
      )}
    </View>,
    // 4 · Mix
    <View key="mix" style={s.page}>
      <Animated.Text entering={enter(0)} style={s.kicker}>Needs, wants, future you</Animated.Text>
      {mix.map((m, i) => (
        <Animated.View key={m.label} entering={enter(i + 1)} style={s.mixRow}>
          <View style={[s.mixDot, { backgroundColor: m.color }]} />
          <Text style={s.mixLabel}>{m.label}</Text>
          <Text style={s.mixPct}>{mixTotal > 0 ? Math.round((m.value / mixTotal) * 100) : 0}%</Text>
        </Animated.View>
      ))}
      <Animated.Text entering={enter(4)} style={s.body}>
        {mixTotal > 0 && report.spendingMix.Wants / mixTotal > 0.3 ? 'Wants took more than the usual 30% guide.' : 'Wants stayed within the usual 30% guide. Nice.'}
      </Animated.Text>
    </View>,
    // 5 · Health score
    <View key="fmi" style={s.page}>
      <Animated.Text entering={enter(0)} style={s.kicker}>Financial Health Score</Animated.Text>
      {report.fmi.hasSnapshots && report.fmi.last !== null ? (
        <>
          <Animated.View entering={ZoomIn.delay(150).springify().damping(14)}>
            <AnimatedNumber value={Math.round(report.fmi.last)} format={(n) => String(n)} style={s.giant} />
          </Animated.View>
          <Animated.Text entering={enter(2)} style={s.body}>
            {report.fmi.change === null || report.fmi.change === 0
              ? 'Steady through the month.'
              : `${report.fmi.change > 0 ? 'Up' : 'Down'} ${Math.abs(Math.round(report.fmi.change))} points since the start of the month.`}
          </Animated.Text>
        </>
      ) : (
        <Animated.Text entering={enter(1)} style={s.body}>Open the app a few more days this month to track how your score moves.</Animated.Text>
      )}
    </View>,
    // 6 · Surprises + share
    <View key="end" style={s.page}>
      <Animated.Text entering={enter(0)} style={s.kicker}>Anything unusual?</Animated.Text>
      {report.anomalies.count === 0 ? (
        <Animated.Text entering={enter(1)} style={s.big}>Nothing odd 🎉</Animated.Text>
      ) : (
        <>
          <Animated.Text entering={enter(1)} style={s.big}>{report.anomalies.count} big spend{report.anomalies.count === 1 ? '' : 's'}</Animated.Text>
          {report.anomalies.items.slice(0, 3).map((a, i) => (
            <Animated.View key={a.id} entering={enter(i + 2)} style={s.catTop}>
              <Text style={s.catName} numberOfLines={1}>{a.description || a.category}</Text>
              <Text style={s.catAmount}>{formatCurrency(a.amount)}</Text>
            </Animated.View>
          ))}
        </>
      )}
      <Animated.View entering={FadeIn.delay(600)} style={s.endActions}>
        <Button label="Share summary" icon="share-outline" variant="secondary" onPress={share} style={s.flex} />
        <Button label="Done" onPress={() => navigation.goBack()} style={s.flex} />
      </Animated.View>
    </View>,
  ] : [];

  return (
    <View style={s.screen}>
      <AuroraBackground />
      {/* Story progress */}
      <View style={[s.top, { paddingTop: insets.top + 8 }]}>
        <View style={s.segments}>
          {Array.from({ length: PAGES }, (_, i) => <View key={i} style={[s.segment, i <= page && s.segmentOn]} />)}
        </View>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={s.close} accessibilityRole="button" accessibilityLabel="Close recap">
          <Ionicons name="close" size={22} color="#FFFFFF" />
        </Pressable>
      </View>

      {!report ? (
        <View style={s.center}>
          {failed ? (
            <>
              <Text style={s.body}>Couldn't load this month's recap.</Text>
              <Button label="Try again" variant="secondary" onPress={load} style={s.retry} />
            </>
          ) : (
            <ActivityIndicator color="#FFFFFF" />
          )}
        </View>
      ) : (
        <ScrollView ref={scroller} horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={onEnd}>
          {pages.map((content, i) => (
            <Pressable
              key={i}
              style={{ width: W }}
              // Tap the left third to go back, anywhere else to go forward, like stories.
              onPress={(e) => goTo(e.nativeEvent.locationX < W / 3 ? i - 1 : i + 1)}
              accessible={false}
            >
              {page === i ? content : <View style={s.page} />}
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const useStyles = createStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.aurora[0] },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  top: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 2, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16 },
  segments: { flex: 1, flexDirection: 'row', gap: 4 },
  segment: { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)' },
  segmentOn: { backgroundColor: '#FFFFFF' },
  close: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.15)' },
  page: { flex: 1, justifyContent: 'center', paddingHorizontal: 28, gap: 14 },
  kicker: { ...typeScale.overline, color: c.onAuroraMuted },
  huge: { ...typeScale.display, fontSize: 44, lineHeight: 50, color: c.onAurora },
  giant: { fontSize: 96, fontWeight: '900', color: c.onAurora, ...tabular },
  big: { ...typeScale.display, color: c.onAurora, ...tabular },
  body: { ...typeScale.body, fontSize: 17, lineHeight: 24, color: c.onAuroraMuted },
  chips: { flexDirection: 'row', gap: 8, marginTop: 8 },
  stat: { gap: 2 },
  statLabel: { ...typeScale.label, color: c.onAuroraMuted },
  badge: { alignSelf: 'flex-start', marginTop: 8, paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.18)' },
  badgeText: { ...typeScale.headline, color: c.onAurora },
  catRow: { gap: 8 },
  catTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  catName: { ...typeScale.headline, color: c.onAurora, flexShrink: 1 },
  catAmount: { ...typeScale.headline, color: c.onAurora, ...tabular },
  mixRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  mixDot: { width: 14, height: 14, borderRadius: 7 },
  mixLabel: { ...typeScale.title, color: c.onAurora, flex: 1 },
  mixPct: { ...typeScale.title, color: c.onAurora, ...tabular },
  endActions: { flexDirection: 'row', gap: 10, marginTop: 24 },
  retry: { marginTop: 16, alignSelf: 'center', paddingHorizontal: 20 },
}));

