import { useId } from 'react';

interface RangeFieldProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  unit: string;
}

/** Slider and exact entry share one controlled value and the same bounds. */
export function RangeField({ label, value, onChange, min, max, step, unit }: RangeFieldProps) {
  const id = useId();
  const invalid = !Number.isFinite(value) || value < min || value > max;
  return (
    <div className="plan-control-field range-field">
      <label className="plan-control-label" htmlFor={`${id}-number`}>{label} <span className="range-unit">{unit}</span></label>
      <div className="range-field-inputs">
        <input id={`${id}-range`} type="range" className="plan-range-input" aria-label={`${label} slider`} min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
        <input id={`${id}-number`} type="number" className="range-exact-input" min={min} max={max} step={step} value={value} aria-invalid={invalid || undefined} aria-describedby={`${id}-hint`} onChange={(event) => { const number = Number(event.target.value); if (Number.isFinite(number)) onChange(number); }} onBlur={() => onChange(Math.min(max, Math.max(min, value)))} />
      </div>
      <span id={`${id}-hint`} className={invalid ? 'entry-field-error' : 'plan-control-hint'}>{invalid ? `Enter a value from ${min} to ${max}.` : `Range ${min.toLocaleString('en-IN')}–${max.toLocaleString('en-IN')} ${unit}`}</span>
    </div>
  );
}
