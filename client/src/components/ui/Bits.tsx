import React from 'react';
import { Pressable, StyleProp, Text, TextStyle, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { createStyles, radius, tabular, typeScale, useTheme } from '../../theme';
import { formatCurrency } from '../../utils/format';
import { AnimatedNumber } from '../motion/AnimatedNumber';
import { FloatingEmoji } from '../motion/FloatingEmoji';
import { PressableScale } from '../motion/PressableScale';
import { Button } from './Button';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
type Tone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger';

/** Selectable pill for filters and options. */
export function Chip({ label, selected, onPress, icon, style }: { label: string; selected?: boolean; onPress?: () => void; icon?: IconName; style?: StyleProp<ViewStyle> }) {
  const styles = useStyles();
  const { c } = useTheme();
  return (
    <Pressable
      onPress={() => { Haptics.selectionAsync().catch(() => {}); onPress?.(); }}
      style={[styles.chip, selected && styles.chipOn, style]}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
    >
      {icon && <Ionicons name={icon} size={14} color={selected ? c.onPrimary : c.textMuted} />}
      <Text style={[styles.chipText, selected && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

/** Small status label. */
export function Badge({ label, tone = 'neutral', style }: { label: string; tone?: Tone; style?: StyleProp<ViewStyle> }) {
  const styles = useStyles();
  const { c } = useTheme();
  const [bg, fg] = {
    neutral: [c.surfaceAlt, c.textMuted],
    primary: [c.primarySoft, c.primary],
    success: [c.successSoft, c.successStrong],
    warning: [c.warningSoft, c.warningStrong],
    danger: [c.dangerSoft, c.dangerStrong],
  }[tone];
  return (
    <View style={[styles.badge, { backgroundColor: bg }, style]}>
      <Text style={[styles.badgeText, { color: fg }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

/** Rounded tinted square holding an icon or emoji; the leading visual of list rows and tiles. */
export function IconTile({ icon, emoji, tint, size = 40 }: { icon?: IconName; emoji?: string; tint?: string; size?: number }) {
  const styles = useStyles();
  const { c } = useTheme();
  const color = tint ?? c.primary;
  return (
    // 12% tint via hex alpha suffix: palette and chart colors are hex in both schemes.
    <View style={[styles.tile, { width: size, height: size, borderRadius: size * 0.32, backgroundColor: `${color}1F` }]}>
      {emoji ? <Text style={{ fontSize: size * 0.48 }}>{emoji}</Text> : <Ionicons name={icon ?? 'ellipse'} size={size * 0.5} color={color} />}
    </View>
  );
}

/** Icon + title/subtitle + trailing value, optionally pressable with a chevron. */
export function ListRow({ icon, emoji, tint, title, subtitle, value, valueStyle, onPress, chevron = !!onPress, accessibilityLabel }: {
  icon?: IconName; emoji?: string; tint?: string; title: string; subtitle?: string; value?: React.ReactNode; valueStyle?: StyleProp<TextStyle>;
  onPress?: () => void; chevron?: boolean; accessibilityLabel?: string;
}) {
  const styles = useStyles();
  const { c } = useTheme();
  const body = (
    <>
      {(icon || emoji) && <IconTile icon={icon} emoji={emoji} tint={tint} />}
      <View style={styles.rowText}>
        <Text style={styles.rowTitle} numberOfLines={1}>{title}</Text>
        {!!subtitle && <Text style={styles.rowSub} numberOfLines={1}>{subtitle}</Text>}
      </View>
      {typeof value === 'string' ? <Text style={[styles.rowValue, valueStyle]}>{value}</Text> : value}
      {chevron && <Ionicons name="chevron-forward" size={18} color={c.textSubtle} />}
    </>
  );
  if (!onPress) return <View style={styles.row}>{body}</View>;
  return (
    <PressableScale onPress={onPress} scaleTo={0.98} style={styles.row} accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? title}>
      {body}
    </PressableScale>
  );
}

/** Rupee amount in tabular figures; counts to new values unless animate is false. */
export function MoneyText({ value, animate = true, style, signed }: { value: number; animate?: boolean; style?: StyleProp<TextStyle>; signed?: boolean }) {
  const format = (n: number) => (signed && n > 0 ? '+' : '') + formatCurrency(n);
  if (!animate) return <Text style={[tabular, style]}>{format(value)}</Text>;
  return <AnimatedNumber value={value} format={format} style={[tabular, style]} />;
}

export function EmptyState({ emoji, title, message, actionLabel, onAction }: { emoji: string; title: string; message?: string; actionLabel?: string; onAction?: () => void }) {
  const styles = useStyles();
  return (
    <View style={styles.state}>
      <FloatingEmoji emoji={emoji} style={styles.stateEmoji} />
      <Text style={styles.stateTitle}>{title}</Text>
      {!!message && <Text style={styles.stateMsg}>{message}</Text>}
      {actionLabel && onAction && <Button label={actionLabel} onPress={onAction} size="sm" variant="secondary" style={styles.stateBtn} />}
    </View>
  );
}

/** Shown when a load fails, instead of empty lists or made-up defaults. */
export function ErrorState({ message = 'Check your connection and try again.', onRetry }: { message?: string; onRetry: () => unknown }) {
  const styles = useStyles();
  const { c } = useTheme();
  return (
    <View style={styles.state} accessibilityRole="alert">
      <Ionicons name="cloud-offline-outline" size={40} color={c.textSubtle} />
      <Text style={styles.stateTitle}>Couldn't load this</Text>
      <Text style={styles.stateMsg}>{message}</Text>
      <Button label="Try again" icon="refresh" onPress={onRetry} size="sm" variant="secondary" style={styles.stateBtn} />
    </View>
  );
}

/** Section title with an optional trailing action, used between cards. */
export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  const styles = useStyles();
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle} accessibilityRole="header">{title}</Text>
      {action && onAction && (
        <Pressable onPress={onAction} hitSlop={8} accessibilityRole="button">
          <Text style={styles.sectionAction}>{action}</Text>
        </Pressable>
      )}
    </View>
  );
}

const useStyles = createStyles((c) => ({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: c.surfaceAlt,
  },
  chipOn: {
    backgroundColor: c.primary,
  },
  chipText: {
    ...typeScale.label,
    color: c.textMuted,
  },
  chipTextOn: {
    ...typeScale.label,
    color: c.onPrimary,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  tile: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: c.text,
  },
  rowSub: {
    fontSize: 13,
    color: c.textMuted,
    marginTop: 2,
  },
  rowValue: {
    fontSize: 15,
    fontWeight: '700',
    color: c.text,
    ...tabular,
  },
  state: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  stateEmoji: {
    fontSize: 44,
    marginBottom: 12,
  },
  stateTitle: {
    ...typeScale.headline,
    color: c.text,
    textAlign: 'center',
    marginTop: 8,
  },
  stateMsg: {
    ...typeScale.body,
    color: c.textMuted,
    textAlign: 'center',
    marginTop: 6,
  },
  stateBtn: {
    marginTop: 16,
  },
  section: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 24,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    ...typeScale.headline,
    color: c.text,
  },
  sectionAction: {
    ...typeScale.label,
    color: c.primary,
  },
}));
