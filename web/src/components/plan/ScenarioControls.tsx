import React from 'react';

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
  // Correction #5: Bounds validated against backend constraints
  const minRetAge = currentAge !== null ? Math.max(40, currentAge + 1) : 40;
  const maxRetAge = 100;

  return (
    <div className="scenario-controls-card">
      <div className="controls-card-header">
        <h3 className="controls-title">Scenario Parameter Adjustments</h3>
        <p className="controls-subtitle">
          Explore alternative assumptions in real-time. Changes are evaluated in-memory and will not overwrite your account profile.
        </p>
      </div>

      <div className="controls-inputs-grid">
        {/* Monthly Investment */}
        <div className="control-field">
          <div className="field-header">
            <label htmlFor="input-monthly-contrib" className="field-label">
              Monthly Investment Contribution
            </label>
            <span className="field-value">₹{monthlyContribution.toLocaleString('en-IN')}</span>
          </div>
          <input
            id="input-monthly-contrib"
            type="range"
            min="0"
            max="200000"
            step="1000"
            value={monthlyContribution}
            onChange={(e) => setMonthlyContribution(Number(e.target.value))}
            className="form-range"
          />
        </div>

        {/* Retirement Age */}
        <div className="control-field">
          <div className="field-header">
            <label htmlFor="input-ret-age" className="field-label">
              Target Retirement Age
            </label>
            <span className="field-value">{retirementAge} years</span>
          </div>
          <input
            id="input-ret-age"
            type="range"
            min={minRetAge}
            max={maxRetAge}
            step="1"
            value={retirementAge}
            onChange={(e) => setRetirementAge(Number(e.target.value))}
            className="form-range"
          />
          <span className="field-bounds-hint">
            Valid range: {minRetAge} to {maxRetAge} years (must exceed current age {currentAge ?? 20})
          </span>
        </div>

        {/* Expected Return Rate */}
        <div className="control-field">
          <div className="field-header">
            <label htmlFor="input-return-rate" className="field-label">
              Expected Annual Return
            </label>
            <span className="field-value">{(expectedReturnRate * 100).toFixed(1)}%</span>
          </div>
          <input
            id="input-return-rate"
            type="range"
            min="0.02"
            max="0.20"
            step="0.005"
            value={expectedReturnRate}
            onChange={(e) => setExpectedReturnRate(Number(e.target.value))}
            className="form-range"
          />
        </div>

        {/* Expected Inflation Rate */}
        <div className="control-field">
          <div className="field-header">
            <label htmlFor="input-inf-rate" className="field-label">
              Expected Annual Inflation
            </label>
            <span className="field-value">{(expectedInflationRate * 100).toFixed(1)}%</span>
          </div>
          <input
            id="input-inf-rate"
            type="range"
            min="0.01"
            max="0.15"
            step="0.005"
            value={expectedInflationRate}
            onChange={(e) => setExpectedInflationRate(Number(e.target.value))}
            className="form-range"
          />
        </div>

        {/* Contribution Mode */}
        <div className="control-field">
          <label htmlFor="select-contrib-mode" className="field-label">
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
          <div className="control-field">
            <div className="field-header">
              <label htmlFor="input-stepup-rate" className="field-label">
                Annual Step-Up Escalation Rate
              </label>
              <span className="field-value">{(annualContributionGrowthRate * 100).toFixed(1)}%</span>
            </div>
            <input
              id="input-stepup-rate"
              type="range"
              min="0.0"
              max="0.50"
              step="0.01"
              value={annualContributionGrowthRate}
              onChange={(e) => setAnnualContributionGrowthRate(Number(e.target.value))}
              className="form-range"
            />
            <span className="field-bounds-hint">Maximum supported annual escalation: 50%</span>
          </div>
        )}
      </div>

      <div className="controls-actions-row">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={onReset}
          disabled={evaluating}
        >
          ↺ Reset to Baseline
        </button>
        <button
          type="button"
          className="btn btn-primary run-scenario-btn"
          onClick={onRunScenario}
          disabled={evaluating}
        >
          {evaluating ? 'Evaluating Model...' : '⚡ Run Scenario Evaluation'}
        </button>
      </div>
    </div>
  );
};
