import React, { useEffect, useState } from 'react';
import { Text } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { createStyles, typeScale, useTheme } from '../../theme';
import { spanLabel, startOfDay } from '../../utils/spending';
import { SegmentedControl } from './SegmentedControl';
import { Button } from './Button';
import { Sheet } from './Sheet';

type Range = { start: Date; end: Date };

/** Custom date range: one inline calendar that edits whichever end is selected. Never past today. */
export function DateRangeSheet({ visible, onClose, initial, firstDate, onApply, applyLabel = 'Show this range' }: {
  visible: boolean;
  onClose: () => void;
  /** Range the calendar opens on. */
  initial: Range;
  /** Earliest record, shown as a hint when the range starts before it. */
  firstDate?: Date | null;
  onApply: (range: Range) => void;
  applyLabel?: string;
}) {
  const { c, isDark } = useTheme();
  const styles = useStyles();
  const [edge, setEdge] = useState<'start' | 'end'>('start');
  const [draft, setDraft] = useState<Range>(initial);

  // Reset to the caller's range each time the sheet opens
  useEffect(() => {
    if (visible) {
      setDraft(initial);
      setEdge('start');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const pickDate = (d: Date) => {
    const day = startOfDay(d);
    if (edge === 'start') {
      setDraft((r) => ({ start: day, end: r.end < day ? day : r.end }));
      setEdge('end'); // next tap sets the other end, like most range pickers
    } else {
      setDraft((r) => ({ start: r.start > day ? day : r.start, end: day }));
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Custom range">
      <SegmentedControl
        segments={[
          { key: 'start', label: `From  ${draft.start.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` },
          { key: 'end', label: `To  ${draft.end.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` },
        ]}
        value={edge}
        onChange={setEdge}
        accessibilityLabel="Range end to edit"
      />
      <DateTimePicker
        value={draft[edge]}
        mode="date"
        display="inline"
        themeVariant={isDark ? 'dark' : 'light'}
        accentColor={c.primary}
        maximumDate={new Date()}
        onChange={(_, d) => d && pickDate(d)}
      />
      <Text style={styles.pickerHint}>
        {spanLabel(draft.start, draft.end)}
        {firstDate && draft.start < firstDate ? ` · data starts ${firstDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : ''}
      </Text>
      <Button label={applyLabel} onPress={() => onApply(draft)} />
    </Sheet>
  );
}

const useStyles = createStyles((c) => ({
  pickerHint: { ...typeScale.label, color: c.textMuted, textAlign: 'center', marginBottom: 12 },
}));
