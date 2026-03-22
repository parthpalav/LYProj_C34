def moving_average(values, window=3):
    if not values:
        return 0

    if len(values) < window:
        return sum(values) / len(values)

    recent = values[-window:]
    return sum(recent) / window


def detect_threshold_alerts(spending_series, balance):
    avg = moving_average(spending_series)
    latest = spending_series[-1] if spending_series else 0

    return {
        'overspend_risk': latest > avg * 1.2,
        'low_balance_risk': balance < 3000,
    }
