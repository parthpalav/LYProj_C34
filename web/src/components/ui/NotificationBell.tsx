import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { getLiabilities, getPaymentMethods } from '../../services/api';
import { buildDueAlerts, dueLabel, DUE_WINDOW_DAYS } from '../../utils/dueAlerts';
import { formatCurrencyINR } from '../../utils/formatters';
import type { Liability, PaymentMethod } from '../../types';

const REFRESH_MS = 5 * 60 * 1000;

/** Bell beside the theme toggle: lists liabilities and credit-card bills due within a week. */
export const NotificationBell: React.FC = () => {
  const navigate = useNavigate();
  const [liabilities, setLiabilities] = useState<Liability[]>([]);
  const [cards, setCards] = useState<PaymentMethod[]>([]);
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const root = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    // Each source fails alone: a card outage must not hide liability reminders.
    const [l, p] = await Promise.allSettled([getLiabilities(), getPaymentMethods()]);
    if (l.status === 'fulfilled') setLiabilities(l.value);
    if (p.status === 'fulfilled') setCards(p.value);
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
  const count = alerts.length;

  return (
    <div className="notif-root" ref={root}>
      <button
        type="button"
        className="theme-toggle notif-bell"
        onClick={() => { setOpen((o) => !o); if (!open) load(); }}
        aria-label={count ? `Notifications, ${count} due soon` : 'Notifications'}
        aria-expanded={open}
        aria-haspopup="true"
        title="Notifications"
      >
        <Bell size={17} />
        {count > 0 && <span className="notif-badge" aria-hidden="true">{count > 9 ? '9+' : count}</span>}
      </button>
      {open && (
        <div className="notif-panel" role="region" aria-label="Upcoming bills">
          <div className="notif-head">Due in the next {DUE_WINDOW_DAYS} days</div>
          {count === 0 ? (
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
    </div>
  );
};
