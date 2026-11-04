import React, { useState } from 'react';
import { LayoutChangeEvent, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated from 'react-native-reanimated';
import { createStyles, radius, useTheme } from '../../theme';
import { exitFade, popIn } from '../../motion';
import { PressableScale } from '../motion/PressableScale';
import { IconTile } from './Bits';

export type CategoryItem = { key: string; label: string; emoji: string };

type Props = {
  items: readonly CategoryItem[];
  isSelected: (key: string) => boolean;
  onPress: (key: string) => void;
  /** secondary line under the label, e.g. "6 transactions" */
  meta?: (key: string) => string | undefined;
  /** greys out a tile (still tappable), e.g. a category with no transactions */
  isMuted?: (key: string) => boolean;
};

const COLUMNS = 3;
const GAP = 10;

/** Three-column grid of category tiles with a tinted icon, used for filtering and for picking a category. */
export function CategoryGrid({ items, isSelected, onPress, meta, isMuted }: Props) {
  const styles = useStyles();
  const { c } = useTheme();
  const [width, setWidth] = useState(0);
  const tileWidth = width > 0 ? (width - GAP * (COLUMNS - 1)) / COLUMNS : 0;

  return (
    <View style={styles.grid} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
      {tileWidth > 0 &&
        items.map((item, i) => {
          const on = isSelected(item.key);
          const tint = c.chart[i % c.chart.length];
          const sub = meta?.(item.key);
          return (
            <PressableScale
              key={item.key}
              haptic={false}
              onPress={() => { Haptics.selectionAsync().catch(() => {}); onPress(item.key); }}
              style={[
                styles.tile,
                { width: tileWidth },
                on && { borderColor: tint, backgroundColor: `${tint}14` },
                !on && isMuted?.(item.key) && styles.muted,
              ]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              accessibilityLabel={sub ? `${item.label}, ${sub}` : item.label}
            >
              <IconTile emoji={item.emoji} tint={tint} size={38} />
              <Text style={[styles.label, on && styles.labelOn]} numberOfLines={2}>{item.label}</Text>
              {!!sub && <Text style={styles.meta} numberOfLines={1}>{sub}</Text>}
              {on && (
                <Animated.View entering={popIn()} exiting={exitFade} style={[styles.check, { backgroundColor: tint }]}>
                  <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                </Animated.View>
              )}
            </PressableScale>
          );
        })}
    </View>
  );
}

const useStyles = createStyles((c) => ({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
  },
  tile: {
    minHeight: 104,
    padding: 12,
    gap: 8,
    borderRadius: radius.lg - 4,
    borderWidth: 1.5,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  muted: {
    opacity: 0.5,
  },
  // 12pt keeps the longest single word ("Entertainment") on one line in a third of a phone width
  label: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
    color: c.text,
  },
  labelOn: {
    fontWeight: '700',
  },
  meta: {
    fontSize: 11,
    fontWeight: '500',
    color: c.textSubtle,
    marginTop: -4,
  },
  check: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
