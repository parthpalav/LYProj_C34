import React, { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { CapturedItem, dismissCaptured, getCaptured } from '../../services/api';
import { formatCurrency } from '../../utils/format';
import { createStyles, radius, tabular, typeScale, useTheme } from '../../theme';
import { Card } from '../ui/Card';
import { IconTile } from '../ui/Bits';

/** Pending bank SMS entries forwarded by the iOS Shortcut. */
export function CapturedSmsCard(): React.ReactElement | null {
  const s = useStyles();
  const { c } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [items, setItems] = useState<CapturedItem[]>([]);

  const load = useCallback(() => { getCaptured().then(setItems).catch(() => {}); }, []);
  useFocusEffect(load);

  if (!items.length) return null;

  const open = (item: CapturedItem) => {
    if (item.direction === 'credit') {
      navigation.navigate('IncomeFlow', { capture: item });
    } else {
      navigation.navigate('QuickAdd', { draft: { ...item, capturedId: item.id } });
    }
  };

  const dismiss = (item: CapturedItem) => {
    setItems((list) => list.filter((i) => i.id !== item.id));
    dismissCaptured(item.id).catch(load);
  };

  return (
    <Card style={s.card}>
      <View style={s.head}>
        <IconTile icon="chatbox-ellipses" tint={c.success} size={36} />
        <View style={s.flex}>
          <Text style={s.kicker}>From your bank SMS</Text>
          <Text style={s.title}>{items.length} payment{items.length === 1 ? '' : 's'} to check</Text>
        </View>
      </View>
      {items.slice(0, 5).map((item) => (
        <View key={item.id} style={s.item}>
          <Pressable style={s.flex} onPress={() => open(item)} accessibilityRole="button"
            accessibilityLabel={`${item.direction === 'credit' ? 'Review income' : 'Review expense'} ${formatCurrency(item.amount)} ${item.description}`}>
            <Text style={[s.amount, item.direction === 'credit' && { color: c.successStrong }]}>
              {item.direction === 'credit' ? '+' : ''}{formatCurrency(item.amount)}
            </Text>
            <Text style={s.desc} numberOfLines={1}>
              {item.description} · {new Date(item.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
            </Text>
            <Text style={s.action}>{item.direction === 'credit' ? 'Review income' : 'Review expense'}</Text>
          </Pressable>
          <Pressable onPress={() => dismiss(item)} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Dismiss ${item.description}`}>
            <Ionicons name="close-circle" size={22} color={c.textSubtle} />
          </Pressable>
        </View>
      ))}
    </Card>
  );
}

const useStyles = createStyles((c) => ({
  card: { marginTop: 16 },
  flex: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 6 },
  kicker: { ...typeScale.caption, color: c.success },
  title: { ...typeScale.headline, color: c.text },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8, padding: 12, borderRadius: radius.md, backgroundColor: c.surfaceAlt },
  amount: { ...typeScale.headline, color: c.text, ...tabular },
  desc: { ...typeScale.caption, color: c.textMuted, marginTop: 2 },
  action: { ...typeScale.caption, color: c.primary, marginTop: 2 },
}));
