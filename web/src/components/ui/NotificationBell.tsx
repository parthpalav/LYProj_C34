import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { getAssets, getLiabilities, getPaymentMethods } from '../../services/api';
import { buildDueAlerts, buildReviewAlerts, dueLabel, DUE_WINDOW_DAYS } from '../../utils/dueAlerts';
import { formatCurrencyINR } from '../../utils/formatters';
import { AssetReviewModal } from '../plan/AssetReviewModal';
import type { Asset, Liability, PaymentMethod } from '../../types';

// Pop the panel open once per browser session when a monthly check-in is due.
const REVIEW_POPUP_KEY = 'finaura.assetReviewPopupShown';

const REFRESH_MS = 5 * 60 * 1000;

/** Bell beside the theme toggle: bills due within a week, plus monthly check-ins for market-linked assets. */
export const NotificationBell: React.FC = () => {
  const navigate = useNavigate();
  const [liabilities, setLiabilities] = useState<Liability[]>([]);
  const [cards, setCards] = useState<PaymentMethod[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [reviewing, setReviewing] = useState<Asset | null>(null);
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const root = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    // Each source fails alone: a card outage must not hide liability reminders.
    const [l, p, a] = await Promise.allSettled([getLiabilities(), getPaymentMethods(), getAssets()]);
    if (l.status === 'fulfilled') setLiabilities(l.value);
    if (p.status === 'fulfilled') setCards(p.value);
    if (a.status === 'fulfilled') setAssets(a.value);
    setNow(new Date());
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, REFRESH_MS);
    window.addEventListener('focus', load);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', load);
    };
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const alerts = useMemo(() => buildDueAlerts(liabilities, cards, now), [liabilities, cards, now]);
  const reviews = useMemo(() => buildReviewAlerts(assets, now), [assets, now]);
  const count = alerts.length + reviews.length;

  useEffect(() => {
    if (!reviews.length) return;
    try {
      if (sessionStorage.getItem(REVIEW_POPUP_KEY)) return;
      sessionStorage.setItem(REVIEW_POPUP_KEY, '1');
    } catch { /* storage blocked: still show it this once */ }
    setOpen(true);
  }, [reviews.length]);

  return (
    <div className="notif-root" ref={root}>
      <button
        type="button"
        className="theme-toggle notif-bell"
        onClick={() => { setOpen((o) => !o); if (!open) load(); }}
        aria-label={count ? `Notifications, ${count} pending` : 'Notifications'}
        aria-expanded={open}
        aria-haspopup="true"
        title="Notifications"
      >
        <Bell size={17} />
        {count > 0 && <span className="notif-badge" aria-hidden="true">{count > 9 ? '9+' : count}</span>}
      </button>
      {open && (
        <div className="notif-panel" role="region" aria-label="Notifications">
          {reviews.length > 0 && (
            <>
              <div className="notif-head">Monthly check-in</div>
              <ul className="notif-list">
                {reviews.map((a) => (
                  <li key={a.id}>
                    <button type="button" className="notif-item" onClick={() => { setOpen(false); setReviewing(a); }}>
                      <span className="notif-title">{a.name}</span>
                      <span className="notif-amount">{formatCurrencyINR(a.currentValue)}</span>
                      <span className="notif-when">Confirm value and return</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
          <div className="notif-head">Due in the next {DUE_WINDOW_DAYS} days</div>
          {alerts.length === 0 ? (
            <div className="notif-empty">Nothing due this week.</div>
          ) : (
            <ul className="notif-list">
              {alerts.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    className="notif-item"
                    onClick={() => { setOpen(false); navigate('/app/activity'); }}
                  >
                    <span className="notif-title">{a.title}</span>
                    <span className="notif-amount">{formatCurrencyINR(a.amount)}</span>
                    <span className={`notif-when${a.overdue || a.daysUntil <= 1 ? ' notif-when-urgent' : ''}`}>{dueLabel(a)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {reviewing && <AssetReviewModal key={reviewing.id} asset={reviewing} onClose={() => setReviewing(null)} onSaved={load} />}
    </div>
  );
};
