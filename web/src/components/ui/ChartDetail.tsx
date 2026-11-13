import React from 'react';
import { X } from 'lucide-react';

interface ChartDetailProps {
  open: boolean;
  title: string;
  /** colour of the panel's leading edge, usually the picked series colour */
  accent?: string;
  onClose: () => void;
  children: React.ReactNode;
}

/** Summary that expands under a chart when a point is clicked. */
export const ChartDetail: React.FC<ChartDetailProps> = ({ open, title, accent, onClose, children }) => (
  <div className={`chart-detail${open ? ' open' : ''}`} inert={!open} aria-live="polite">
    <div className="chart-detail-clip">
      <div className="chart-detail-body" style={accent ? ({ '--detail-accent': accent } as React.CSSProperties) : undefined}>
        <div className="chart-detail-head">
          <strong>{title}</strong>
          <button type="button" className="chart-detail-close" onClick={onClose} aria-label="Close details">
            <X size={14} />
          </button>
        </div>
        {children}
      </div>
    </div>
  </div>
);

/** One labelled figure inside a ChartDetail; `tone` colours gains and losses. */
export const DetailStat: React.FC<{ label: string; value: string; tone?: 'pos' | 'neg' }> = ({ label, value, tone }) => (
  <div>
    <dt>{label}</dt>
    <dd className={tone}>{value}</dd>
  </div>
);
