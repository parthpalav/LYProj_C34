import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../ui/Button';
import { createLiability, getSubscriptionSuggestions } from '../../services/api';
import { formatCurrencyINR } from '../../utils/formatters';
import type { SubscriptionSuggestion, Transaction } from '../../types';
import { zparts } from '../../utils/timezone';

interface ActivityNudgesProps {
  transactions: Transaction[];
  onBillTracked?: () => void;
  notify: (message: string, type?: 'success' | 'error' | 'info') => void;
}

/** Mobile Activity cards: AI guesses to check, and repeating charges worth tracking as bills. */
export const ActivityNudges: React.FC<ActivityNudgesProps> = ({ transactions, onBillTracked, notify }) => {
  const [suggestions, setSuggestions] = useState<SubscriptionSuggestion[]>([]);
  const [busy, setBusy] = useState(false);
  const reviewCount = transactions.filter((t) => t.needsReview).length;

  useEffect(() => {
    let mounted = true;
    getSubscriptionSuggestions()
      .then((list) => mounted && setSuggestions(list))
      .catch(() => { /* optional nudge; stay quiet on failure */ });
    return () => { mounted = false; };
  }, []);

  const track = async (s: SubscriptionSuggestion) => {
    const next = new Date(s.nextExpected);
    setBusy(true);
    try {
      await createLiability({
        name: s.name, amount: s.amount, category: s.category, type: s.type, frequency: s.frequency,
        startDate: next.toISOString(), autoDeduct: false,
        ...(s.frequency === 'monthly' ? { dayOfMonth: zparts(next).day } : { dayOfWeek: zparts(next).weekday }),
      });
      setSuggestions((list) => list.filter((x) => x.key !== s.key));
      notify(`Tracking ${s.name} as a ${s.frequency} bill. Find it under Liabilities.`);
      onBillTracked?.();
    } catch {
      notify("Couldn't add that bill.", 'error');
    } finally {
      setBusy(false);
    }
  };

  const suggestion = suggestions[0];
  if (!reviewCount && !suggestion) return null;

  return (
    <div>
      {reviewCount > 0 && (
        <div className="parity-nudge parity-nudge-warn">
          <div>
            <strong>{reviewCount} AI {reviewCount === 1 ? 'guess' : 'guesses'} to check</strong>
            <span>FINAURA wasn't sure how to label {reviewCount === 1 ? 'this one' : 'these'}. Confirming teaches it your merchants.</span>
          </div>
          <Link className="next-step-action" to="/app/review">Review now</Link>
        </div>
      )}
      {suggestion && (
        <div className="parity-nudge">
          <div>
            <strong>Looks like a {suggestion.frequency} charge: {suggestion.name}</strong>
            <span>{formatCurrencyINR(suggestion.amount)} seen {suggestion.occurrences} times. Track it as a bill to see it coming.</span>
          </div>
          <div className="parity-row">
            <Button size="sm" variant="secondary" onClick={() => track(suggestion)} isLoading={busy}>Track as bill</Button>
            <Button size="sm" variant="ghost" onClick={() => setSuggestions((l) => l.slice(1))} disabled={busy}>Not now</Button>
          </div>
        </div>
      )}
    </div>
  );
};
