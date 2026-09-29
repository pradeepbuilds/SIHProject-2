import React, { useState, useEffect } from 'react';
import { Copy, Printer, ChevronDown, ChevronUp, HelpCircle, FileText } from 'lucide-react';
import type { PredictionResponse, StripItem, Advisory, PredictionExplanation } from '../types/api';
import { getTranslation, formatTemplate, formatDateLocale, type SupportedLanguage } from '../i18n';
import { fetchPredictionStrip, fetchPredictionExplain } from '../services/api';

interface ForecastCardProps {
  prediction: PredictionResponse | null;
  selectedPanchayatId: string;
  selectedPanchayatName: string;
  selectedCrop: string;
  onSelectCrop: (crop: string) => void;
  availableCrops: string[];
  advisories: Advisory[];
  date: string;
  lang: SupportedLanguage;
  userView: 'farmer' | 'officer';
  regionId: string;
  onOpenBulletin: () => void;
}

export const ForecastCard: React.FC<ForecastCardProps> = ({
  prediction,
  selectedPanchayatId,
  selectedPanchayatName,
  selectedCrop,
  onSelectCrop,
  availableCrops,
  advisories,
  date,
  lang,
  userView,
  regionId,
  onOpenBulletin
}) => {
  const t = getTranslation(lang);
  const [strip, setStrip] = useState<StripItem[]>([]);
  const [explanation, setExplanation] = useState<PredictionExplanation | null>(null);
  const [showExplain, setShowExplain] = useState<boolean>(false);
  const [expandedAdvisoryId, setExpandedAdvisoryId] = useState<string | null>(null);
  const [smsCopied, setSmsCopied] = useState<boolean>(false);

  // Fetch 5-Day Strip
  useEffect(() => {
    if (!selectedPanchayatId) return;
    fetchPredictionStrip(selectedPanchayatId, date, 5, regionId)
      .then(setStrip)
      .catch(console.error);
  }, [selectedPanchayatId, date, regionId]);

  // Fetch Explanation
  useEffect(() => {
    if (!selectedPanchayatId) return;
    fetchPredictionExplain(selectedPanchayatId, date, prediction?.variable || 'rainfall', regionId)
      .then(setExplanation)
      .catch(console.error);
  }, [selectedPanchayatId, date, prediction?.variable, regionId]);

  // Generate Farmer Headline Sentence
  const generateHeadline = (): string => {
    if (!prediction) return '';
    const formattedDate = formatDateLocale(date, lang);
    if (prediction.variable.includes('rain')) {
      const p = Math.round((prediction.rain_probability ?? 0.1) * 100);
      const p50 = prediction.rainfall_mm ?? prediction.value ?? prediction.prediction ?? 0.0;
      const p90 = prediction.wet_amount_p90 ?? prediction.uncertainty_interval?.p90 ?? 0.0;

      if (p < 20) {
        return formatTemplate(t.farmer.headline_rain_unlikely, { date: formattedDate });
      } else if (p < 50) {
        return formatTemplate(t.farmer.headline_rain_possible, { date: formattedDate, p });
      } else {
        return formatTemplate(t.farmer.headline_rain_likely, { date: formattedDate, p, p50, p90 });
      }
    } else {
      const tmax = prediction.value ?? prediction.prediction ?? prediction.uncertainty_interval?.p50 ?? 30.0;
      const p10 = prediction.uncertainty_interval?.p10 ?? (tmax - 1.2);
      const p90 = prediction.uncertainty_interval?.p90 ?? (tmax + 1.2);
      return formatTemplate(t.farmer.headline_temp, { tmax, p10, p90 });
    }
  };

  // Copy SMS Text (<= 300 chars)
  const handleCopySMS = () => {
    const loc = selectedPanchayatName || selectedPanchayatId;
    const headline = generateHeadline();
    const topAdv = advisories.length > 0 ? advisories[0].message : '';
    const sms = `KrishiMitra [${loc}]: ${headline} ${topAdv}`.slice(0, 295);

    navigator.clipboard.writeText(sms).then(() => {
      setSmsCopied(true);
      setTimeout(() => setSmsCopied(false), 2500);
    });
  };

  if (!prediction) {
    return (
      <div className="km-card km-forecast-card km-empty-card">
        <p>Select a panchayat on the map to view downscaled forecast.</p>
      </div>
    );
  }

  const uncLabel = prediction.uncertainty_label || 'medium';

  return (
    <div className="km-card km-forecast-card" role="region" aria-label="Forecast Details">
      {/* Panchayat Header */}
      <div className="km-forecast-header">
        <div>
          <span className="km-unit-badge">Panchayat Level</span>
          <h2 className="km-location-title">{selectedPanchayatName || selectedPanchayatId}</h2>
          <div className="km-forecast-date">{formatDateLocale(date, lang)}</div>
        </div>
        <div className={`km-confidence-pill km-conf-${uncLabel}`} title="Calibrated 80% interval uncertainty">
          {t.confidence[uncLabel] || uncLabel}
        </div>
      </div>

      {/* FARMER VIEW */}
      {userView === 'farmer' && (
        <div className="km-farmer-section">
          {/* Main Plain-Language Message */}
          <div className="km-farmer-headline-box">
            <p className="km-farmer-headline">{generateHeadline()}</p>
          </div>

          {/* 5-Day Strip */}
          <div className="km-strip-container">
            <h3 className="km-section-heading">{t.farmer.five_day_strip}</h3>
            <div className="km-strip-grid">
              {strip.map((item, idx) => {
                const dayRain = item.rainfall?.rainfall_mm ?? item.rainfall?.value ?? 0;
                const prob = Math.round((item.rainfall?.rain_probability ?? 0.1) * 100);
                const tHigh = Math.round(item.temp_max?.value ?? item.temp_max?.prediction ?? item.temp_max?.uncertainty_interval?.p50 ?? 30);
                const tLow = Math.round(item.temp_min?.value ?? item.temp_min?.prediction ?? item.temp_min?.uncertainty_interval?.p50 ?? 20);

                return (
                  <div key={idx} className="km-strip-day">
                    <span className="km-day-label">{formatDateLocale(item.date, lang).split(' ')[0]}</span>
                    <span className="km-day-prob">{prob}% rain</span>
                    <span className="km-day-rain">{dayRain} mm</span>
                    <span className="km-day-temp">{tHigh}° / {tLow}°</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Crop Selector & Advisories */}
          <div className="km-advisory-section">
            <div className="km-advisory-header-row">
              <h3 className="km-section-heading">{t.farmer.advisories_title}</h3>
              <div className="km-crop-select-wrapper">
                <label htmlFor="crop-select" className="km-inline-label">
                  {t.farmer.crop_label}
                </label>
                <select
                  id="crop-select"
                  className="km-select km-select-sm"
                  value={selectedCrop}
                  onChange={(e) => onSelectCrop(e.target.value)}
                >
                  {availableCrops.map((c) => (
                    <option key={c} value={c}>
                      {c.charAt(0).toUpperCase() + c.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="km-advisory-list">
              {advisories.slice(0, 3).map((adv) => {
                const isExpanded = expandedAdvisoryId === adv.rule_id;
                return (
                  <div key={adv.rule_id} className={`km-advisory-item km-severity-${adv.severity}`}>
                    <div className="km-advisory-top">
                      <span className="km-adv-severity">{adv.severity.toUpperCase()}</span>
                      <strong className="km-adv-title">{adv.title}</strong>
                    </div>
                    <p className="km-adv-msg">{adv.message}</p>

                    <button
                      type="button"
                      className="km-expander-toggle"
                      onClick={() => setExpandedAdvisoryId(isExpanded ? null : adv.rule_id)}
                      aria-expanded={isExpanded}
                    >
                      <span>{t.farmer.why_rule}</span>
                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>

                    {isExpanded && (
                      <div className="km-expander-content">
                        <div className="km-meta-row">
                          <span>Rule ID:</span> <code>{adv.rule_id}</code>
                        </div>
                        {adv.trigger_inputs && (
                          <div className="km-meta-row">
                            <span>Trigger Inputs:</span>
                            <code>{JSON.stringify(adv.trigger_inputs)}</code>
                          </div>
                        )}
                        <p className="km-disclaimer-text">{adv.disclaimer}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Why This Differs Expander */}
          {explanation && explanation.contributions && (
            <div className="km-diff-explain-box">
              <button
                type="button"
                className="km-explain-toggle"
                onClick={() => setShowExplain(!showExplain)}
                aria-expanded={showExplain}
              >
                <div className="km-explain-title-row">
                  <HelpCircle size={15} />
                  <span>{t.farmer.why_differs}</span>
                </div>
                {showExplain ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              </button>

              {showExplain && (
                <div className="km-explain-details">
                  <p className="km-explain-summary">
                    Block forecast ({explanation.coarse_value} mm/°C) adjusted for local terrain & land cover:
                  </p>
                  <ul className="km-contrib-list">
                    {explanation.contributions.slice(0, 3).map((c, i) => (
                      <li key={i} className={`km-contrib-item km-impact-${c.impact}`}>
                        <span className="km-contrib-label">{c.label}:</span>
                        <strong className="km-contrib-val">
                          {c.contribution > 0 ? `+${c.contribution}` : c.contribution} {c.unit}
                        </strong>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Farmer Actions: SMS & Bulletin */}
          <div className="km-card-actions">
            <button type="button" className="km-btn km-btn-outline" onClick={handleCopySMS}>
              <Copy size={15} />
              <span>{smsCopied ? t.farmer.sms_copied : t.farmer.copy_sms}</span>
            </button>
            <button type="button" className="km-btn km-btn-primary" onClick={onOpenBulletin}>
              <Printer size={15} />
              <span>{t.farmer.print_bulletin}</span>
            </button>
          </div>
        </div>
      )}

      {/* OFFICER VIEW */}
      {userView === 'officer' && (
        <div className="km-officer-section">
          {/* Full Quantile & Baseline Diagnostics Block */}
          <div className="km-diagnostics-box">
            <h3 className="km-diagnostics-heading">{t.officer.full_metrics_block}</h3>
            <div className="km-diagnostics-grid">
              <div className="km-diag-card">
                <span className="km-diag-label">Block Baseline</span>
                <span className="km-diag-val">{prediction.coarse_reference?.value ?? 'N/A'} {prediction.unit || 'mm'}</span>
              </div>
              <div className="km-diag-card km-diag-highlight">
                <span className="km-diag-label">KrishiMitra P50</span>
                <span className="km-diag-val">{prediction.value} {prediction.unit || 'mm'}</span>
              </div>
              <div className="km-diag-card">
                <span className="km-diag-label">10th Percentile (P10)</span>
                <span className="km-diag-val">{prediction.uncertainty_interval?.p10} {prediction.unit || 'mm'}</span>
              </div>
              <div className="km-diag-card">
                <span className="km-diag-label">90th Percentile (P90)</span>
                <span className="km-diag-val">{prediction.uncertainty_interval?.p90} {prediction.unit || 'mm'}</span>
              </div>
            </div>

            <div className="km-diag-meta">
              <div className="km-meta-item">
                <span>80% Interval Width:</span>
                <strong>{prediction.interval_width} {prediction.unit || 'mm'}</strong>
              </div>
              <div className="km-meta-item">
                <span>Uncertainty Class:</span>
                <strong className={`km-unc-${uncLabel}`}>{uncLabel.toUpperCase()}</strong>
              </div>
              <div className="km-meta-item">
                <span>Model Engine:</span>
                <code>{prediction.model_version}</code>
              </div>
            </div>
          </div>

          {/* Quick Officer Action */}
          <div className="km-officer-actions">
            <button type="button" className="km-btn km-btn-primary" onClick={onOpenBulletin}>
              <FileText size={15} />
              <span>Print Official District Bulletin</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
