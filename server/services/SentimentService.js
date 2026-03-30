// ── Keyword dictionaries ────────────────────────────────────
const STRESS_KEYWORDS   = ['loan', 'emi', 'urgent', 'debt', 'borrow', 'lend', 'overdue',
                            'penalty', 'late', 'fine', 'unpaid', 'default', 'interest'];
const POSITIVE_KEYWORDS = ['salary', 'bonus', 'refund', 'cashback', 'reward', 'income',
                            'payment received', 'credited', 'transfer in', 'received'];
const IMPULSE_KEYWORDS  = ['party', 'bar', 'pub', 'netflix', 'amazon', 'flipkart',
                            'swiggy', 'zomato', 'blinkit', 'movie', 'night out', 'drinks',
                            'gaming', 'bet', 'lottery'];
const FOOD_KEYWORDS     = ['zomato', 'swiggy', 'food', 'restaurant', 'cafe', 'coffee',
                            'lunch', 'dinner', 'breakfast', 'snack', 'blinkit', 'bigbasket'];
const TRAVEL_KEYWORDS   = ['uber', 'ola', 'rapido', 'metro', 'auto', 'bus', 'train',
                            'flight', 'flight', 'irctc', 'makemytrip', 'goibibo'];

/**
 * Analyze transaction text + timestamp for sentiment signals.
 * Returns:
 *   sentiment: 'positive' | 'neutral' | 'negative'
 *   score: -1 to 1
 *   tags: string[] (e.g. ['impulse', 'late-night', 'stress'])
 */
function analyzeSentiment(description = '', timestamp = new Date()) {
  const text = (description || '').toLowerCase();
  const hour = new Date(timestamp).getHours();

  let score = 0;
  const tags = [];

  // Positive signals
  if (POSITIVE_KEYWORDS.some((k) => text.includes(k))) {
    score += 0.6;
    tags.push('income');
  }

  // Stress signals
  if (STRESS_KEYWORDS.some((k) => text.includes(k))) {
    score -= 0.5;
    tags.push('stress');
  }

  // Impulse signals
  if (IMPULSE_KEYWORDS.some((k) => text.includes(k))) {
    score -= 0.3;
    tags.push('impulse');
  }

  // Late-night purchase (10pm – 4am)
  if (hour >= 22 || hour <= 4) {
    score -= 0.2;
    tags.push('late-night');
  }

  // Category-based enrichment
  if (FOOD_KEYWORDS.some((k) => text.includes(k))) tags.push('food');
  if (TRAVEL_KEYWORDS.some((k) => text.includes(k))) tags.push('travel');

  const clampedScore = Math.max(-1, Math.min(1, score));
  const sentiment =
    clampedScore > 0.2 ? 'positive' : clampedScore < -0.2 ? 'negative' : 'neutral';

  return { sentiment, score: clampedScore, tags };
}

/**
 * Batch-annotate a list of transactions with sentiment data.
 */
function annotateTransactions(txList) {
  return txList.map((tx) => {
    const result = analyzeSentiment(tx.description, tx.timestamp);
    return { ...tx, sentiment: result.sentiment, sentimentScore: result.score, tags: result.tags };
  });
}

export { analyzeSentiment, annotateTransactions };
