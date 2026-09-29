import React, { useState, useEffect } from 'react';
import {
  Copy,
  Printer,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  FileText,
  AlertTriangle,
  Info,
  ShieldAlert,
  Sprout,
  Calendar,
  Layers,
  Check,
  TrendingUp,
  Thermometer,
  CloudRain
} from 'lucide-react';
import type { PredictionResponse, StripItem, Advisory, PredictionExplanation, CropInfo } from '../types/api';
import { getTranslation, formatTemplate, formatDateLocale, type SupportedLanguage } from '../i18n';
import { fetchPredictionStrip, fetchPredictionExplain, fetchCrops } from '../services/api';
import { FarmerTrendChart } from './FarmerTrendChart';

interface ForecastCardProps {
  prediction: PredictionResponse | null;
  selectedPanchayatId: string;
  selectedPanchayatName: string;
  selectedCrop: string;
  onSelectCrop: (crop: string) => void;
  selectedStage?: string;
  onSelectStage?: (stage: string) => void;
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
  selectedStage,
  onSelectStage,
  availableCrops,
  advisories,
  date,
  lang,
  userView,
  regionId,
  onOpenBulletin
}) => {
  const t = getTranslation(lang);
  const f = t.farmer || {};
  const [strip, setStrip] = useState<StripItem[]>([]);
  const [explanation, setExplanation] = useState<PredictionExplanation | null>(null);
  const [showExplain, setShowExplain] = useState<boolean>(false);
  const [expandedWhyIds, setExpandedWhyIds] = useState<Record<string, boolean>>({});
  const [smsCopied, setSmsCopied] = useState<boolean>(false);
  const [cropsCatalog, setCropsCatalog] = useState<Record<string, CropInfo>>({});
  const [showTrendChart, setShowTrendChart] = useState<boolean>(true);

  // Load Crops Catalog
  useEffect(() => {
    fetchCrops()
      .then(setCropsCatalog)
      .catch((e) => console.warn('Could not load crops catalog:', e));
  }, []);

  // Fetch 5-Day Strip
  useEffect(() => {
    if (!selectedPanchayatId) return;
    fetchPredictionStrip(selectedPanchayatId, date, 5, regionId)
      .then(setStrip)
      .catch(console.error);
  }, [selectedPanchayatId, date, regionId]);

  // Fetch Feature Explanation
  useEffect(() => {
    if (!selectedPanchayatId) return;
    fetchPredictionExplain(selectedPanchayatId, date, prediction?.variable || 'rainfall', regionId)
      .then(setExplanation)
      .catch(console.error);
  }, [selectedPanchayatId, date, prediction?.variable, regionId]);

  // Current crop stages list
  const currentCropMeta = cropsCatalog[selectedCrop.toLowerCase()];
  const availableStages = currentCropMeta ? Object.keys(currentCropMeta.stages) : ['sowing', 'vegetative', 'flowering', 'grain_filling', 'maturity'];
  const activeStage = selectedStage || availableStages[0] || 'vegetative';

  // Toggle Why drawer for an advisory
  const toggleWhy = (ruleId: string) => {
    setExpandedWhyIds((prev) => ({ ...prev, [ruleId]: !prev[ruleId] }));
  };

  // Generate Farmer Headline Sentence
  const generateHeadline = (): string => {
    if (!prediction) return t.common?.loading || 'Local forecast loading...';
    const formattedDate = formatDateLocale(date, lang);
    if (prediction.variable.includes('rain')) {
      const p = Math.round((prediction.rain_probability ?? 0.1) * 100);
      const p50 = prediction.rainfall_mm ?? prediction.value ?? prediction.prediction ?? 0.0;
      const p90 = prediction.wet_amount_p90 ?? prediction.uncertainty_interval?.p90 ?? 0.0;

      if (p < 20) {
        return formatTemplate(f.headline_rain_unlikely || 'Rain is unlikely on {{date}}.', { date: formattedDate });
      } else if (p < 50) {
        return formatTemplate(f.headline_rain_possible || 'There is a chance of rain (about {{p}}%).', { date: formattedDate, p });
      } else {
        return formatTemplate(f.headline_rain_likely || 'Rain is likely (about {{p}}%). Expect around {{p50}} mm, up to {{p90}} mm if it turns heavy.', { date: formattedDate, p, p50: p50.toFixed(1), p90: p90.toFixed(1) });
      }
    } else {
      const tmax = prediction.value ?? prediction.prediction ?? prediction.uncertainty_interval?.p50 ?? 30.0;
      const p10 = prediction.uncertainty_interval?.p10 ?? (tmax - 1.5);
      const p90 = prediction.uncertainty_interval?.p90 ?? (tmax + 1.5);
      return formatTemplate(f.headline_temp || 'Daytime high around {{tmax}} °C (likely between {{p10}} and {{p90}} °C).', { tmax: Math.round(tmax), p10: Math.round(p10), p90: Math.round(p90) });
    }
  };

  // Copy SMS Text (<= 300 chars)
  const handleCopySMS = () => {
    const loc = selectedPanchayatName || selectedPanchayatId;
    const headline = generateHeadline();
    const topAdv = advisories.length > 0 ? advisories[0].message : '';
    const sms = `[KrishiMitra ${loc} (${date})]: ${headline} | Advisory: ${topAdv}`.slice(0, 290);

    navigator.clipboard.writeText(sms).then(() => {
      setSmsCopied(true);
      setTimeout(() => setSmsCopied(false), 2500);
    });
  };

  if (!prediction) {
    return (
      <div className="km-forecast-card km-empty-card" role="region" aria-label="Forecast Details">
        <div className="km-empty-content">
          <Info size={32} className="km-text-brand" />
          <h3>{f.empty_title || 'No Panchayat Selected'}</h3>
          <p>{f.empty_desc || 'Click any panchayat on the map or select from the dropdown above to view local weather intelligence.'}</p>
        </div>
      </div>
    );
  }

  const uncLabel = prediction.uncertainty_label || 'medium';
  const displayVal = prediction.value ?? prediction.prediction ?? 0;
  const coarseVal = prediction.coarse_reference?.value ?? 0;
  const diffVal = Number((displayVal - coarseVal).toFixed(1));

  // Merge region crops with catalog keys
  const combinedCropKeys = Array.from(new Set([...availableCrops, ...Object.keys(cropsCatalog)]));

  return (
    <div className="km-forecast-card" role="region" aria-label="Forecast Details">
      {/* Header Banner */}
      <div className="km-fc-header">
        <div className="km-fc-header-main">
          <span className="km-unit-badge">{t.auth?.visual_panchayat_label || 'Panchayat Weather Intelligence'}</span>
          <h2 className="km-location-title">{selectedPanchayatName || selectedPanchayatId}</h2>
          <div className="km-forecast-date-row">
            <Calendar size={14} />
            <span>{formatDateLocale(date, lang)}</span>
            <span className="km-tag-id">ID: {selectedPanchayatId}</span>
          </div>
        </div>

        <div className={`km-confidence-pill km-conf-${uncLabel}`} title="Calibrated 80% uncertainty interval">
          <span className="km-conf-dot" />
          <span>{t.confidence?.[uncLabel] || uncLabel.toUpperCase()}</span>
        </div>
      </div>

      {/* Main Plain-Language Farmer Headline */}
      <div className="km-farmer-headline-box">
        <div className="km-headline-icon-wrap">
          {prediction.variable.includes('rain') ? <CloudRain size={22} className="km-text-info" /> : <Thermometer size={22} className="km-text-warn" />}
        </div>
        <p className="km-farmer-headline">{generateHeadline()}</p>
      </div>

      {/* 5-Day Weather Strip */}
      <div className="km-strip-section">
        <div className="km-section-header">
          <h3 className="km-section-title">{f.five_day_strip || '5-Day Panchayat Forecast'}</h3>
          <span className="km-section-sub">{f.calibrated_outlook || 'Calibrated Panchayat Outlook'}</span>
        </div>

        <div className="km-strip-grid">
          {strip.map((item, idx) => {
            const dayRain = item.rainfall?.rainfall_mm ?? item.rainfall?.value ?? 0;
            const prob = Math.round((item.rainfall?.rain_probability ?? 0.1) * 100);
            const tHigh = Math.round(item.temp_max?.value ?? item.temp_max?.prediction ?? item.temp_max?.uncertainty_interval?.p50 ?? 30);
            const tLow = Math.round(item.temp_min?.value ?? item.temp_min?.prediction ?? item.temp_min?.uncertainty_interval?.p50 ?? 20);
            const isTargetDate = item.date === date;

            return (
              <div key={idx} className={`km-strip-day ${isTargetDate ? 'km-strip-active' : ''}`}>
                <span className="km-day-label">{formatDateLocale(item.date, lang).split(' ')[0]}</span>
                <span className="km-day-prob">{prob}% {t.common?.crop ? '' : 'rain'}</span>
                <span className="km-day-rain">{dayRain.toFixed(1)} mm</span>
                <span className="km-day-temp">{tHigh}° / {tLow}°</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Crop & Phenological Stage Selector */}
      <div className="km-crop-stage-box">
        <div className="km-crop-stage-header">
          <Sprout size={18} className="km-text-success" />
          <h4>{f.crop_stage_context || 'Crop & Stage Context'}</h4>
        </div>

        <div className="km-crop-controls-grid">
          <div className="km-control-col">
            <label htmlFor="card-crop-select" className="km-control-label">
              {f.cultivated_crop || 'Cultivated Crop'}
            </label>
            <select
              id="card-crop-select"
              className="km-select km-select-crop"
              value={selectedCrop.toLowerCase()}
              onChange={(e) => {
                const newCrop = e.target.value;
                onSelectCrop(newCrop);
                const newStages = cropsCatalog[newCrop]?.stages ? Object.keys(cropsCatalog[newCrop].stages) : ['sowing', 'vegetative'];
                if (onSelectStage && newStages.length > 0) {
                  onSelectStage(newStages[0]);
                }
              }}
            >
              {combinedCropKeys.map((c) => (
                <option key={c} value={c}>
                  {cropsCatalog[c]?.name || c.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          <div className="km-control-col">
            <label htmlFor="card-stage-select" className="km-control-label">
              {f.phenological_stage || 'Phenological Stage'}
            </label>
            <select
              id="card-stage-select"
              className="km-select km-select-stage"
              value={activeStage}
              onChange={(e) => onSelectStage && onSelectStage(e.target.value)}
            >
              {availableStages.map((st) => (
                <option key={st} value={st}>
                  {st.replace('_', ' ').toUpperCase()}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Actionable Agrometeorological Advisories */}
      <div className="km-advisory-section">
        <div className="km-section-header">
          <h3 className="km-section-title">{f.actionable_guidance || 'Actionable Agricultural Guidance'}</h3>
          <span className="km-badge km-badge-stage">{selectedCrop.toUpperCase()} · {activeStage.toUpperCase()}</span>
        </div>

        {advisories.length === 0 ? (
          <div className="km-advisory-empty">
            <Check size={20} className="km-text-success" />
            <p>
              {f.no_critical_alerts
                ? formatTemplate(f.no_critical_alerts, { crop: selectedCrop.toUpperCase(), stage: activeStage.toUpperCase() })
                : `No critical weather alerts for ${selectedCrop} (${activeStage}) today. Proceed with routine field operations.`}
            </p>
          </div>
        ) : (
          <div className="km-advisory-list">
            {advisories.map((adv, idx) => {
              const sev = adv.severity || 'info';
              const isWhyOpen = !!expandedWhyIds[adv.rule_id || String(idx)];

              return (
                <div key={adv.rule_id || idx} className={`km-adv-card km-adv-${sev}`}>
                  <div className="km-adv-header">
                    <div className="km-adv-badge-wrap">
                      <span className={`km-sev-badge km-sev-${sev}`}>
                        {sev === 'warning' ? <AlertTriangle size={14} /> : sev === 'watch' ? <ShieldAlert size={14} /> : <Info size={14} />}
                        {t.advisories_page?.[`sev_${sev}`] || sev.toUpperCase()}
                      </span>
                      <strong className="km-adv-title">{adv.title}</strong>
                    </div>
                    <span className="km-adv-unc-tag">{t.point_query?.uncertainty || 'Uncertainty'}: {t.confidence?.[adv.confidence] || adv.confidence || uncLabel}</span>
                  </div>

                  <p className="km-adv-message">{adv.message}</p>

                  <div className="km-adv-actions">
                    <button
                      type="button"
                      className="km-adv-why-btn"
                      onClick={() => toggleWhy(adv.rule_id || String(idx))}
                      aria-expanded={isWhyOpen}
                    >
                      <HelpCircle size={14} />
                      <span>{f.why_recommendation || f.why_rule || 'Why this recommendation?'}</span>
                      {isWhyOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  </div>

                  {isWhyOpen && (
                    <div className="km-adv-why-drawer">
                      <div className="km-why-row">
                        <span>{f.trigger_rule || 'Trigger Rule:'}</span>
                        <code>{adv.rule_id}</code>
                      </div>
                      <div className="km-why-row">
                        <span>{f.crop_stage_context || 'Crop & Stage:'}</span>
                        <strong>{adv.crop || selectedCrop} ({adv.stage || activeStage})</strong>
                      </div>
                      {adv.trigger_inputs && (
                        <div className="km-why-inputs">
                          <span>{f.evaluated_inputs || 'Evaluated Weather Inputs:'}</span>
                          <pre>{JSON.stringify(adv.trigger_inputs, null, 2)}</pre>
                        </div>
                      )}
                      <p className="km-why-disclaimer">{adv.disclaimer || 'Meteorological advisory guidance generated by rule engine. Verify local conditions before field interventions.'}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 5-Day Weather Trend Visualization */}
      <div className="km-trend-toggle-box">
        <button
          type="button"
          className="km-btn km-btn-outline km-btn-sm"
          onClick={() => setShowTrendChart(!showTrendChart)}
        >
          <TrendingUp size={16} />
          <span>{showTrendChart ? (f.hide_trend || 'Hide 5-Day Weather Trend Chart') : (f.show_trend || 'Show 5-Day Weather Trend Chart')}</span>
          {showTrendChart ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {showTrendChart && strip.length > 0 && (
        <div className="km-farmer-trend-card">
          <FarmerTrendChart stripData={strip} lang={lang} />
        </div>
      )}

      {/* Officer Specific Detailed Metrics Breakdown */}
      {userView === 'officer' && (
        <div className="km-officer-section">
          <div className="km-section-header">
            <h3 className="km-section-title">{f.downscaling_breakdown || 'Downscaling Model Breakdown'}</h3>
            <span className="km-badge km-badge-calibrated">LightGBM v2.0</span>
          </div>

          <div className="km-metrics-grid">
            <div className="km-metric-box">
              <span className="km-metric-label">{f.ml_estimate || 'KrishiMitra ML'}</span>
              <strong className="km-metric-val">{displayVal.toFixed(1)} {prediction.unit || 'mm'}</strong>
              <span className="km-metric-sub">{f.panchayat_local || 'Panchayat Local'}</span>
            </div>

            <div className="km-metric-box">
              <span className="km-metric-label">{f.block_baseline || 'Block Coarse Baseline'}</span>
              <strong className="km-metric-val">{coarseVal.toFixed(1)} {prediction.unit || 'mm'}</strong>
              <span className="km-metric-sub">{f.block_avg || 'Block Average'}</span>
            </div>

            <div className="km-metric-box">
              <span className="km-metric-label">{f.spatial_difference || 'Spatial Difference'}</span>
              <strong className={`km-metric-val ${diffVal >= 0 ? 'km-val-pos' : 'km-val-neg'}`}>
                {diffVal > 0 ? `+${diffVal.toFixed(1)}` : diffVal.toFixed(1)} {prediction.unit || 'mm'}
              </strong>
              <span className="km-metric-sub">{f.ml_minus_baseline || 'ML − Baseline'}</span>
            </div>

            <div className="km-metric-box">
              <span className="km-metric-label">{f.interval_80 || '80% Interval (P10–P90)'}</span>
              <strong className="km-metric-val">
                {prediction.uncertainty_interval?.p10?.toFixed(1) ?? '0.0'} – {prediction.uncertainty_interval?.p90?.toFixed(1) ?? '0.0'}
              </strong>
              <span className="km-metric-sub">{f.calibrated_interval || 'Calibrated Interval'}</span>
            </div>
          </div>

          {/* Model Explanation Feature Contributions */}
          <div className="km-officer-actions">
            <button
              type="button"
              className="km-btn km-btn-outline km-btn-sm"
              onClick={() => setShowExplain(!showExplain)}
            >
              <Layers size={15} />
              <span>{showExplain ? (f.hide_shap || 'Hide Feature Attribution') : (f.view_shap || 'View Feature Attribution (SHAP)')}</span>
            </button>

            <button
              type="button"
              className="km-btn km-btn-primary km-btn-sm"
              onClick={onOpenBulletin}
            >
              <Printer size={15} />
              <span>{f.print_bulletin_btn || 'Print 1-Page Agromet Bulletin'}</span>
            </button>
          </div>

          {showExplain && explanation && (
            <div className="km-explain-box">
              <h4>Local Feature Contributions vs Block Baseline:</h4>
              <div className="km-contrib-table">
                {explanation.contributions.map((c, i) => (
                  <div key={i} className="km-contrib-row">
                    <span className="km-contrib-label">{c.label} ({c.value} {c.unit})</span>
                    <span className={`km-contrib-val km-contrib-${c.impact}`}>
                      {c.contribution > 0 ? `+${c.contribution.toFixed(2)}` : c.contribution.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Footer Utilities */}
      <div className="km-fc-footer">
        <button
          type="button"
          className="km-btn km-btn-outline km-btn-sm km-sms-btn"
          onClick={handleCopySMS}
        >
          {smsCopied ? <Check size={16} className="km-text-success" /> : <Copy size={16} />}
          <span>{smsCopied ? (f.sms_copied || 'SMS Copied to Clipboard!') : (f.copy_sms_btn || 'Copy Farmer SMS Advisory')}</span>
        </button>

        <button
          type="button"
          className="km-btn km-btn-ghost km-btn-sm"
          onClick={onOpenBulletin}
          title="Open printable bulletin"
        >
          <FileText size={16} />
          <span>{f.bulletin_btn || 'Agromet Bulletin'}</span>
        </button>
      </div>
    </div>
  );
};
