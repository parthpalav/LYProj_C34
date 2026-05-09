"""
FMI (Financial Maturity Index) Scoring Engine

A transparent, mathematically-grounded financial wellness index that measures
retirement readiness without supervised ML. FMI reflects how well a user's actual
savings trajectory aligns with their target retirement goal.

Core Principle:
  FMI = 50 when actual monthly savings equals required savings to hit retirement goal
  FMI < 50 when behind target
  FMI > 50 when ahead of target

Mathematical Foundation:
  Uses Future Value (FV) equation to compute required monthly contribution:
  FV = PV(1+r)^n + PMT * [((1+r)^n - 1) / r]
  
  Solves for PMT (required monthly payment) given:
    FV = retirement goal (target amount at retirement)
    PV = current retirement savings
    r = monthly interest rate (from annual expected return)
    n = months until retirement
"""

import math
from dataclasses import dataclass, asdict
from typing import Dict, Any, Optional, List, Tuple


@dataclass
class FMIResult:
    """Structured FMI scoring result with full explainability."""
    score: float                           # 0-100 FMI score
    status: str                            # Categorical: "Critical", "Behind", "On Track", "Ahead", "Excellent"
    required_monthly_savings: float        # Amount needed monthly to hit retirement goal
    actual_monthly_savings: float          # User's actual monthly savings + investments
    monthly_gap: float                     # actual - required (positive = surplus)
    projected_retirement_corpus: float     # Projected savings at retirement age
    years_remaining: float                 # Years until retirement
    months_remaining: int                  # Months until retirement
    
    # Contributing factors
    savings_rate_performance: float        # actual / required (>1.0 = exceeding)
    debt_to_income_ratio: float           # debt / (monthly_income * 12) annually
    savings_consistency_score: float       # 0-1, penalty if inconsistent
    retirement_readiness_pct: float       # projected_corpus / retirement_goal * 100
    
    # Metadata
    assumptions: Dict[str, Any]           # Input assumptions (interest rate, inflation, etc.)
    warnings: List[str]                   # Any issues (negative savings, unrealistic goals, etc.)


def calculate_required_monthly_contribution(
    retirement_goal: float,
    current_retirement_savings: float,
    years_to_retirement: int,
    annual_interest_rate: float = 0.05,
    annual_inflation_rate: float = 0.03
) -> float:
    """
    Compute monthly contribution needed to reach retirement goal using Future Value equation.
    
    FV = PV(1+r)^n + PMT * [((1+r)^n - 1) / r]
    
    Solves for PMT:
    PMT = (FV - PV(1+r)^n) / [((1+r)^n - 1) / r]
    
    Args:
        retirement_goal: Target amount at retirement (already inflation-adjusted ideally)
        current_retirement_savings: Current balance
        years_to_retirement: Years until retirement
        annual_interest_rate: Expected annual return (default 5%)
        annual_inflation_rate: Inflation rate (informational, doesn't affect PMT calculation)
    
    Returns:
        Monthly contribution needed (in dollars)
    """
    if years_to_retirement <= 0:
        # Already at/past retirement
        return 0.0
    
    months = years_to_retirement * 12
    monthly_rate = annual_interest_rate / 12
    
    # Future value of current savings after growth
    fv_current = current_retirement_savings * ((1 + monthly_rate) ** months)
    
    # Amount still needed
    amount_needed = max(0, retirement_goal - fv_current)
    
    if monthly_rate == 0:
        # Edge case: 0% return
        return amount_needed / months
    
    # PMT = amount_needed / [((1+r)^n - 1) / r]
    fv_annuity_factor = (((1 + monthly_rate) ** months) - 1) / monthly_rate
    monthly_pmt = amount_needed / fv_annuity_factor if fv_annuity_factor != 0 else 0
    
    return max(0, monthly_pmt)


def project_retirement_savings(
    current_retirement_savings: float,
    monthly_contribution: float,
    years_to_retirement: int,
    annual_interest_rate: float = 0.05
) -> float:
    """
    Project final retirement corpus using FV equation.
    
    FV = PV(1+r)^n + PMT * [((1+r)^n - 1) / r]
    
    Args:
        current_retirement_savings: Current balance
        monthly_contribution: Monthly savings/investment amount
        years_to_retirement: Years until retirement
        annual_interest_rate: Expected annual return
    
    Returns:
        Projected savings at retirement
    """
    if years_to_retirement <= 0:
        return current_retirement_savings
    
    months = years_to_retirement * 12
    monthly_rate = annual_interest_rate / 12
    
    # FV of current savings
    fv_current = current_retirement_savings * ((1 + monthly_rate) ** months)
    
    # FV of monthly contributions (annuity)
    if monthly_rate == 0:
        fv_contributions = monthly_contribution * months
    else:
        fv_contributions = monthly_contribution * (((1 + monthly_rate) ** months - 1) / monthly_rate)
    
    return fv_current + fv_contributions


def compute_fmi_score(
    actual_monthly_savings: float,
    required_monthly_savings: float,
    debt_to_income_ratio: float,
    savings_consistency: float,  # 0-1, where 1 = perfectly consistent
    retirement_readiness_pct: float  # projected_savings / goal * 100
) -> Tuple[float, str]:
    """
    Compute FMI score (0-100) and status band from financial metrics.
    
    Scoring Logic:
    - Base: 50 when actual_monthly_savings == required_monthly_savings
    - Surplus adjusts upward; deficit adjusts downward
    - Debt and consistency apply secondary modifiers
    
    Args:
        actual_monthly_savings: Total monthly savings + investment contributions
        required_monthly_savings: Target monthly savings to hit retirement goal
        debt_to_income_ratio: Annual debt / annual income (0-1 ideally <0.4)
        savings_consistency: 0-1 metric (1 = perfect, 0 = very inconsistent)
        retirement_readiness_pct: (projected_savings / goal) * 100
    
    Returns:
        (fmi_score: float, status: str)
    """
    
    # Prevent division by zero
    if required_monthly_savings <= 0:
        # Edge case: no requirement (already at goal or past retirement)
        if actual_monthly_savings > 0:
            return (85.0, "Ahead")
        else:
            return (50.0, "On Track")
    
    # Base calculation: ratio of actual to required
    savings_ratio = actual_monthly_savings / required_monthly_savings
    
    # Map ratio to FMI (clamped to reasonable range)
    # savings_ratio = 1.0 → score = 50
    # savings_ratio = 2.0 → score = 75
    # savings_ratio = 0.5 → score = 25
    base_score = 50 + (savings_ratio - 1.0) * 25
    
    # Apply debt penalty (0.1 per 0.1 point of DTI, capped at -20)
    debt_penalty = min(20, debt_to_income_ratio * 100)
    
    # Apply consistency bonus (+10 when consistent, -10 when inconsistent)
    consistency_adjustment = (savings_consistency - 0.5) * 20
    
    # Apply retirement readiness bonus
    # 100% of goal → +0, 150% of goal → +15, 200% of goal → +25 (capped)
    readiness_adjustment = max(-15, min(25, (retirement_readiness_pct - 100) / 4))
    
    # Compute final score
    fmi = base_score - debt_penalty + consistency_adjustment + readiness_adjustment
    fmi = max(0, min(100, fmi))
    
    # Determine status band
    if fmi <= 30:
        status = "Critical"
    elif fmi <= 45:
        status = "Behind"
    elif fmi <= 55:
        status = "On Track"
    elif fmi <= 75:
        status = "Ahead"
    else:
        status = "Excellent"
    
    return (round(fmi, 2), status)


def calculate_fmi(
    age: int,
    retirement_age: int,
    current_retirement_savings: float,
    retirement_goal: float,
    monthly_income: float,
    monthly_savings: float,
    investment_contribution: float = 0.0,
    debt: float = 0.0,
    savings_consistency: float = 0.7,  # Assumes moderately consistent (0-1)
    annual_interest_rate: float = 0.05,
    annual_inflation_rate: float = 0.03
) -> FMIResult:
    """
    Calculate FMI and return structured result with full explainability.
    
    Args:
        age: Current age
        retirement_age: Target retirement age
        current_retirement_savings: Current retirement account balance
        retirement_goal: Target amount needed at retirement
        monthly_income: Monthly gross income
        monthly_savings: Monthly savings from income
        investment_contribution: Additional monthly investment (e.g., employer 401k match)
        debt: Outstanding debt (e.g., student loans, mortgage, credit cards)
        savings_consistency: 0-1 score (1 = always saves target, 0 = never saves)
        annual_interest_rate: Expected portfolio return (default 5%)
        annual_inflation_rate: Inflation assumption (informational)
    
    Returns:
        FMIResult with score, status, factors, and warnings
    """
    
    # Validate inputs
    warnings = []
    if age < 18:
        warnings.append("Age is unusually young for retirement planning")
    if retirement_age <= age:
        warnings.append("Retirement age is not in the future")
    if current_retirement_savings < 0:
        warnings.append("Current savings cannot be negative")
    if retirement_goal <= 0:
        warnings.append("Retirement goal must be positive")
    if monthly_income <= 0:
        warnings.append("Monthly income must be positive")
    if debt < 0:
        warnings.append("Debt cannot be negative")
    if savings_consistency < 0 or savings_consistency > 1:
        warnings.append("Savings consistency must be between 0 and 1")
    
    # Calculate years and months to retirement
    years_to_retirement = retirement_age - age
    months_to_retirement = years_to_retirement * 12
    
    # Required monthly contribution
    required_monthly = calculate_required_monthly_contribution(
        retirement_goal=retirement_goal,
        current_retirement_savings=current_retirement_savings,
        years_to_retirement=years_to_retirement,
        annual_interest_rate=annual_interest_rate,
        annual_inflation_rate=annual_inflation_rate
    )
    
    # Actual monthly savings (including investment contributions)
    actual_monthly = monthly_savings + investment_contribution
    
    # Projected retirement corpus
    projected_corpus = project_retirement_savings(
        current_retirement_savings=current_retirement_savings,
        monthly_contribution=actual_monthly,
        years_to_retirement=years_to_retirement,
        annual_interest_rate=annual_interest_rate
    )
    
    # Debt-to-income ratio (annual debt / annual income)
    annual_income = monthly_income * 12
    annual_debt_payment = min(debt * 0.05, monthly_income * 12 * 0.3)  # Assume 5% annual debt or 30% max of income
    dti_ratio = annual_debt_payment / annual_income if annual_income > 0 else 0
    
    # Retirement readiness percentage
    readiness_pct = (projected_corpus / retirement_goal * 100) if retirement_goal > 0 else 0
    
    # Compute FMI score
    fmi_score, status = compute_fmi_score(
        actual_monthly_savings=actual_monthly,
        required_monthly_savings=required_monthly,
        debt_to_income_ratio=dti_ratio,
        savings_consistency=savings_consistency,
        retirement_readiness_pct=readiness_pct
    )
    
    # Savings rate performance
    savings_rate_perf = actual_monthly / required_monthly if required_monthly > 0 else 1.0
    
    # Monthly gap
    monthly_gap = actual_monthly - required_monthly
    
    # Compile result
    result = FMIResult(
        score=fmi_score,
        status=status,
        required_monthly_savings=round(required_monthly, 2),
        actual_monthly_savings=round(actual_monthly, 2),
        monthly_gap=round(monthly_gap, 2),
        projected_retirement_corpus=round(projected_corpus, 2),
        years_remaining=years_to_retirement,
        months_remaining=months_to_retirement,
        savings_rate_performance=round(savings_rate_perf, 3),
        debt_to_income_ratio=round(dti_ratio, 3),
        savings_consistency_score=round(savings_consistency, 2),
        retirement_readiness_pct=round(readiness_pct, 2),
        assumptions={
            "annual_interest_rate": annual_interest_rate,
            "annual_inflation_rate": annual_inflation_rate,
            "retirement_goal_dollars": retirement_goal,
            "current_age": age,
            "retirement_age": retirement_age
        },
        warnings=warnings
    )
    
    return result


if __name__ == "__main__":
    # Example usage
    result = calculate_fmi(
        age=45,
        retirement_age=65,
        current_retirement_savings=500000,
        retirement_goal=2000000,
        monthly_income=8000,
        monthly_savings=1500,
        investment_contribution=500,
        debt=50000,
        savings_consistency=0.8,
        annual_interest_rate=0.05
    )
    
    print(f"FMI Score: {result.score} ({result.status})")
    print(f"Required Monthly Savings: ${result.required_monthly_savings:,.2f}")
    print(f"Actual Monthly Savings: ${result.actual_monthly_savings:,.2f}")
    print(f"Monthly Gap: ${result.monthly_gap:,.2f}")
    print(f"Projected Corpus at Retirement: ${result.projected_retirement_corpus:,.2f}")
    print(f"Retirement Readiness: {result.retirement_readiness_pct:.1f}%")
    print(f"Savings Rate Performance: {result.savings_rate_performance:.1f}x target")
    if result.warnings:
        print(f"Warnings: {result.warnings}")
