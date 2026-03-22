def score_sentiment(text: str) -> float:
    lowered = (text or '').lower()

    negative_terms = ['late night', 'impulse', 'overspend', 'zomato', 'swiggy']
    positive_terms = ['salary', 'saved', 'discount', 'budget']

    score = 0.0
    for term in negative_terms:
        if term in lowered:
            score -= 0.2

    for term in positive_terms:
        if term in lowered:
            score += 0.2

    return max(-1.0, min(1.0, score))
