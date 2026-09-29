import React, { useState } from 'react';
import { X, Crosshair, MapPin, AlertTriangle, ArrowRight, Navigation, Globe } from 'lucide-react';
import { postOnDemandPrediction } from '../services/api';
import type { PredictionResponse } from '../types/api';
import { getTranslation, type SupportedLanguage } from '../i18n';

interface OnDemandModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultDate: string;
  lang?: SupportedLanguage;
  onViewOnMap?: (lat: number, lon: number, locationId?: string) => void;
}

export const OnDemandModal: React.FC<OnDemandModalProps> = ({
  isOpen,
  onClose,
  defaultDate,
  lang = 'en',
  onViewOnMap
}) => {
  const [lat, setLat] = useState<string>('13.3400');
  const [lon, setLon] = useState<string>('77.1000');
  const [variable, setVariable] = useState<string>('rainfall');
  const [date, setDate] = useState<string>(defaultDate || '2026-05-15');
  const [loading, setLoading] = useState<boolean>(false);
  const [locating, setLocating] = useState<boolean>(false);
  const [result, setResult] = useState<PredictionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const t = getTranslation(lang);
  const pq = t.point_query || {};

  if (!isOpen) return null;

  const handleUseMyLocation = () => {
    setError(null);
    if (!navigator.geolocation) {
      setError(pq.location_denied || 'Geolocation is not supported by your browser.');
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        setLat(position.coords.latitude.toFixed(4));
        setLon(position.coords.longitude.toFixed(4));
      },
      (geoError) => {
        setLocating(false);
        console.warn('Geolocation error:', geoError);
        setError(pq.location_denied || 'Location access was not granted. Please enter coordinates manually.');
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  };

  const handleQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);

    const latNum = parseFloat(lat);
    const lonNum = parseFloat(lon);

    if (isNaN(latNum) || latNum < 6 || latNum > 38) {
      setError('Please enter a valid Latitude between 6°N and 38°N');
      return;
    }
    if (isNaN(lonNum) || lonNum < 68 || lonNum > 98) {
      setError('Please enter a valid Longitude between 68°E and 98°E');
      return;
    }

    setLoading(true);
    try {
      const data = await postOnDemandPrediction(latNum, lonNum, variable, date);
      setResult(data);
    } catch (err: any) {
      const msg = err.message || 'On-demand coordinate prediction failed.';
      if (msg.includes('outside pilot') || msg.includes('outside_pilot_area')) {
        setError(pq.outside_pilot || 'Coordinates are outside active pilot regions (Tumakuru, Ratnagiri, Ludhiana, Jodhpur).');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleViewOnMap = () => {
    if (onViewOnMap && result) {
      onViewOnMap(parseFloat(lat), parseFloat(lon), result.snapped_grid_id || result.location_id);
      onClose();
    } else {
      onClose();
    }
  };

  return (
    <div className="km-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="km-modal-card km-point-query-modal" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="km-modal-header">
          <div className="km-modal-title-wrap">
            <div className="km-modal-icon-badge">
              <Crosshair size={22} className="km-text-brand" />
            </div>
            <div>
              <h2 className="km-modal-title">{pq.modal_title || 'On-Demand Local Weather Query'}</h2>
              <p className="km-modal-subtitle">
                {pq.modal_subtitle || 'Enter any coordinate to estimate panchayat-level weather conditions.'}
              </p>
            </div>
          </div>
          <button className="km-modal-close-btn" onClick={onClose} aria-label="Close modal">
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="km-modal-body">
          <form onSubmit={handleQuery} className="km-point-query-form">
            <div className="km-form-grid-2">
              <div className="km-form-field">
                <label htmlFor="pq-lat" className="km-form-label">{pq.lat_label || 'Latitude (°N)'}</label>
                <div className="km-input-wrap">
                  <input
                    id="pq-lat"
                    type="number"
                    step="0.0001"
                    required
                    className="km-input"
                    value={lat}
                    onChange={(e) => setLat(e.target.value)}
                    placeholder="e.g. 13.3400"
                  />
                </div>
              </div>

              <div className="km-form-field">
                <label htmlFor="pq-lon" className="km-form-label">{pq.lon_label || 'Longitude (°E)'}</label>
                <div className="km-input-wrap">
                  <input
                    id="pq-lon"
                    type="number"
                    step="0.0001"
                    required
                    className="km-input"
                    value={lon}
                    onChange={(e) => setLon(e.target.value)}
                    placeholder="e.g. 77.1000"
                  />
                </div>
              </div>

              <div className="km-form-field">
                <label htmlFor="pq-var" className="km-form-label">{pq.variable_label || 'Weather Variable'}</label>
                <select
                  id="pq-var"
                  className="km-select"
                  value={variable}
                  onChange={(e) => setVariable(e.target.value)}
                >
                  <option value="rainfall">Rainfall (mm)</option>
                  <option value="temperature_max">Max Temperature (°C)</option>
                  <option value="temperature_min">Min Temperature (°C)</option>
                </select>
              </div>

              <div className="km-form-field">
                <label htmlFor="pq-date" className="km-form-label">{pq.date_label || 'Target Date'}</label>
                <input
                  id="pq-date"
                  type="date"
                  required
                  className="km-input"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
            </div>

            {/* Form Actions */}
            <div className="km-point-query-actions">
              <button
                type="button"
                className="km-btn km-btn-outline km-btn-sm km-geo-btn"
                onClick={handleUseMyLocation}
                disabled={locating}
              >
                <Navigation size={15} className={locating ? 'km-animate-spin' : ''} />
                <span>{locating ? (pq.location_detecting || 'Locating...') : (pq.use_my_location || 'Use My Location')}</span>
              </button>

              <button
                type="submit"
                className="km-btn km-btn-primary km-btn-downscaling"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="km-spinner-inline" />
                    <span>{pq.running_inference || 'Running ML Inference...'}</span>
                  </>
                ) : (
                  <>
                    <span>{pq.run_inference || 'Run Local Downscaling'}</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Error Message */}
          {error && (
            <div className="km-alert km-alert-error" role="alert">
              <AlertTriangle size={18} className="km-alert-icon" />
              <div className="km-alert-text">{error}</div>
            </div>
          )}

          {/* Result Card */}
          {result && (
            <div className="km-pq-result-card">
              <div className="km-pq-result-header">
                <div className="km-pq-location-snap">
                  <MapPin size={18} className="km-text-success" />
                  <span>
                    {pq.snapped_panchayat || 'Snapped to'}: <strong>{result.location_name || result.snapped_grid_id}</strong>
                    {result.snap_distance_km !== undefined && (
                      <span className="km-text-muted"> ({pq.offset_distance || 'Offset'}: {result.snap_distance_km} km)</span>
                    )}
                  </span>
                </div>
                <span className={`km-status-pill km-pill-${result.uncertainty_label}`}>
                  {result.uncertainty_label.toUpperCase()}
                </span>
              </div>

              <div className="km-pq-metrics-grid">
                <div className="km-pq-metric-box km-box-highlight">
                  <div className="km-pq-metric-label">{pq.downscaled_pred || 'Local Estimate (ML)'}</div>
                  <div className="km-pq-metric-val">{result.prediction} <span className="km-unit">{result.unit}</span></div>
                </div>

                <div className="km-pq-metric-box">
                  <div className="km-pq-metric-label">{pq.coarse_base || 'Baseline (Block NWP)'}</div>
                  <div className="km-pq-metric-val">{result.coarse_reference.value} <span className="km-unit">{result.unit}</span></div>
                </div>

                <div className="km-pq-metric-box">
                  <div className="km-pq-metric-label">{pq.difference || 'Difference'}</div>
                  <div className={`km-pq-metric-val ${result.prediction > result.coarse_reference.value ? 'km-val-pos' : 'km-val-neg'}`}>
                    {(result.prediction - result.coarse_reference.value) > 0 ? '+' : ''}
                    {(result.prediction - result.coarse_reference.value).toFixed(1)} <span className="km-unit">{result.unit}</span>
                  </div>
                </div>
              </div>

              {result.uncertainty_interval && (
                <div className="km-pq-quantiles-row">
                  <span className="km-pq-quantile-label">{pq.quantiles_label || 'Quantile Range'}:</span>
                  <span className="km-badge km-badge-sm">P10: {result.uncertainty_interval.p10} {result.unit}</span>
                  <span className="km-badge km-badge-sm km-badge-brand">P50: {result.uncertainty_interval.p50} {result.unit}</span>
                  <span className="km-badge km-badge-sm">P90: {result.uncertainty_interval.p90} {result.unit}</span>
                </div>
              )}

              <div className="km-pq-footer-actions">
                <button
                  type="button"
                  className="km-btn km-btn-secondary km-btn-sm"
                  onClick={handleViewOnMap}
                >
                  <Globe size={15} />
                  <span>{pq.view_on_map || 'View on Map'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
