import React, { useState } from 'react';
import { X, Crosshair, MapPin, AlertTriangle, ArrowRight } from 'lucide-react';
import { postOnDemandPrediction } from '../services/api';
import type { PredictionResponse } from '../types/api';

interface OnDemandModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultDate: string;
}

export const OnDemandModal: React.FC<OnDemandModalProps> = ({ isOpen, onClose, defaultDate }) => {
  const [lat, setLat] = useState<string>('13.3400');
  const [lon, setLon] = useState<string>('77.1000');
  const [variable, setVariable] = useState<string>('rainfall');
  const [date, setDate] = useState<string>(defaultDate);
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<PredictionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const data = await postOnDemandPrediction(parseFloat(lat), parseFloat(lon), variable, date);
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'On-demand prediction failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content on-demand-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-row">
            <Crosshair size={22} className="text-cyan" />
            <div>
              <h2>On-Demand Coordinate Inference</h2>
              <p>Query any location in the region — automatically snapped to the nearest panchayat/grid cell</p>
            </div>
          </div>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          <form onSubmit={handleQuery} className="on-demand-form">
            <div className="form-grid">
              <div className="form-group">
                <label>Latitude (°N)</label>
                <input
                  type="number"
                  step="0.0001"
                  required
                  className="input-field"
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                  placeholder="e.g. 13.3400"
                />
              </div>

              <div className="form-group">
                <label>Longitude (°E)</label>
                <input
                  type="number"
                  step="0.0001"
                  required
                  className="input-field"
                  value={lon}
                  onChange={(e) => setLon(e.target.value)}
                  placeholder="e.g. 77.1000"
                />
              </div>

              <div className="form-group">
                <label>Weather Variable</label>
                <select
                  className="input-field"
                  value={variable}
                  onChange={(e) => setVariable(e.target.value)}
                >
                  <option value="rainfall">Rainfall (mm)</option>
                  <option value="temperature_max">Max Temperature (°C)</option>
                  <option value="temperature_min">Min Temperature (°C)</option>
                </select>
              </div>

              <div className="form-group">
                <label>Target Date</label>
                <input
                  type="date"
                  required
                  className="input-field"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
            </div>

            <div className="form-actions">
              <button type="submit" className="submit-btn" disabled={loading}>
                {loading ? 'Running ML Inference...' : 'Run Local Downscaling'}
                <ArrowRight size={16} />
              </button>
            </div>
          </form>

          {error && (
            <div className="error-box">
              <AlertTriangle size={18} />
              <span>{error}</span>
            </div>
          )}

          {result && (
            <div className="result-card">
              <div className="result-header">
                <MapPin size={18} className="text-emerald" />
                <span>
                  Snapped to <strong>{result.snapped_grid_id}</strong> (Offset: {result.snap_distance_km} km)
                </span>
              </div>

              <div className="result-metric-row">
                <div className="result-metric-col">
                  <span>Downscaled Prediction</span>
                  <h2>{result.prediction}</h2>
                </div>
                <div className="result-metric-col">
                  <span>Coarse Baseline</span>
                  <h3>{result.coarse_reference.value}</h3>
                </div>
                <div className="result-metric-col">
                  <span>Uncertainty</span>
                  <span className={`pill pill-${result.uncertainty_label}`}>
                    {result.uncertainty_label.toUpperCase()}
                  </span>
                </div>
              </div>

              <div className="result-quantiles">
                <span>Quantile Range: <strong>p10: {result.uncertainty_interval.p10}</strong> | <strong>p50: {result.uncertainty_interval.p50}</strong> | <strong>p90: {result.uncertainty_interval.p90}</strong></span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
