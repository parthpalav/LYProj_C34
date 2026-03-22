def compute_fmi(sentiment: float, spending_deviation: float, income_stability: float, upcoming_bills: float) -> float:
    fmi = (
        0.3 * sentiment
        + 0.3 * spending_deviation
        + 0.2 * income_stability
        + 0.2 * upcoming_bills
    )

    normalized = (fmi + 1) / 2 * 100
    return max(0.0, min(100.0, round(normalized, 2)))
