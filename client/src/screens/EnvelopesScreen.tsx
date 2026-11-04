import React, { useCallback, useState } from 'react';
import { RefreshControl, Text, TextInput, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getEnvelopes, getRoundupPreview, simulateMicroSavings } from '../services/api';
import { celebrate, toast } from '../store/useCelebrationStore';
import { EnvelopeData } from '../types';
import { createStyles, radius, tabular, typeScale, useTheme } from '../theme';
import { enterUp } from '../motion';
import { formatCurrency } from '../utils/format';
import { PiggyBank } from '../components/motion/PiggyBank';
import { Card } from '../components/ui/Card';
import { Chip, ErrorState, IconTile, MoneyText, SectionHeader } from '../components/ui/Bits';
import { Button } from '../components/ui/Button';
import { LargeTitle, ScreenHeader, useHeaderHeight, useScrollHeader } from '../components/ui/ScreenHeader';

/** Round-up vault: tuck away the loose change from purchases, a little at a time. */
export function EnvelopesScreen(): React.ReactElement {
  const { c, isDark } = useTheme();
  const styles = useStyles();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { y, onScroll } = useScrollHeader();
  const [envelope, setEnvelope] = useState<EnvelopeData | null>(null);
  const [preview, setPreview] = useState<{ amount: number; previewText: string } | null>(null);
  const [custom, setCustom] = useState('');
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [env, pre] = await Promise.allSettled([getEnvelopes(), getRoundupPreview()]);
    if (env.status === 'fulfilled') setEnvelope(env.value);
    if (pre.status === 'fulfilled') setPreview(pre.value);
    setFailed(env.status === 'rejected');
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const vault = async (amount: number) => {
    if (!(amount > 0)) return toast('Enter an amount greater than zero', { tone: 'warning' });
    try {
      await simulateMicroSavings(amount);
      const before = envelope?.savings ?? 0;
      setCustom('');
      await load();
      const target = envelope?.targetSavings ?? 0;
      celebrate(target > 0
        ? { kind: 'piggy', from: before / target, to: (before + amount) / target, title: `${formatCurrency(amount)} vaulted`, subtitle: 'Small amounts add up.' }
        : { kind: 'coins', title: `${formatCurrency(amount)} vaulted`, subtitle: 'Small amounts add up.' });
    } catch {
      toast("Couldn't move that into the vault", { tone: 'error' });
    }
  };

  const saved = envelope?.savings ?? 0;
  const target = envelope?.targetSavings ?? 0;

  return (
    <View style={styles.screen}>
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingTop: headerHeight, paddingBottom: insets.bottom + 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} progressViewOffset={headerHeight} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
      >
        <LargeTitle title="Round-ups" subtitle="Save the loose change from everyday spending" />
        <View style={styles.body}>
          {failed && !envelope ? (
            <ErrorState onRetry={load} />
          ) : (
            <>
              <Animated.View entering={enterUp(0)}>
                <Card variant="hero" style={styles.hero}>
                  <PiggyBank progress={target > 0 ? Math.min(1, saved / target) : saved > 0 ? 0.35 : 0} size={96} />
                  <View style={styles.flex}>
                    <Text style={styles.heroLabel}>In your vault</Text>
                    <MoneyText value={saved} style={styles.heroValue} />
                    <Text style={styles.heroSub}>{target > 0 ? `of ${formatCurrency(target)} target` : 'Every round-up lands here'}</Text>
                  </View>
                </Card>
              </Animated.View>

              {preview && preview.amount > 0 && (
                <>
                  <SectionHeader title="Suggested round-up" />
                  <Card style={styles.preview}>
                    <IconTile icon="sparkles" tint={c.primary} />
                    <View style={styles.flex}>
                      <Text style={styles.previewAmount}>{formatCurrency(preview.amount)}</Text>
                      <Text style={styles.previewText}>{preview.previewText}</Text>
                    </View>
                    <Button label="Vault it" size="sm" onPress={() => vault(preview.amount)} />
                  </Card>
                </>
              )}

              <SectionHeader title="Add your own" />
              <Card>
                <View style={styles.amountBox}>
                  <Text style={styles.prefix}>₹</Text>
                  <TextInput
                    value={custom}
                    onChangeText={(v) => setCustom(v.replace(/[^0-9]/g, ''))}
                    placeholder="0"
                    placeholderTextColor={c.textSubtle}
                    keyboardType="number-pad"
                    keyboardAppearance={isDark ? 'dark' : 'light'}
                    style={styles.amountInput}
                    accessibilityLabel="Amount to vault"
                  />
                </View>
                <View style={styles.quick}>
                  {[20, 50, 100, 500].map((v) => <Chip key={v} label={formatCurrency(v)} onPress={() => setCustom(String(v))} style={styles.flex} />)}
                </View>
                <Button label="Move to vault" onPress={() => vault(Number(custom))} style={styles.cta} />
              </Card>
            </>
          )}
        </View>
      </Animated.ScrollView>
      <ScreenHeader title="Round-ups" y={y} onBack={() => navigation.goBack()} />
    </View>
  );
}

const useStyles = createStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.bg },
  flex: { flex: 1 },
  body: { paddingHorizontal: 16 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  heroLabel: { ...typeScale.caption, color: c.onAuroraMuted },
  heroValue: { ...typeScale.title, fontSize: 30, color: c.onAurora, marginTop: 2 },
  heroSub: { ...typeScale.caption, color: c.onAuroraMuted, marginTop: 2 },
  preview: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  previewAmount: { ...typeScale.headline, color: c.text, ...tabular },
  previewText: { ...typeScale.caption, color: c.textMuted, marginTop: 2 },
  amountBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', minHeight: 64, borderRadius: radius.md, backgroundColor: c.bg },
  prefix: { fontSize: 26, fontWeight: '700', color: c.textSubtle, marginRight: 4 },
  amountInput: { minWidth: 50, fontSize: 34, fontWeight: '800', color: c.text, ...tabular },
  quick: { flexDirection: 'row', gap: 8, marginTop: 12 },
  cta: { marginTop: 14 },
}));
