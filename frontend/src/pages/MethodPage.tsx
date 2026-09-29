import React, { useState, useEffect } from 'react';
import {
  CloudSun,
  Mountain,
  Cpu,
  MapPin,
  ShieldCheck,
  Sprout,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Layers,
  CheckCircle2
} from 'lucide-react';
import { fetchMetrics, fetchRegionDetail } from '../services/api';
import type { RegionDetail } from '../types/api';
import { getTranslation, type SupportedLanguage } from '../i18n';

interface MethodPageProps {
  currentRegionId: string;
  lang?: SupportedLanguage;
}

export const MethodPage: React.FC<MethodPageProps> = ({ currentRegionId, lang = 'en' }) => {
  const [metrics, setMetrics] = useState<any>(null);
  const [region, setRegion] = useState<RegionDetail | null>(null);
  const [activeStep, setActiveStep] = useState<number>(1);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    arch: true,
    hurdle: false,
    holdout: false,
    quantile: false,
    provenance: false,
    artifacts: false
  });

  const t = getTranslation(lang);
  const m = t.methodology || {};

  useEffect(() => {
    fetchMetrics(currentRegionId).then(setMetrics).catch(console.error);
    fetchRegionDetail(currentRegionId).then(setRegion).catch(console.error);
  }, [currentRegionId]);

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const pipelineSteps = [
    {
      id: 1,
      icon: CloudSun,
      title: m.step_1_title || '1. Weather Forecast',
      subtitle: 'Coarse NWP Input (10-25 km)',
      desc: m.step_1_desc || 'Regional numerical weather predictions (rainfall, temperature, pressure, climatology normals).'
    },
    {
      id: 2,
      icon: Mountain,
      title: m.step_2_title || '2. Local Features',
      subtitle: 'High-Res Terrain & LULC',
      desc: m.step_2_desc || 'SRTM DEM elevation, slope, aspect, and soil texture capture microclimate influences.'
    },
    {
      id: 3,
      icon: Cpu,
      title: m.step_3_title || '3. AI Downscaling',
      subtitle: 'LightGBM Multi-Model',
      desc: m.step_3_desc || 'Decoupled hurdle occurrence classifier and quantile gradient-boosted decision trees.'
    },
    {
      id: 4,
      icon: MapPin,
      title: m.step_4_title || '4. Panchayat Forecast',
      subtitle: 'Localized Estimates',
      desc: m.step_4_desc || 'Panchayat-level downscaled rainfall and max/min temperature with P10/P50/P90 distributions.'
    },
    {
      id: 5,
      icon: ShieldCheck,
      title: m.step_5_title || '5. Uncertainty',
      subtitle: 'Conformal Calibration',
      desc: m.step_5_desc || 'Spatial conformal calibration guarantees valid 80% coverage intervals without overconfidence.'
    },
    {
      id: 6,
      icon: Sprout,
      title: m.step_6_title || '6. Crop Advisory',
      subtitle: 'Actionable Rules',
      desc: m.step_6_desc || 'Phenological stage-aware rules provide operations-ready spray, irrigation, and harvest advisories.'
    }
  ];

  return (
    <div className="km-page km-method-page">
      {/* Page Header */}
      <div className="km-container km-page-header">
        <div className="km-method-header-box">
          <div className="km-method-header-badge">
            <Layers size={16} className="km-text-brand" />
            <span>Operational & Scientific Transparency</span>
          </div>
          <h1 className="km-page-title">{m.title || 'Methodology, Provenance & Scientific Disclosure'}</h1>
          <p className="km-page-sub">
            {m.subtitle || 'Complete transparency on modeling architecture, spatial evaluation holdouts, data provenance, and operational boundaries.'}
          </p>
        </div>
      </div>

      {/* ============================================================ */}
      {/* LEVEL 1: HOW KRISHIMITRA WORKS (Visual Interactive Pipeline) */}
      {/* ============================================================ */}
      <div className="km-container km-method-pipeline-section">
        <div className="km-pipeline-header">
          <div>
            <h2 className="km-pipeline-heading">{m.pipeline_title || 'How KrishiMitra Works (6-Stage Pipeline)'}</h2>
            <p className="km-pipeline-sub">{m.pipeline_desc || 'End-to-end flow from regional numerical forecasts to panchayat-specific agricultural recommendations.'}</p>
          </div>
        </div>

        {/* 6 Visual Cards Pipeline Grid */}
        <div className="km-pipeline-cards-grid">
          {pipelineSteps.map((step, idx) => {
            const Icon = step.icon;
            const isActive = activeStep === step.id;
            return (
              <div
                key={step.id}
                className={`km-pipeline-card ${isActive ? 'km-card-active' : ''}`}
                onClick={() => setActiveStep(step.id)}
              >
                <div className="km-pipeline-card-top">
                  <div className="km-pipeline-step-badge">{step.id}</div>
                  <div className="km-pipeline-icon-circle">
                    <Icon size={24} className="km-pipeline-icon" />
                  </div>
                </div>
                <h3 className="km-pipeline-card-title">{step.title}</h3>
                <div className="km-pipeline-card-subtitle">{step.subtitle}</div>
                <p className="km-pipeline-card-desc">{step.desc}</p>
                {idx < pipelineSteps.length - 1 && (
                  <div className="km-pipeline-arrow-indicator" aria-hidden="true">→</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ============================================================ */}
      {/* LEVEL 2: TECHNICAL SPECIFICATIONS (Collapsible Accordions)    */}
      {/* ============================================================ */}
      <div className="km-container km-technical-sections">
        <div className="km-tech-header">
          <h2 className="km-tech-heading">{m.tech_details_title || 'Technical Modeling Specifications'}</h2>
          <p className="km-tech-sub">Expand any section below for rigorous mathematical formulations, spatial verification holdouts, and provenance metadata.</p>
        </div>

        {/* Accordion 1: Architecture & NWP Integration */}
        <div className="km-accordion-card">
          <button
            type="button"
            className="km-accordion-header"
            onClick={() => toggleSection('arch')}
            aria-expanded={openSections.arch}
          >
            <div className="km-accordion-title-row">
              <span className="km-tech-badge">1</span>
              <span className="km-accordion-title">{m.arch_title || '1. End-to-End System Architecture'}</span>
            </div>
            {openSections.arch ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>
          {openSections.arch && (
            <div className="km-accordion-body">
              <p className="km-section-text">
                {m.arch_body || 'KrishiMitra bridges coarse numerical weather forecasts (10–25 km) down to panchayat agro-climatic terrain features using gradient boosted quantile decision trees and two-stage hurdle classification.'}
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

                  {/* Stage 1 */}
                  <rect x="20" y="30" width="160" height="150" rx="8" fill="#F3EEE2" stroke="#C9BFA6" strokeWidth="2" />
                  <text x="100" y="58" textAnchor="middle" fontWeight="600" fill="#1F2A22" fontSize="14">Coarse NWP Input</text>
                  <text x="100" y="85" textAnchor="middle" fill="#4A5650" fontSize="12">10-25 km Grids</text>
                  <text x="100" y="105" textAnchor="middle" fill="#4A5650" fontSize="12">• Coarse Rain & Temp</text>
                  <text x="100" y="125" textAnchor="middle" fill="#4A5650" fontSize="12">• Climatology Normals</text>
                  <text x="100" y="145" textAnchor="middle" fill="#4A5650" fontSize="12">• Atmospheric Pressure</text>

                  <line x1="180" y1="105" x2="220" y2="105" stroke="#2F6B3B" strokeWidth="2" markerEnd="url(#arrow)" />

                  {/* Stage 2 */}
                  <rect x="225" y="30" width="165" height="150" rx="8" fill="#FAF7F0" stroke="#2F6B3B" strokeWidth="2" />
                  <text x="307" y="58" textAnchor="middle" fontWeight="600" fill="#1F4D2A" fontSize="14">Spatial Feature Store</text>
                  <text x="307" y="85" textAnchor="middle" fill="#4A5650" fontSize="12">Panchayat Terrain</text>
                  <text x="307" y="105" textAnchor="middle" fill="#4A5650" fontSize="12">• Elevation (DEM)</text>
                  <text x="307" y="125" textAnchor="middle" fill="#4A5650" fontSize="12">• Slope & Aspect</text>
                  <text x="307" y="145" textAnchor="middle" fill="#4A5650" fontSize="12">• Soil & Land Cover</text>

                  <line x1="390" y1="105" x2="430" y2="105" stroke="#2F6B3B" strokeWidth="2" markerEnd="url(#arrow)" />

                  {/* Stage 3 */}
                  <rect x="435" y="30" width="180" height="150" rx="8" fill="#E3EFE4" stroke="#2F6B3B" strokeWidth="2.5" />
                  <text x="525" y="58" textAnchor="middle" fontWeight="600" fill="#1F4D2A" fontSize="14">LightGBM Hurdle & Quantile</text>
                  <text x="525" y="85" textAnchor="middle" fill="#1F2A22" fontSize="12">Stage 1: Rain Classifier</text>
                  <text x="525" y="105" textAnchor="middle" fill="#4A5650" fontSize="11">(Isotonic Calibrated Prob)</text>
                  <text x="525" y="128" textAnchor="middle" fill="#1F2A22" fontSize="12">Stage 2: Quantile Regressors</text>
                  <text x="525" y="148" textAnchor="middle" fill="#4A5650" fontSize="11">(P10, P50, P90 conditional)</text>

                  <line x1="615" y1="105" x2="655" y2="105" stroke="#2F6B3B" strokeWidth="2" markerEnd="url(#arrow)" />

                  {/* Stage 4 */}
                  <rect x="660" y="30" width="160" height="150" rx="8" fill="#F3EEE2" stroke="#B27A12" strokeWidth="2" />
                  <text x="740" y="58" textAnchor="middle" fontWeight="600" fill="#7A5A3A" fontSize="14">Advisory Engine</text>
                  <text x="740" y="85" textAnchor="middle" fill="#4A5650" fontSize="12">Decoupled Rules</text>
                  <text x="740" y="105" textAnchor="middle" fill="#4A5650" fontSize="12">• Crop Phenology</text>
                  <text x="740" y="125" textAnchor="middle" fill="#4A5650" fontSize="12">• Severity Downgrades</text>
                  <text x="740" y="145" textAnchor="middle" fill="#4A5650" fontSize="12">• Trigger Explainability</text>

                  <line x1="820" y1="105" x2="855" y2="105" stroke="#2F6B3B" strokeWidth="2" markerEnd="url(#arrow)" />

                  {/* Stage 5 */}
                  <rect x="860" y="30" width="105" height="150" rx="8" fill="#FFFFFF" stroke="#1F2A22" strokeWidth="2" />
                  <text x="912" y="58" textAnchor="middle" fontWeight="600" fill="#1F2A22" fontSize="13">Delivery</text>
                  <text x="912" y="88" textAnchor="middle" fill="#4A5650" fontSize="11">Farmer UI</text>
                  <text x="912" y="110" textAnchor="middle" fill="#4A5650" fontSize="11">Officer GIS</text>
                  <text x="912" y="132" textAnchor="middle" fill="#4A5650" fontSize="11">Bulletin PDF</text>
                  <text x="912" y="154" textAnchor="middle" fill="#4A5650" fontSize="11">SMS Copy</text>
                </svg>
              </div>
            </div>
          )}
        </div>

        {/* Accordion 2: Hurdle Model Formulation */}
        <div className="km-accordion-card">
          <button
            type="button"
            className="km-accordion-header"
            onClick={() => toggleSection('hurdle')}
            aria-expanded={openSections.hurdle}
          >
            <div className="km-accordion-title-row">
              <span className="km-tech-badge">2</span>
              <span className="km-accordion-title">{m.hurdle_title || '2. Hurdle Model Formulation for Rainfall'}</span>
            </div>
            {openSections.hurdle ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>
          {openSections.hurdle && (
            <div className="km-accordion-body">
              <p className="km-section-text">
                {m.hurdle_body || 'Rainfall is zero-inflated with extreme positive skewness. Direct regression models often produce chronic drizzle or fail on convective storms. KrishiMitra implements a decoupled two-stage Hurdle formulation:'}
              </p>
              <div className="km-formula-card">
                <div className="km-formula-row">
                  <strong>Stage 1 (Occurrence Probability):</strong>
                  <code>P(Rain ≥ 1.0mm) = Isotonic(LightGBM_Classifier(X))</code>
                </div>
                <div className="km-formula-row">
                  <strong>Stage 2 (Amount if Wet):</strong>
                  <code>Q_τ(Rain | Rain ≥ 1.0mm) = LightGBM_Quantile_τ(X_wet), τ ∈ {'{0.1, 0.5, 0.9}'}</code>
                </div>
                <div className="km-formula-row">
                  <strong>Composite Expected Rainfall:</strong>
                  <code>E[Rain] = P(Rain) × Q_0.5(Rain | Rain ≥ 1.0mm)</code>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Accordion 3: Spatial Holdout Protocol */}
        <div className="km-accordion-card">
          <button
            type="button"
            className="km-accordion-header"
            onClick={() => toggleSection('holdout')}
            aria-expanded={openSections.holdout}
          >
            <div className="km-accordion-title-row">
              <span className="km-tech-badge">3</span>
              <span className="km-accordion-title">{m.holdout_title || '3. Strict Spatial Holdout Protocol (Zero Leakage)'}</span>
            </div>
            {openSections.holdout ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>
          {openSections.holdout && (
            <div className="km-accordion-body">
              <p className="km-section-text">
                {m.holdout_body || 'Standard random train/test row splitting causes severe spatial data leakage in geospatial machine learning. KrishiMitra enforces strict spatial cluster holdouts:'}
              </p>
              <div className="km-holdout-grid">
                <div className="km-holdout-item">
                  <CheckCircle2 size={18} className="km-text-success" />
                  <div>
                    <strong>Held-Out Test Locations</strong>
                    <p>23 test panchayats in Tumakuru (and corresponding test clusters in Ratnagiri, Ludhiana, and Jodhpur) are strictly withheld from model training and hyperparameter tuning.</p>
                  </div>
                </div>
                <div className="km-holdout-item">
                  <CheckCircle2 size={18} className="km-text-success" />
                  <div>
                    <strong>Identical Evaluation Split</strong>
                    <p>Baseline block coarse forecasts and ML downscaling are evaluated on the exact same test locations without spatial overlap.</p>
                  </div>
                </div>
                <div className="km-holdout-item">
                  <CheckCircle2 size={18} className="km-text-success" />
                  <div>
                    <strong>Conformal Calibration Split</strong>
                    <p>An independent 20% spatial calibration split calibrates prediction interval widths ensuring valid 80% coverage.</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Accordion 4: Quantile Loss & Conformal Calibration */}
        <div className="km-accordion-card">
          <button
            type="button"
            className="km-accordion-header"
            onClick={() => toggleSection('quantile')}
            aria-expanded={openSections.quantile}
          >
            <div className="km-accordion-title-row">
              <span className="km-tech-badge">4</span>
              <span className="km-accordion-title">{m.quantile_title || '4. Quantile Regression & Conformal Calibration'}</span>
            </div>
            {openSections.quantile ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>
          {openSections.quantile && (
            <div className="km-accordion-body">
              <p className="km-section-text">
                {m.quantile_body || 'Quantile loss functions penalize over/under-predictions asymmetrically. An independent 20% spatial calibration split calibrates prediction interval widths ensuring valid 80% coverage.'}
              </p>
              <div className="km-formula-card">
                <div className="km-formula-row">
                  <strong>Pinball Loss Function:</strong>
                  <code>L_τ(y, ŷ) = max(τ(y - ŷ), (1 - τ)(ŷ - y))</code>
                </div>
                <div className="km-formula-row">
                  <strong>Interval Coverage:</strong>
                  <code>Confidence = 1.0 - (P90 - P10) / (P50 + ε)</code>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Accordion 5: Data Provenance & Real vs Synthetic Matrix */}
        <div className="km-accordion-card">
          <button
            type="button"
            className="km-accordion-header"
            onClick={() => toggleSection('provenance')}
            aria-expanded={openSections.provenance}
          >
            <div className="km-accordion-title-row">
              <span className="km-tech-badge">5</span>
              <span className="km-accordion-title">{m.provenance_title || '5. Data Provenance & Real vs Synthetic Matrix'}</span>
            </div>
            {openSections.provenance ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>
          {openSections.provenance && (
            <div className="km-accordion-body">
              <div className="km-table-container">
                <table className="km-table">
                  <thead>
                    <tr>
                      <th>Component</th>
                      <th>Classification</th>
                      <th>Source & Citation</th>
                      <th>Status / License</th>
                      <th>Operational Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><strong>District Boundary</strong></td>
                      <td><span className="km-status-pill km-pill-ok">Real</span></td>
                      <td>geoBoundaries ADM2 / Survey of India</td>
                      <td>CC BY 4.0</td>
                      <td>Accurate official district administrative boundary outline.</td>
                    </tr>
                    <tr>
                      <td><strong>Sub-District (Panchayats)</strong></td>
                      <td><span className="km-status-pill km-pill-warn">Illustrative</span></td>
                      <td>Seeded Voronoi Tessellation</td>
                      <td>Algorithmic Geometry</td>
                      <td>Panchayat polygons are illustrative Voronoi partitions inside the district boundary.</td>
                    </tr>
                    <tr>
                      <td><strong>Elevation & Terrain</strong></td>
                      <td><span className="km-status-pill km-pill-ok">Real / Calibrated</span></td>
                      <td>SRTM DEM 30m / Synthetic Relief Generator</td>
                      <td>Public Domain</td>
                      <td>Topographic lapse-rate adjustments and slope factors.</td>
                    </tr>
                    <tr>
                      <td><strong>Meteorological Weather</strong></td>
                      <td><span className="km-status-pill km-pill-info">Calibrated Synthetic</span></td>
                      <td>NASA POWER / IMD Monthly Climatology Normals</td>
                      <td>Physics-Calibrated Simulator</td>
                      <td>Synoptic monsoon convective cells, heatwaves, and cold snaps.</td>
                    </tr>
                    <tr>
                      <td><strong>Crop Phenology Rules</strong></td>
                      <td><span className="km-status-pill km-pill-warn">Illustrative Rules</span></td>
                      <td>ICAR / KVK Agromet Advisory Guidelines</td>
                      <td>Agronomic Domain Rules</td>
                      <td>Rules are illustrative templates requiring local KVK validation before live deployment.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Accordion 6: Model Artifact Metadata */}
        {metrics && (
          <div className="km-accordion-card">
            <button
              type="button"
              className="km-accordion-header"
              onClick={() => toggleSection('artifacts')}
              aria-expanded={openSections.artifacts}
            >
              <div className="km-accordion-title-row">
                <span className="km-tech-badge">6</span>
                <span className="km-accordion-title">6. Model Artifact Metadata & Provenance ({currentRegionId})</span>
              </div>
              {openSections.artifacts ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </button>
            {openSections.artifacts && (
              <div className="km-accordion-body">
                <div className="km-artifact-metadata-box">
                  <div><strong>Region & Zone:</strong> {region?.district} ({region?.agro_climatic_zone || 'Semi-Arid'})</div>
                  <div><strong>Model Version:</strong> {metrics.model_version || '2.0.0-calibrated'}</div>
                  <div><strong>Training Seed:</strong> 42 (Deterministic)</div>
                  <div><strong>Framework:</strong> LightGBM 4.6.0 (Multi-Region Scikit-Learn Pipeline)</div>
                  <div><strong>Evaluation Note:</strong> {metrics.note || 'Synthetic-world result; spatial holdout evaluated.'}</div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* SCIENTIFIC & OPERATIONAL DISCLOSURES CARD                     */}
      {/* ============================================================ */}
      <div className="km-container km-scientific-disclosure-section">
        <div className="km-disclosure-card">
          <div className="km-disclosure-header">
            <AlertTriangle size={22} className="km-text-warn" />
            <h2 className="km-disclosure-title">{m.disclosure_title || 'Scientific & Operational Disclosures'}</h2>
          </div>

          <div className="km-disclosure-grid">
            <div className="km-disclosure-item">
              <div className="km-disc-icon-badge">⚠️</div>
              <div>
                <strong>Synthetic-World Skill Caveat</strong>
                <p>{m.disclosure_synthetic || 'Metrics reported reflect performance against a physics-calibrated synthetic simulator. Real-world skill requires ground-truth AWS/ARG observation telemetry ingestion.'}</p>
              </div>
            </div>

            <div className="km-disclosure-item">
              <div className="km-disc-icon-badge">📍</div>
              <div>
                <strong>Resolution Integrity</strong>
                <p>{m.disclosure_resolution || 'KrishiMitra operates at the panchayat administrative level. We do not claim 1 km pixel or farm plot-level resolution.'}</p>
              </div>
            </div>

            <div className="km-disclosure-item">
              <div className="km-disc-icon-badge">🌾</div>
              <div>
                <strong>Institutional Advisory Validation</strong>
                <p>{m.disclosure_advisory || 'Rule triggers are built on agronomic literature and IMD agromet guidelines, requiring local KVK agronomist validation before live deployment.'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
