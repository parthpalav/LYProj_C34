import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { getMonthlyReport } from '../services/api';
import { formatCurrencyINR } from '../utils/formatters';
import type { MonthlyReport } from '../types';

const PAGES = 6;

/** "Wrapped"-style story of one month, the web twin of the mobile Recap: money in and out, where it went, mix, FMI score, surprises. */
export const RecapPage: React.FC = () => {
  const navigate = useNavigate();
  const [offset, setOffset] = useState(0); // 0 = this month, 1 = last month
  const [report, setReport] = useState<MonthlyReport | null>(null);
  const [failed, setFailed] = useState(false);
  const [page, setPage] = useState(0);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    setReport(null);
    setFailed(false);
    try {
      setReport(await getMonthlyReport(d.getFullYear(), d.getMonth() + 1));
    } catch {
      setFailed(true);
    }
  }, [offset]);
  useEffect(() => { void load(); }, [load]);

  const close = useCallback(() => navigate('/app/reports?tab=monthly'), [navigate]);
  const goTo = useCallback((p: number) => setPage(Math.max(0, Math.min(PAGES - 1, p))), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') setPage((p) => Math.min(PAGES - 1, p + 1));
      else if (e.key === 'ArrowLeft') setPage((p) => Math.max(0, p - 1));
      else if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);

  const share = async () => {
    if (!report) return;
    const top = report.topCategories[0];
    const text = `My ${report.periodLabel} on FINAURA: ${formatCurrencyINR(report.totalIncome)} in, ${formatCurrencyINR(report.totalExpenses)} out, ${report.savingsRate}% saved.${top ? ` Biggest category: ${top.category}.` : ''}`;
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        setCopied(true);
      }
    } catch { /* share sheet dismissed */ }
  };

  const mixTotal = report ? report.spendingMix.Needs + report.spendingMix.Wants + report.spendingMix.Investments : 0;
  const mix = report
    ? [
      { label: 'Needs', value: report.spendingMix.Needs, color: '#93C5FD' },
      { label: 'Wants', value: report.spendingMix.Wants, color: '#FCD34D' },
      { label: 'Investments', value: report.spendingMix.Investments, color: '#6EE7B7' },
    ]
    : [];
  // Buttons inside a slide must not also turn the page.
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  const pages = report ? [
    <>
      <span className="recap-kicker">Your month in money</span>
      <h1 className="recap-huge">{report.periodLabel}</h1>
      <p>{report.transactionCount} transactions and {report.incomeCount} income receipt{report.incomeCount === 1 ? '' : 's'}. Click or use the arrow keys to see how it went.</p>
      <div className="recap-row" onClick={stop}>
        <button type="button" className={`recap-chip${offset === 0 ? ' on' : ''}`} onClick={() => setOffset(0)}>This month</button>
        <button type="button" className={`recap-chip${offset === 1 ? ' on' : ''}`} onClick={() => setOffset(1)}>Last month</button>
      </div>
    </>,
    <>
      <span className="recap-kicker">Money in, money out</span>
      <div><small>Came in</small><strong className="recap-big">{formatCurrencyINR(report.totalIncome)}</strong></div>
      <div><small>Went out</small><strong className="recap-big">{formatCurrencyINR(report.totalExpenses)}</strong></div>
      <span className="recap-badge">{report.netCashFlow >= 0 ? `You kept ${report.savingsRate}%` : `Overspent by ${formatCurrencyINR(Math.abs(report.netCashFlow))}`}</span>
    </>,
    <>
      <span className="recap-kicker">Where it went</span>
      {report.topCategories.length === 0 ? <p>No spending logged this month.</p> : report.topCategories.slice(0, 4).map((cat, i) => (
        <div key={cat.category} className="recap-cat">
          <div className="recap-line"><span>{i + 1}. {cat.category}</span><span>{formatCurrencyINR(cat.amount)}</span></div>
          <div className="recap-track"><i style={{ width: `${Math.min(100, cat.pct)}%`, opacity: i === 0 ? 1 : 0.6 }} /></div>
        </div>
      ))}
    </>,
    <>
      <span className="recap-kicker">Needs, wants, future you</span>
      {mix.map((m) => (
        <div key={m.label} className="recap-line recap-mix">
          <span><i className="recap-dot" style={{ background: m.color }} />{m.label}</span>
          <span>{mixTotal > 0 ? Math.round((m.value / mixTotal) * 100) : 0}%</span>
        </div>
      ))}
      <p>{mixTotal > 0 && report.spendingMix.Wants / mixTotal > 0.3 ? 'Wants took more than the usual 30% guide.' : 'Wants stayed within the usual 30% guide. Nice.'}</p>
    </>,
    <>
      <span className="recap-kicker">Financial Maturity Index</span>
      {report.fmi.hasSnapshots && report.fmi.last !== null ? (
        <>
          <strong className="recap-giant">{Math.round(report.fmi.last)}</strong>
          <p>
            {report.fmi.change === null || report.fmi.change === 0
              ? 'Steady through the month.'
              : `${report.fmi.change > 0 ? 'Up' : 'Down'} ${Math.abs(Math.round(report.fmi.change))} points since the start of the month.`}
          </p>
        </>
      ) : <p>Open the app a few more days this month to track how your score moves.</p>}
    </>,
    <>
      <span className="recap-kicker">Anything unusual?</span>
      {report.anomalies.count === 0 ? <strong className="recap-big">Nothing odd 🎉</strong> : (
        <>
          <strong className="recap-big">{report.anomalies.count} big spend{report.anomalies.count === 1 ? '' : 's'}</strong>
          {report.anomalies.items.slice(0, 3).map((a) => (
            <div key={a.id} className="recap-line"><span>{a.description || a.category}</span><span>{formatCurrencyINR(a.amount)}</span></div>
          ))}
        </>
      )}
      <div className="recap-row" onClick={stop}>
        <button type="button" className="recap-chip" onClick={share}>{copied ? 'Copied' : 'Share summary'}</button>
        <button type="button" className="recap-chip on" onClick={close}>Done</button>
      </div>
    </>,
  ] : [];

  return (
    <div className="recap" role="dialog" aria-modal="true" aria-label="Monthly recap">
      <div className="recap-top">
        <div className="recap-segments" aria-hidden="true">
          {Array.from({ length: PAGES }, (_, i) => <i key={i} className={i <= page ? 'on' : ''} />)}
        </div>
        <button type="button" className="recap-close" onClick={close} aria-label="Close recap"><X size={20} /></button>
      </div>
      {!report ? (
        <div className="recap-page">
          {failed ? (
            <>
              <p>Couldn't load this month's recap.</p>
              <div className="recap-row"><button type="button" className="recap-chip" onClick={load}>Try again</button></div>
            </>
          ) : <p>Loading…</p>}
        </div>
      ) : (
        // Click the left third to go back, anywhere else to go forward, like stories. Arrow keys do the same.
        <div
          key={page}
          className="recap-page"
          aria-live="polite"
          onClick={(e) => goTo(e.clientX < window.innerWidth / 3 ? page - 1 : page + 1)}
        >
          {pages[page]}
        </div>
      )}
    </div>
  );
};

export default RecapPage;
