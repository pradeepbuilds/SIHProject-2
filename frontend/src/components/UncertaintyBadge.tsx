import React from 'react';
import { ShieldCheck, AlertTriangle, AlertOctagon, Info } from 'lucide-react';
import type { UncertaintyInterval } from '../types/api';
import { getUncertaintyColor, formatUnit } from '../utils/formatters';

interface UncertaintyBadgeProps {
  label: 'low' | 'medium' | 'high';
  interval: UncertaintyInterval;
  variable: string;
}

export const UncertaintyBadge: React.FC<UncertaintyBadgeProps> = ({
  label,
  interval,
  variable
}) => {
  const colors = getUncertaintyColor(label);
  const unit = formatUnit(variable);
  const width = Math.max(0, interval.p90 - interval.p10);

  const getIcon = () => {
    switch (label) {
      case 'low':
        return <ShieldCheck size={14} color="#10b981" />;
      case 'high':
        return <AlertOctagon size={14} color="#ef4444" />;
      case 'medium':
      default:
        return <AlertTriangle size={14} color="#f59e0b" />;
    }
  };

  return (
    <div className="uncertainty-card">
      <div className="uncertainty-header">
        <div className="uncertainty-title">
          <Info size={14} />
          <span>Forecast Confidence & Quantiles</span>
        </div>
        <div
          className="uncertainty-pill"
          style={{ backgroundColor: colors.bg, color: colors.text, borderColor: colors.border }}
        >
          {getIcon()}
          <span>{label.toUpperCase()} UNCERTAINTY</span>
        </div>
      </div>

      {/* Quantile Interval Bar */}
      <div className="quantile-range-container">
        <div className="quantile-labels">
          <span className="quantile-label">p10 (Lower): <strong>{interval.p10} {unit}</strong></span>
          <span className="quantile-label-center">p50 (Median): <strong>{interval.p50} {unit}</strong></span>
          <span className="quantile-label">p90 (Upper): <strong>{interval.p90} {unit}</strong></span>
        </div>

        <div className="quantile-bar-track">
          <div className="quantile-bar-fill" />
          <div className="quantile-median-marker" style={{ left: '50%' }} />
        </div>

        <div className="quantile-summary">
          <span>80% Prediction Interval Width: <strong>±{(width / 2).toFixed(1)} {unit}</strong> (Total Spread: {width.toFixed(1)} {unit})</span>
        </div>
      </div>
    </div>
  );
};
