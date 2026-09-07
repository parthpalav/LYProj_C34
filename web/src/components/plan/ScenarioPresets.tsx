import React from 'react';

interface ScenarioPresetsProps {
  onApplyPreset: (presetId: 'more_investment' | 'retire_later' | 'lower_return' | 'step_up') => void;
  disabled?: boolean;
}

export const ScenarioPresets: React.FC<ScenarioPresetsProps> = ({
  onApplyPreset,
  disabled = false,
}) => {
  return (
    <div className="scenario-presets-bar">
      <span className="presets-label">Quick Scenarios:</span>
      <div className="presets-buttons-group">
        <button
          type="button"
          className="preset-btn"
          disabled={disabled}
          onClick={() => onApplyPreset('more_investment')}
        >
          💰 +₹5,000 / mo
        </button>
        <button
          type="button"
          className="preset-btn"
          disabled={disabled}
          onClick={() => onApplyPreset('retire_later')}
        >
          ⏳ Retire 3 yrs later
        </button>
        <button
          type="button"
          className="preset-btn"
          disabled={disabled}
          onClick={() => onApplyPreset('lower_return')}
        >
          📉 Conservative (-2% return)
        </button>
        <button
          type="button"
          className="preset-btn"
          disabled={disabled}
          onClick={() => onApplyPreset('step_up')}
        >
          📈 10% Annual Step-up
        </button>
      </div>
    </div>
  );
};
