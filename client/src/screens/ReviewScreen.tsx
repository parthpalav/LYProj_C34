import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import Animated, { FadeInRight, FadeOutLeft } from 'react-native-reanimated';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getTransactions, updateTransaction } from '../services/api';
import { useStore } from '../store/useStore';
import { toast } from '../store/useCelebrationStore';
import { Transaction } from '../types';
import { createStyles, radius, tabular, typeScale, useTheme } from '../theme';
import { duration } from '../motion';
import { formatCurrency } from '../utils/format';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/Bits';
import { CategoryGrid } from '../components/ui/CategoryGrid';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { CATEGORY_ITEMS } from '../utils/categories';
import { Button } from '../components/ui/Button';
import { ScreenHeader, useHeaderHeight } from '../components/ui/ScreenHeader';
import { SkeletonCard } from '../components/motion/Skeleton';

const TYPES = ['Need', 'Want', 'Investment'] as const;

/**
 * One card at a time for transactions the classifier flagged as unsure. Confirming or correcting sends a
 * manual label, which clears the flag and teaches merchant memory for next time.
 */
export function ReviewScreen() {
  const s = useStyles();
  const { c } = useTheme();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const setTransactions = useStore((st) => st.setTransactions);
  const [queue, setQueue] = useState<Transaction[] | null>(null);
  const [category, setCategory] = useState('');
  const [type, setType] = useState<(typeof TYPES)[number]>('Need');
  const [done, setDone] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const pick = (tx?: Transaction) => {
    setCategory(tx?.category ?? '');
    setType(tx?.type ?? 'Need');
  };

  const load = useCallback(async () => {
    try {
      const all = await getTransactions();
      setTransactions(all);
      const pending = all.filter((t) => t.needsReview).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setQueue(pending);
      pick(pending[0]);
    } catch {
      setQueue([]);
      toast("Couldn't load transactions", { tone: 'error' });
    }
  }, [setTransactions]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const current = queue?.[0];
  const corrected = current && (category !== current.category || type !== current.type);

  const submit = async () => {
    if (!current) return;
    try {
      // Always send the label: the server marks it manual, clears needsReview and remembers the merchant.
      await updateTransaction(current.id, { category, type });
      const rest = queue!.slice(1);
      setQueue(rest);
      pick(rest[0]);
      setDone((n) => n + 1);
      if (!rest.length) toast('All caught up', { subtitle: 'FINAURA will remember these merchants.' });
    } catch {
      toast("Couldn't save that", { tone: 'error' });
    }
  };

  const skip = () => {
    if (!queue || queue.length < 2) return;
    const rest = [...queue.slice(1), queue[0]];
    setQueue(rest);
    pick(rest[0]);
  };

  return (
    <View style={s.screen}>
      <ScrollView
        contentContainerStyle={{ paddingTop: headerHeight + 8, paddingBottom: insets.bottom + 32, paddingHorizontal: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} tintColor={c.primary} progressViewOffset={headerHeight} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
      >
        {queue === null ? (
          <SkeletonCard />
        ) : !current ? (
          <EmptyState emoji="✅" title={done ? 'All caught up' : 'Nothing to check'} message="When FINAURA isn't sure how to label a transaction, it lands here." />
        ) : (
          <>
            <Text style={s.progress}>{queue.length} left{done ? ` · ${done} done` : ''}</Text>
            <Animated.View key={current.id} entering={FadeInRight.duration(duration.slow)} exiting={FadeOutLeft.duration(duration.fast)}>
              <Card variant="hero" style={s.hero}>
                <Text style={s.heroDesc} numberOfLines={2}>{current.description || 'Transaction'}</Text>
                <Text style={s.heroAmount}>{formatCurrency(Math.abs(current.amount))}</Text>
                <Text style={s.heroDate}>{new Date(current.timestamp).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</Text>
                <View style={s.guess}>
                  <Text style={s.guessLabel}>FINAURA guessed</Text>
                  <Text style={s.guessValue}>{current.category} · {current.type ?? 'Need'}</Text>
                </View>
              </Card>

              <Text style={s.label}>Category</Text>
              <CategoryGrid items={CATEGORY_ITEMS} isSelected={(key) => key === category} onPress={setCategory} />

              <Text style={s.label}>Type</Text>
              <SegmentedControl
                segments={TYPES.map((t) => ({ key: t, label: t, dot: { Need: c.info, Want: c.warningStrong, Investment: c.successStrong }[t] }))}
                value={type}
                onChange={setType}
                accessibilityLabel="Type"
              />

              <Button label={corrected ? 'Save correction' : 'Looks right'} icon={corrected ? 'create-outline' : 'checkmark'} onPress={submit} style={s.cta} />
              {queue.length > 1 && <Button label="Skip for now" variant="ghost" onPress={skip} />}
            </Animated.View>
          </>
        )}
      </ScrollView>
      <ScreenHeader title="Check AI guesses" onBack={() => navigation.goBack()} />
    </View>
  );
}

const useStyles = createStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.bg },
  flex: { flex: 1 },
  progress: { ...typeScale.overline, color: c.textSubtle, marginBottom: 10 },
  hero: { marginBottom: 8 },
  heroDesc: { ...typeScale.headline, color: c.onAurora },
  heroAmount: { ...typeScale.display, color: c.onAurora, marginTop: 6, ...tabular },
  heroDate: { ...typeScale.caption, color: c.onAuroraMuted },
  guess: { marginTop: 16, padding: 12, borderRadius: radius.md, backgroundColor: 'rgba(255,255,255,0.12)' },
  guessLabel: { fontSize: 11, color: c.onAuroraMuted },
  guessValue: { ...typeScale.headline, fontSize: 15, color: c.onAurora, marginTop: 2 },
  label: { ...typeScale.overline, color: c.textSubtle, marginTop: 18, marginBottom: 10 },
  cta: { marginTop: 22 },
}));
