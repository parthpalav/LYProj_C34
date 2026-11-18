import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getSipSchedule } from '../../services/api';
import type { SipSchedule } from '../../types';
import { formatCurrencyINR, formatDateShort } from '../../utils/formatters';
import { dateKeyToDate } from '../../utils/timezone';

export function SipSchedulePanel({ refresh }: { refresh: number }) {
  const [schedule, setSchedule] = useState<SipSchedule | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    getSipSchedule().then(data => {
      if (active) { setSchedule(data); setError(false); }
    }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [refresh]);
  return (
    <section className="plan-surface-card">
      <h3>Scheduled SIPs</h3>
      {error ? <p role="alert">Could not load SIPs. Use Refresh to try again.</p> : !schedule ? <p>Loading SIPs…</p> :
        schedule.items.length ? <>
          <p>{formatCurrencyINR(schedule.remaining)} reserved this month</p>
          <ul className="committed-list">{schedule.items.map(item => (
            <li key={item.id} className="committed-item">
              <strong>{item.name}</strong>
              <span>{formatDateShort(dateKeyToDate(item.dueDate))} · {item.status}</span>
              <span>{formatCurrencyINR(item.amount)}</span>
            </li>
          ))}</ul>
        </> : <p>Set a debit date on an asset with a monthly SIP to see its schedule.</p>}
      <Link to="/app/net-worth?tab=assets">Manage investments</Link>
    </section>
  );
}
