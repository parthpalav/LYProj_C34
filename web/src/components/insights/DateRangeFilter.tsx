import React from 'react';
import { RANGE_PRESETS, type DateRange, type RangePreset } from '../../utils/dateRange';
import { dateKey, dateKeyToDate, todayKey } from '../../utils/timezone';
import { formatDateFull } from '../../utils/formatters';

export interface DateRangeValue {
  preset: RangePreset;
  from?: string | null;
  to?: string | null;
}

export interface DateRangeFilterProps {
  value: DateRangeValue;
  /** The resolved range, shown as a label. */
  range: DateRange;
  /** Earliest record (YYYY-MM-DD): lower bound for the date inputs and the start of "All". */
  minDate?: string | null;
  onChange: (next: DateRangeValue) => void;
}

/** Preset pills plus a custom start/end date pair. One filter drives every chart on the page. */
export const DateRangeFilter: React.FC<DateRangeFilterProps> = ({ value, range, minDate, onChange }) => {
  const today = todayKey();
  const from = value.from || (range.start ? dateKey(range.start) : minDate || '');
  const to = value.to || dateKey(range.end);
  const startLabel = range.start ? formatDateFull(range.start) : minDate ? formatDateFull(dateKeyToDate(minDate)) : 'first record';

  return (
    <div className="date-range-filter" role="group" aria-label="History range">
      <div className="chart-range-pills">
        {RANGE_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`range-pill-btn ${value.preset === p.id ? 'active' : ''}`}
            aria-pressed={value.preset === p.id}
            onClick={() => onChange(p.id === 'custom' ? { preset: 'custom', from, to } : { preset: p.id })}
          >
            {p.label}
          </button>
        ))}
      </div>

      {value.preset === 'custom' && (
        <div className="date-range-inputs">
          <label>
            <span>From</span>
            <input
              type="date"
              value={from}
              min={minDate || undefined}
              max={to || today}
              onChange={(e) => onChange({ ...value, from: e.target.value || null })}
            />
          </label>
          <label>
            <span>To</span>
            <input
              type="date"
              value={to}
              min={from || minDate || undefined}
              max={today}
              onChange={(e) => onChange({ ...value, to: e.target.value || null })}
            />
          </label>
        </div>
      )}

      <span className="date-range-label">
        {startLabel} – {formatDateFull(range.end)}
      </span>
    </div>
  );
};
