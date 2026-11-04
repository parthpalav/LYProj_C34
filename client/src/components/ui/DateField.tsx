import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { createStyles, radius, useTheme } from '../../theme';
import { Button } from './Button';
import { Sheet } from './Sheet';

type Props = {
  label: string;
  value: Date | null;
  onChange: (date: Date) => void;
  minimumDate?: Date;
  maximumDate?: Date;
  placeholder?: string;
  error?: string;
};

export const formatDay = (d: Date) => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

/** Tappable date field that opens a calendar sheet; replaces free-text "YYYY-MM-DD" inputs. */
export function DateField({ label, value, onChange, minimumDate, maximumDate, placeholder = 'Pick a date', error }: Props) {
  const styles = useStyles();
  const { c, isDark } = useTheme();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Date>(value ?? new Date());

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        onPress={() => { setDraft(value ?? new Date()); setOpen(true); }}
        style={[styles.field, error ? { borderColor: c.danger } : null]}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value ? formatDay(value) : 'not set'}`}
      >
        <Ionicons name="calendar-outline" size={18} color={c.textSubtle} />
        <Text style={[styles.value, !value && styles.placeholder]}>{value ? formatDay(value) : placeholder}</Text>
        <Ionicons name="chevron-down" size={16} color={c.textSubtle} />
      </Pressable>
      {!!error && <Text style={styles.error}>{error}</Text>}

      <Sheet visible={open} onClose={() => setOpen(false)} title={label}>
        <DateTimePicker
          value={draft}
          mode="date"
          display="inline"
          themeVariant={isDark ? 'dark' : 'light'}
          accentColor={c.primary}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          onChange={(_, d) => d && setDraft(d)}
        />
        <Button label="Done" onPress={() => { onChange(draft); setOpen(false); }} style={styles.done} />
      </Sheet>
    </View>
  );
}

const useStyles = createStyles((c) => ({
  wrap: {
    marginBottom: 14,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: c.textMuted,
    marginBottom: 8,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 52,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  value: {
    flex: 1,
    fontSize: 15,
    color: c.text,
  },
  placeholder: {
    fontSize: 15,
    color: c.textSubtle,
  },
  error: {
    fontSize: 12,
    color: c.danger,
    marginTop: 6,
  },
  done: {
    marginTop: 8,
  },
}));
