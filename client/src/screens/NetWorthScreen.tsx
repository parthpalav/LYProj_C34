import React, { useState } from 'react';
import { Pressable, RefreshControl, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createStyles, useTheme } from '../theme';
import { formatCurrency } from '../utils/format';
import { LargeTitle, ScreenHeader, useHeaderHeight, useScrollHeader } from '../components/ui/ScreenHeader';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { AssetsPanel } from './AssetsScreen';
import { LiabilitiesPanel } from './LiabilitiesScreen';

type Segment = 'assets' | 'liabilities';

/**
 * One place for everything you own and owe. The Assets and Liabilities routes both land here,
 * on their own segment, so every existing link keeps working.
 */
export function NetWorthScreen(): React.ReactElement {
  const { c } = useTheme();
  const styles = useStyles();
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { y, onScroll } = useScrollHeader();
  const [view, setView] = useState<Segment>(route.name === 'Liabilities' ? 'liabilities' : 'assets');
  const [addKey, setAddKey] = useState({ assets: 0, liabilities: 0 });
  const [refreshKey, setRefreshKey] = useState(0);
  const [owned, setOwned] = useState<number | null>(null);
  const [owed, setOwed] = useState<number | null>(null);

  const subtitle = owned !== null && owed !== null
    ? `${formatCurrency(owned - owed)} · own ${formatCurrency(owned)}, owe ${formatCurrency(owed)}`
    : 'Everything you own and owe';

  return (
    <View style={styles.screen}>
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingTop: headerHeight, paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
        // Panels refetch on the key bump; the spinner does not wait for them.
        refreshControl={<RefreshControl refreshing={false} progressViewOffset={headerHeight} onRefresh={() => setRefreshKey((k) => k + 1)} />}
      >
        <LargeTitle
          title="Net worth"
          subtitle={subtitle}
          right={
            <Pressable
              style={styles.addBtn}
              onPress={() => setAddKey((k) => ({ ...k, [view]: k[view] + 1 }))}
              accessibilityRole="button"
              accessibilityLabel={view === 'assets' ? 'Add Financial Asset' : 'Add Liability'}
            >
              <Ionicons name="add" size={22} color={c.onPrimary} />
            </Pressable>
          }
        />
        <View style={styles.switcher}>
          <SegmentedControl
            segments={[
              { key: 'assets' as const, label: owned !== null ? `Assets · ${formatCurrency(owned)}` : 'Assets' },
              { key: 'liabilities' as const, label: owed !== null ? `Liabilities · ${formatCurrency(owed)}` : 'Liabilities' },
            ]}
            value={view}
            onChange={setView}
            accessibilityLabel="Show assets or liabilities"
          />
        </View>
        {/* Both stay mounted so switching is instant and an open form keeps its state. */}
        <View style={view === 'assets' ? undefined : styles.hidden}>
          <AssetsPanel addKey={addKey.assets} refreshKey={refreshKey} onTotal={setOwned} />
        </View>
        <View style={view === 'liabilities' ? undefined : styles.hidden}>
          <LiabilitiesPanel addKey={addKey.liabilities} refreshKey={refreshKey} onTotal={setOwed} />
        </View>
      </Animated.ScrollView>
      <ScreenHeader title="Net worth" y={y} onBack={() => navigation.goBack()} />
    </View>
  );
}

const useStyles = createStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.bg },
  addBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: c.primary, marginBottom: 4 },
  switcher: { paddingHorizontal: 16, marginBottom: 14 },
  hidden: { display: 'none' },
}));
