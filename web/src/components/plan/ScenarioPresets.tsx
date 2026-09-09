import React from 'react';
import { IndianRupee, Clock, TrendingDown, TrendingUp } from 'lucide-react';

interface ScenarioPresetsProps {
  onApplyPreset: (presetId: 'more_investment' | 'retire_later' | 'lower_return' | 'step_up') => void;
  disabled?: boolean;
}

export const ScenarioPresets: React.FC<ScenarioPresetsProps> = ({
  onApplyPreset,
  disabled = false,
}) => {
  return (
    <div className="plan-presets-bar">
      <span className="plan-presets-label">Quick Scenarios:</span>
      <div className="plan-presets-group">
        <button
          type="button"
          className="plan-preset-btn"
          disabled={disabled}
          onClick={() => onApplyPreset('more_investment')}
        >
          <IndianRupee size={13} /> +₹5,000 / mo
        </button>
        <button
          type="button"
          className="plan-preset-btn"
          disabled={disabled}
          onClick={() => onApplyPreset('retire_later')}
        >
          <Clock size={13} /> Retire 3 yrs later
        </button>
        <button
          type="button"
          className="plan-preset-btn"
          disabled={disabled}
          onClick={() => onApplyPreset('lower_return')}
        >
          <TrendingDown size={13} /> Conservative (-2% return)
        </button>
        <button
          type="button"
          className="plan-preset-btn"
          disabled={disabled}
          onClick={() => onApplyPreset('step_up')}
        >
          <TrendingUp size={13} /> 10% Annual Step-up
        </button>
      </div>
    </div>
  );
};
