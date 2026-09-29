import React, { useState, useEffect } from 'react';
import { AlertCircle } from 'lucide-react';
import { fetchMetrics, fetchRegionDetail } from '../services/api';
import type { RegionDetail } from '../types/api';

interface MethodPageProps {
  currentRegionId: string;
}

export const MethodPage: React.FC<MethodPageProps> = ({ currentRegionId }) => {
  const [metrics, setMetrics] = useState<any>(null);
  const [region, setRegion] = useState<RegionDetail | null>(null);

  useEffect(() => {
    fetchMetrics(currentRegionId).then(setMetrics).catch(console.error);
    fetchRegionDetail(currentRegionId).then(setRegion).catch(console.error);
  }, [currentRegionId]);

  return (
    <div className="km-page km-method-page">
      <div className="km-container km-page-header">
        <div>
          <h2 className="km-page-title">Methodology, Provenance & Scientific Disclosure</h2>
          <p className="km-page-sub">
            Complete transparency on modeling architecture, spatial evaluation holdouts, data provenance, and operational boundaries.
          </p>
        </div>
      </div>

      {/* 1. Architecture Pipeline Diagram (Inline SVG) */}
      <div className="km-container km-method-section">
        <h3 className="km-section-title">1. End-to-End System Architecture</h3>
        <p className="km-section-text">
          KrishiMitra bridges coarse numerical weather forecasts (10–25 km) down to panchayat agro-climatic terrain 
          features using gradient boosted quantile decision trees and two-stage hurdle classification.
        </p>

        <div className="km-diagram-container">
          <svg
            viewBox="0 0 980 220"
            className="km-pipeline-svg"
            xmlns="http://www.w3.org/2000/svg"
            role="img"
            aria-label="KrishiMitra Machine Learning Architecture Pipeline Diagram"
          >
            <defs>
              <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 1 L 8 5 L 0 9 z" fill="#2F6B3B" />
              </marker>
            </defs>

            {/* Stage 1: Coarse Inputs */}
            <rect x="20" y="30" width="160" height="150" rx="8" fill="#F3EEE2" stroke="#C9BFA6" strokeWidth="2" />
            <text x="100" y="58" textAnchor="middle" fontWeight="600" fill="#1F2A22" fontSize="14">Coarse NWP Input</text>
            <text x="100" y="85" textAnchor="middle" fill="#4A5650" fontSize="12">10-25 km Grids</text>
            <text x="100" y="105" textAnchor="middle" fill="#4A5650" fontSize="12">• Coarse Rain & Temp</text>
            <text x="100" y="125" textAnchor="middle" fill="#4A5650" fontSize="12">• Climatology Normals</text>
            <text x="100" y="145" textAnchor="middle" fill="#4A5650" fontSize="12">• Atmospheric Pressure</text>

            <line x1="180" y1="105" x2="220" y2="105" stroke="#2F6B3B" strokeWidth="2" markerEnd="url(#arrow)" />

            {/* Stage 2: Spatial Feature Store */}
            <rect x="225" y="30" width="165" height="150" rx="8" fill="#FAF7F0" stroke="#2F6B3B" strokeWidth="2" />
            <text x="307" y="58" textAnchor="middle" fontWeight="600" fill="#1F4D2A" fontSize="14">Spatial Feature Store</text>
            <text x="307" y="85" textAnchor="middle" fill="#4A5650" fontSize="12">Panchayat Terrain</text>
            <text x="307" y="105" textAnchor="middle" fill="#4A5650" fontSize="12">• Elevation (DEM)</text>
            <text x="307" y="125" textAnchor="middle" fill="#4A5650" fontSize="12">• Slope & Aspect</text>
            <text x="307" y="145" textAnchor="middle" fill="#4A5650" fontSize="12">• Soil Texture & Land Use</text>

            <line x1="390" y1="105" x2="430" y2="105" stroke="#2F6B3B" strokeWidth="2" markerEnd="url(#arrow)" />

            {/* Stage 3: ML Engine */}
            <rect x="435" y="30" width="180" height="150" rx="8" fill="#E3EFE4" stroke="#2F6B3B" strokeWidth="2.5" />
            <text x="525" y="58" textAnchor="middle" fontWeight="600" fill="#1F4D2A" fontSize="14">LightGBM Hurdle & Quantile</text>
            <text x="525" y="85" textAnchor="middle" fill="#1F2A22" fontSize="12">Stage 1: Rain Classifier</text>
            <text x="525" y="105" textAnchor="middle" fill="#4A5650" fontSize="11">(Isotonic Calibrated Prob)</text>
            <text x="525" y="128" textAnchor="middle" fill="#1F2A22" fontSize="12">Stage 2: Quantile Regressors</text>
            <text x="525" y="148" textAnchor="middle" fill="#4A5650" fontSize="11">(P10, P50, P90 conditional)</text>

            <line x1="615" y1="105" x2="655" y2="105" stroke="#2F6B3B" strokeWidth="2" markerEnd="url(#arrow)" />

            {/* Stage 4: Uncertainty & Advisories */}
            <rect x="660" y="30" width="160" height="150" rx="8" fill="#F3EEE2" stroke="#B27A12" strokeWidth="2" />
            <text x="740" y="58" textAnchor="middle" fontWeight="600" fill="#7A5A3A" fontSize="14">Advisory Engine</text>
            <text x="740" y="85" textAnchor="middle" fill="#4A5650" fontSize="12">Decoupled Rules</text>
            <text x="740" y="105" textAnchor="middle" fill="#4A5650" fontSize="12">• Crop Phenology</text>
            <text x="740" y="125" textAnchor="middle" fill="#4A5650" fontSize="12">• Severity Downgrades</text>
            <text x="740" y="145" textAnchor="middle" fill="#4A5650" fontSize="12">• Trigger Explainability</text>

            <line x1="820" y1="105" x2="855" y2="105" stroke="#2F6B3B" strokeWidth="2" markerEnd="url(#arrow)" />

            {/* Stage 5: Outputs */}
            <rect x="860" y="30" width="105" height="150" rx="8" fill="#FFFFFF" stroke="#1F2A22" strokeWidth="2" />
            <text x="912" y="58" textAnchor="middle" fontWeight="600" fill="#1F2A22" fontSize="13">Delivery</text>
            <text x="912" y="88" textAnchor="middle" fill="#4A5650" fontSize="11">Farmer UI</text>
            <text x="912" y="110" textAnchor="middle" fill="#4A5650" fontSize="11">Officer GIS</text>
            <text x="912" y="132" textAnchor="middle" fill="#4A5650" fontSize="11">Bulletin PDF</text>
            <text x="912" y="154" textAnchor="middle" fill="#4A5650" fontSize="11">SMS Copy</text>
          </svg>
        </div>
      </div>

      {/* 2. Real vs Synthetic Data Matrix */}
      <div className="km-container km-method-section">
        <h3 className="km-section-title">2. Data Provenance & Real vs Synthetic Matrix</h3>
        <p className="km-section-text">
          Every layer and metric in KrishiMitra carries explicit provenance metadata. We never misrepresent 
          synthetic or calibrated data as live field observations.
        </p>

        <div className="km-table-container">
          <table className="km-table">
            <thead>
              <tr>
                <th>Component</th>
                <th>Classification</th>
                <th>Source & Citation</th>
                <th>Licence / Status</th>
                <th>Operational Note</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>District Boundary</strong></td>
                <td><span className="km-status-pill km-pill-ok">Real</span></td>
                <td>geoBoundaries ADM2 / Official Survey</td>
                <td>CC BY 4.0 Open Access</td>
                <td>Accurate official district administrative boundary outline.</td>
              </tr>
              <tr>
                <td><strong>Sub-District (Panchayats)</strong></td>
                <td><span className="km-status-pill km-pill-warn">Illustrative</span></td>
                <td>Seeded Voronoi Tessellation</td>
                <td>Algorithmic Geometry</td>
                <td>Panchayat polygons are illustrative Voronoi partitions inside the district outline.</td>
              </tr>
              <tr>
                <td><strong>Elevation & Terrain</strong></td>
                <td><span className="km-status-pill km-pill-ok">Real / Calibrated</span></td>
                <td>SRTM DEM / Synthetic Relief Generator</td>
                <td>Public Domain</td>
                <td>Provides topographic lapse-rate adjustments and slope factors.</td>
              </tr>
              <tr>
                <td><strong>Meteorological Weather</strong></td>
                <td><span className="km-status-pill km-pill-info">Calibrated Synthetic</span></td>
                <td>NASA POWER / IMD Monthly Climatology Normals</td>
                <td>Synthetic Simulation</td>
                <td>Simulates synoptic monsoon convective rainfall cells, heatwaves, and cold snaps.</td>
              </tr>
              <tr>
                <td><strong>Crop Rules & Thresholds</strong></td>
                <td><span className="km-status-pill km-pill-warn">Illustrative Rules</span></td>
                <td>ICAR / KVK Advisory Guidelines Reference</td>
                <td>Domain Architecture</td>
                <td>Rules are illustrative templates requiring local KVK validation prior to live deployment.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. ML Architecture & Hurdle Formulation */}
      <div className="km-container km-method-section">
        <h3 className="km-section-title">3. Hurdle Model Formulation for Rainfall</h3>
        <p className="km-section-text">
          Rainfall is zero-inflated with extreme positive skewness. Direct regression models often produce 
          chronic drizzle or fail on convective storms. KrishiMitra implements a decoupled two-stage Hurdle formulation:
        </p>
        <div className="km-formula-card">
          <div className="km-formula-row">
            <strong>Stage 1 (Occurrence):</strong> 
            <code>P(Rain &ge; 1.0mm) = Isotonic(LightGBM_Classifier(X))</code>
          </div>
          <div className="km-formula-row">
            <strong>Stage 2 (Amount if Wet):</strong> 
            <code>Q_&tau;(Rain | Rain &ge; 1.0mm) = LightGBM_Quantile_&tau;(X_wet), &tau; &in; &#123;0.1, 0.5, 0.9&#125;</code>
          </div>
          <div className="km-formula-row">
            <strong>Expectation:</strong> 
            <code>E[Rain] = P(Rain) &times; Q_0.5(Rain | Rain &ge; 1.0mm)</code>
          </div>
        </div>
      </div>

      {/* 4. Spatial Holdout & No-Leakage Verification */}
      <div className="km-container km-method-section">
        <h3 className="km-section-title">4. Strict Spatial Holdout Protocol</h3>
        <p className="km-section-text">
          Standard random train/test row splitting causes severe spatial data leakage in geospatial machine learning. 
          KrishiMitra mandates strict panchayat-level spatial holdouts:
        </p>
        <ul className="km-bullet-list">
          <li>
            <strong>Held-Out Test Locations:</strong> 23 panchayats in Tumakuru (and corresponding test clusters in other regions) 
            are strictly withheld from model training and hyperparameter tuning.
          </li>
          <li>
            <strong>Identical Evaluation Split:</strong> Baseline block coarse forecasts and ML downscaling are evaluated on the exact 
            same test locations.
          </li>
          <li>
            <strong>Conformal Quantile Calibration:</strong> An independent 20% spatial calibration split calibrates prediction interval 
            widths ensuring valid 80% coverage.
          </li>
        </ul>
      </div>

      {/* 5. Known Limitations & Responsible AI */}
      <div className="km-container km-method-section">
        <h3 className="km-section-title">5. Known Limitations & Boundary Conditions</h3>
        <div className="km-limitations-grid">
          <div className="km-limitation-card">
            <AlertCircle size={20} className="km-text-warn" />
            <div>
              <strong>Synthetic-World Skill Caveat</strong>
              <p>
                Metrics reported reflect performance against a physics-calibrated synthetic simulator. 
                Real-world skill requires ground-truth AWS/ARG observation telemetry ingestion.
              </p>
            </div>
          </div>

          <div className="km-limitation-card">
            <AlertCircle size={20} className="km-text-warn" />
            <div>
              <strong>Resolution Integrity</strong>
              <p>
                KrishiMitra operates at the <strong>panchayat administrative level</strong>. We do not claim 1 km 
                pixel or farm plot-level resolution.
              </p>
            </div>
          </div>

          <div className="km-limitation-card">
            <AlertCircle size={20} className="km-text-warn" />
            <div>
              <strong>Institutional Advisory Validation</strong>
              <p>
                All agricultural spray, sowing, and drainage rules are illustrative prototypes and must be formally 
                reviewed with local Krishi Vigyan Kendras (KVKs).
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 6. Model Artifact Metadata & Provenance */}
      {metrics && (
        <div className="km-container km-method-section">
          <h3 className="km-section-title">6. Model Artifact Versioning ({currentRegionId})</h3>
          <div className="km-artifact-metadata-box">
            <div><strong>Region & Zone:</strong> {region?.district} ({region?.agro_climatic_zone || 'Semi-Arid'})</div>
            <div><strong>Model Version:</strong> {metrics.model_version || '2.0.0-calibrated'}</div>
            <div><strong>Training Seed:</strong> 42 (Deterministic)</div>
            <div><strong>Framework:</strong> LightGBM 4.6.0 (CPU threads limited to n_jobs=2)</div>
            <div><strong>Caveat Note:</strong> {metrics.note || 'Synthetic-world result; spatial holdout evaluated.'}</div>
          </div>
        </div>
      )}
    </div>
  );
};
