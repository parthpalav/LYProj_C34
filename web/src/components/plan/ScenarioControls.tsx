import React from 'react';
import { Play, RotateCcw } from 'lucide-react';
import { RangeField } from '../ui/RangeField';

interface ScenarioControlsProps {
  currentAge: number | null;
  monthlyContribution: number;
  setMonthlyContribution: (val: number) => void;
  retirementAge: number;
  setRetirementAge: (val: number) => void;
  expectedReturnRate: number;
  setExpectedReturnRate: (val: number) => void;
  expectedInflationRate: number;
  setExpectedInflationRate: (val: number) => void;
  annualContributionGrowthRate: number;
  setAnnualContributionGrowthRate: (val: number) => void;
  contributionMode: 'NOMINAL_FLAT' | 'REAL_CONSTANT' | 'STEP_UP';
  setContributionMode: (val: 'NOMINAL_FLAT' | 'REAL_CONSTANT' | 'STEP_UP') => void;
  onRunScenario: () => void;
  onReset: () => void;
  evaluating: boolean;
}

export const ScenarioControls: React.FC<ScenarioControlsProps> = ({
  currentAge,
  monthlyContribution,
  setMonthlyContribution,
  retirementAge,
  setRetirementAge,
  expectedReturnRate,
  setExpectedReturnRate,
  expectedInflationRate,
  setExpectedInflationRate,
  annualContributionGrowthRate,
  setAnnualContributionGrowthRate,
  contributionMode,
  setContributionMode,
  onRunScenario,
  onReset,
  evaluating,
}) => {
  // Backend validation bounds
  const minRetAge = currentAge !== null ? Math.max(40, currentAge + 1) : 40;
  const maxRetAge = 100;

  return (
    <div className="plan-surface-card">
      <div className="plan-section-header">
        <h3 className="plan-section-title">Change your assumptions</h3>
        <p className="plan-section-subtitle">
          Use the slider for a quick estimate or type an exact value. Run the scenario to compare it with your saved plan.
        </p>
      </div>

      <div className="plan-controls-grid">
        <RangeField label="Monthly investment" unit="INR" min={0} max={200000} step={1} value={monthlyContribution} onChange={setMonthlyContribution} />
        <RangeField label="Retirement age" unit="years" min={minRetAge} max={maxRetAge} step={1} value={retirementAge} onChange={setRetirementAge} />
        <RangeField label="Annual return" unit="%" min={2} max={20} step={0.1} value={Number((expectedReturnRate * 100).toFixed(2))} onChange={(value) => setExpectedReturnRate(value / 100)} />
        <RangeField label="Annual inflation" unit="%" min={1} max={15} step={0.1} value={Number((expectedInflationRate * 100).toFixed(2))} onChange={(value) => setExpectedInflationRate(value / 100)} />

        {/* Contribution Mode */}
        <div className="plan-control-field">
          <label htmlFor="select-contrib-mode" className="plan-control-label">
            Contribution Modeling Mode
          </label>
          <select
            id="select-contrib-mode"
            className="form-select"
            value={contributionMode}
            onChange={(e) => setContributionMode(e.target.value as any)}
          >
            <option value="NOMINAL_FLAT">Nominal Flat (Constant ₹ amount)</option>
            <option value="REAL_CONSTANT">Real Constant (Inflation-indexed)</option>
            <option value="STEP_UP">Annual Step-Up (Escalating contribution)</option>
          </select>
        </div>

        {/* Annual Step-Up Slider (only active in STEP_UP mode) */}
        {contributionMode === 'STEP_UP' && (
          <div className="plan-control-field">
            <div className="plan-control-header">
              <label htmlFor="input-stepup-rate" className="plan-control-label">
                Annual Step-Up Escalation Rate
              </label>
              <span className="plan-control-value">{(annualContributionGrowthRate * 100).toFixed(1)}%</span>
            </div>
            <input
              id="input-stepup-rate"
              type="range"
              min="0.0"
              max="0.50"
              step="0.01"
              value={annualContributionGrowthRate}
              onChange={(e) => setAnnualContributionGrowthRate(Number(e.target.value))}
              className="plan-range-input"
            />
            <span className="plan-control-hint">Maximum supported annual escalation: 50%</span>
          </div>
        )}
      </div>

      <div className="plan-controls-actions">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={onReset}
          disabled={evaluating}
        >
          <RotateCcw size={14} /> Reset to Baseline
        </button>
        <button
          type="button"
          className="btn btn-primary plan-run-btn"
          onClick={onRunScenario}
          disabled={evaluating || monthlyContribution < 0 || monthlyContribution > 200000 || retirementAge < minRetAge || retirementAge > maxRetAge || expectedReturnRate < 0.02 || expectedReturnRate > 0.20 || expectedInflationRate < 0.01 || expectedInflationRate > 0.15}
        >
          {evaluating ? (
            <>
              <span className="plan-spinner" aria-hidden="true" /> Evaluating…
            </>
          ) : (
            <>
              <Play size={14} /> Run Scenario Evaluation
            </>
          )}
        </button>
      </div>
    </div>
  );
};
