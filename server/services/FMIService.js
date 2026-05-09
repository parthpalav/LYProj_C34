/**
 * FMI Service — Deterministic Financial Maturity Index Scoring
 * 
 * Calls the FMI microservice to calculate an explainable financial wellness index
 * based on retirement readiness mathematics. Not a supervised ML model.
 */

// use global fetch available in modern Node.js
const _fetch = global.fetch;

/**
 * calculateFMI
 * Calls the Python deterministic FMI scoring engine.
 * 
 * Returns an object with:
 *  - score: 0-100 FMI score (50 = on-track, <50 = behind, >50 = ahead)
 *  - status: categorical status (Critical, Behind, On Track, Ahead, Excellent)
 *  - risk: derived risk level (low/medium/high based on score)
 *  - factors: contributing factors and explainability data
 *  - readiness_pct: retirement corpus projection as % of goal
 *  - monthly_gap: actual vs required monthly savings
 */
async function calculateFMI(profile = {}) {
  try {
    const url = process.env.ML_SERVICE_URL || 'http://localhost:5001/fmi-score';
    const resp = await _fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile),
    });
    
    if (!resp.ok) {
      const txt = await resp.text();
      throw new Error(`FMI service error: ${resp.status} ${txt}`);
    }
    
    const json = await resp.json();
    
    // Extract response fields
    const score = Number(json.score ?? 50);
    const status = String(json.status ?? 'On Track');
    const requiredMonthly = Number(json.required_monthly_savings ?? 0);
    const actualMonthly = Number(json.actual_monthly_savings ?? 0);
    const monthlyGap = Number(json.monthly_gap ?? 0);
    const readinessPct = Number(json.retirement_readiness_pct ?? 0);
    
    // Map status to risk level
    let risk = 'low';
    if (score <= 30) risk = 'critical';
    else if (score <= 45) risk = 'high';
    else if (score <= 55) risk = 'medium';
    else if (score <= 75) risk = 'low';
    else risk = 'excellent';
    
    // Build explainability factors
    const factors = [
      `Actual: $${actualMonthly.toLocaleString('en-US', { maximumFractionDigits: 0 })}/mo`,
      `Required: $${requiredMonthly.toLocaleString('en-US', { maximumFractionDigits: 0 })}/mo`,
      `Gap: $${monthlyGap.toLocaleString('en-US', { maximumFractionDigits: 0 })}/mo`,
      `Readiness: ${readinessPct.toFixed(0)}% of goal`,
      `Consistency: ${(json.savings_consistency_score * 100).toFixed(0)}%`,
      ...(json.warnings || [])
    ];
    
    console.log(`✓ FMI calculated: score=${score} (${status}), risk=${risk}`);
    
    return {
      score: Math.round(score),
      status,
      risk,
      factors,
      details: {
        required_monthly_savings: requiredMonthly,
        actual_monthly_savings: actualMonthly,
        monthly_gap: monthlyGap,
        projected_retirement_corpus: json.projected_retirement_corpus,
        years_remaining: json.years_remaining,
        months_remaining: json.months_remaining,
        retirement_readiness_pct: readinessPct,
        savings_consistency_score: json.savings_consistency_score,
        debt_to_income_ratio: json.debt_to_income_ratio
      }
    };
  } catch (error) {
    console.error('FMIService calculation failed:', error.message);
    // Fallback: return neutral score with reason
    return {
      score: 50,
      status: 'On Track',
      risk: 'medium',
      factors: ['fmi-service-unavailable: using default score'],
      details: {}
    };
  }
}

export { calculateFMI };
