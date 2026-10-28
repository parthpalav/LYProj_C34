import React, { useCallback, useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { acceptFamilyInvitation, declineFamilyInvitation, getAlerts, getLiabilities, getReceivedFamilyInvitations, getTransactions } from '../services/api';
import { toast } from '../store/useCelebrationStore';
import { AlertItem, FamilyInvitation, Liability } from '../types';
import { createStyles, typeScale, useTheme } from '../theme';
import { enterUp, exitFade, listLayout } from '../motion';
import { dueDatesWithin } from '../utils/bills';
import { formatCurrency } from '../utils/format';
import { Card } from '../components/ui/Card';
import { EmptyState, IconTile, ListRow, SectionHeader } from '../components/ui/Bits';
import { Button } from '../components/ui/Button';
import { LargeTitle, ScreenHeader, useHeaderHeight, useScrollHeader } from '../components/ui/ScreenHeader';

/** Everything that wants the user's attention, in one place: invites, AI checks, bills and alerts. */
export default function AlertsScreen() {
  const { c } = useTheme();
  const styles = useStyles();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { y, onScroll } = useScrollHeader();
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [invites, setInvites] = useState<FamilyInvitation[]>([]);
  const [reviewCount, setReviewCount] = useState(0);
  const [bills, setBills] = useState<{ l: Liability; date: Date }[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const [a, inv, tx, liab] = await Promise.allSettled([getAlerts(), getReceivedFamilyInvitations(), getTransactions(), getLiabilities()]);
    if (a.status === 'fulfilled') setAlerts(a.value ?? []);
    if (inv.status === 'fulfilled') setInvites((inv.value ?? []).filter((i) => i.status === 'pending'));
    if (tx.status === 'fulfilled') setReviewCount(tx.value.filter((t) => t.needsReview).length);
    if (liab.status === 'fulfilled') {
      setBills(liab.value.flatMap((l) => dueDatesWithin(l, 7).slice(0, 1).map((date) => ({ l, date }))).sort((p, q) => p.date.getTime() - q.date.getTime()));
    }
    setLoaded(true);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const respond = async (invite: FamilyInvitation, accept: boolean) => {
    try {
      if (accept) await acceptFamilyInvitation(invite.id);
      else await declineFamilyInvitation(invite.id);
      setInvites((list) => list.filter((i) => i.id !== invite.id));
      toast(accept ? 'You joined the household' : 'Invitation declined', { tone: accept ? 'success' : 'info' });
    } catch (e: any) {
      toast("Couldn't respond to that invite", { tone: 'error', subtitle: e?.response?.data?.error });
    }
  };

  const nothing = loaded && !alerts.length && !invites.length && !reviewCount && !bills.length;

  return (
    <View style={styles.screen}>
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingTop: headerHeight, paddingBottom: insets.bottom + 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} progressViewOffset={headerHeight} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
      >
        <LargeTitle title="Notifications" subtitle="What needs you, and what FINAURA noticed" />
        <View style={styles.body}>
          {nothing && <EmptyState emoji="🌤️" title="All clear" message="No invites, checks or alerts right now." />}

          {invites.map((inv, i) => (
            <Animated.View key={inv.id} entering={enterUp(i)} exiting={exitFade} layout={listLayout}>
              <Card style={styles.gap}>
                <View style={styles.row}>
                  <IconTile icon="people" tint={c.chart[3]} />
                  <View style={styles.flex}>
                    <Text style={styles.title}>{inv.inviterName || 'Someone'} invited you to their household</Text>
                    <Text style={styles.sub}>Shared totals and FMI. Your transactions stay private.</Text>
                  </View>
                </View>
                <View style={styles.actions}>
                  <Button label="Accept" size="sm" onPress={() => respond(inv, true)} style={styles.flex} />
                  <Button label="Decline" size="sm" variant="secondary" onPress={() => respond(inv, false)} style={styles.flex} />
                </View>
              </Card>
            </Animated.View>
          ))}

          {reviewCount > 0 && (
            <Card onPress={() => navigation.navigate('Review')} style={styles.gap} accessibilityLabel={`Review ${reviewCount} AI guesses`}>
              <View style={styles.row}>
                <IconTile icon="sparkles" tint={c.primary} />
                <View style={styles.flex}>
                  <Text style={styles.title}>{reviewCount} transaction{reviewCount === 1 ? '' : 's'} to check</Text>
                  <Text style={styles.sub}>FINAURA wasn't sure about these categories. Confirming teaches it your merchants.</Text>
                </View>
              </View>
            </Card>
          )}

          {bills.length > 0 && (
            <>
              <SectionHeader title="Due this week" />
              <Card padded={false} style={styles.list}>
                {bills.map(({ l, date }, i) => (
                  <View key={l.id} style={i > 0 && styles.divider}>
                    <ListRow
                      icon="calendar"
                      tint={c.warning}
                      title={l.name}
                      subtitle={`${date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}${l.autoDeduct ? ' · auto deduct' : ''}`}
                      value={formatCurrency(l.amount)}
                      onPress={() => navigation.navigate('Liabilities')}
                      chevron={false}
                    />
                  </View>
                ))}
              </Card>
            </>
          )}

          {alerts.length > 0 && (
            <>
              <SectionHeader title="Insights & alerts" />
              <Card padded={false} style={styles.list}>
                {alerts.map((a, i) => (
                  <View key={a.id ?? i} style={[styles.alertRow, i > 0 && styles.divider]}>
                    <IconTile
                      icon={a.type === 'warning' ? 'warning' : 'bulb'}
                      tint={a.severity === 'high' ? c.danger : a.severity === 'medium' ? c.warning : c.primary}
                      size={36}
                    />
                    <Text style={styles.alertText}>{a.message}</Text>
                  </View>
                ))}
              </Card>
            </>
          )}
        </View>
      </Animated.ScrollView>
      <ScreenHeader title="Notifications" y={y} onBack={() => navigation.goBack()} />
    </View>
  );
}

const useStyles = createStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.bg },
  flex: { flex: 1 },
  body: { paddingHorizontal: 16 },
  gap: { marginBottom: 12 },
  row: { flexDirection: 'row', gap: 12 },
  title: { ...typeScale.headline, fontSize: 16, color: c.text },
  sub: { ...typeScale.caption, color: c.textMuted, marginTop: 4 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 14 },
  list: { paddingHorizontal: 14, paddingVertical: 4 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
  alertRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  alertText: { ...typeScale.body, fontSize: 14, color: c.text, flex: 1 },
}));
