import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Printer, ArrowLeft } from 'lucide-react';
import { fetchRegionDetail, fetchPredictionStrip, fetchAdvisories, fetchAlerts, fetchUnits } from '../services/api';
import type { RegionDetail, StripItem, Advisory, AlertItem, UnitItem } from '../types/api';
import { formatDateLocale, type SupportedLanguage } from '../i18n';

export const BulletinPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const regionId = searchParams.get('region_id') || 'ka-tumakuru';
  const targetDate = searchParams.get('date') || '2026-05-15';
  const lang = (searchParams.get('lang') || 'en') as SupportedLanguage;
  const locationId = searchParams.get('location_id') || '';

  const [region, setRegion] = useState<RegionDetail | null>(null);
  const [units, setUnits] = useState<UnitItem[]>([]);
  const [strip, setStrip] = useState<StripItem[]>([]);
  const [advisories, setAdvisories] = useState<Advisory[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [rData, uList, aList] = await Promise.all([
          fetchRegionDetail(regionId).catch(() => null),
          fetchUnits(regionId, 'panchayat').catch(() => []),
          fetchAlerts(regionId, targetDate).catch(() => [])
        ]);
        setRegion(rData);
        setUnits(uList);
        setAlerts(aList);

        const targetLoc = locationId || (uList.length > 0 ? uList[0].id : 'PNC-KA-0001');
        const [stripData, advData] = await Promise.all([
          fetchPredictionStrip(targetLoc, targetDate, 5, regionId).catch(() => []),
          fetchAdvisories(targetLoc, 'ragi', lang, targetDate, regionId).catch(() => [])
        ]);
        setStrip(stripData);
        setAdvisories(advData);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [regionId, targetDate, lang, locationId]);

  const activeUnit = units.find((u) => u.id === locationId) || units[0];

  return (
    <div className="km-bulletin-container">
      {/* Top screen-only action bar */}
      <div className="km-bulletin-toolbar no-print">
        <Link to={`/?region=${regionId}&date=${targetDate}`} className="km-btn km-btn-outline">
          <ArrowLeft size={16} />
          <span>Return to Dashboard</span>
        </Link>
        <button
          type="button"
          className="km-btn km-btn-primary"
          onClick={() => window.print()}
        >
          <Printer size={16} />
          <span>Print / Save as PDF</span>
        </button>
      </div>

      {loading ? (
        <div className="km-loading-box">
          <div className="km-spinner"></div>
          <p>Compiling Official Agro-Meteorological Bulletin...</p>
        </div>
      ) : (
        <article className="km-bulletin-sheet">
          {/* Bulletin Header */}
          <header className="km-bulletin-header">
            <div className="km-bulletin-crest">
              <img src="/logo.svg" alt="KrishiMitra Emblem" width="48" height="48" />
              <div>
                <h1 className="km-bulletin-gov-title">AGROMETEOROLOGICAL ADVISORY SERVICE</h1>
                <h2 className="km-bulletin-org-title">
                  KrishiMitra Panchayat Intelligence Unit · {region?.state || 'State Department of Agriculture'}
                </h2>
              </div>
            </div>

            <div className="km-bulletin-meta-box">
              <div><strong>District:</strong> {region?.district || regionId}</div>
              <div><strong>Agro-Climatic Zone:</strong> {region?.agro_climatic_zone || 'Semi-Arid Plateau'}</div>
              <div><strong>Issued For:</strong> {formatDateLocale(targetDate, lang)}</div>
              <div><strong>Bulletin Ref:</strong> KM-{regionId.toUpperCase()}-{targetDate.replace(/-/g, '')}-D01</div>
            </div>
          </header>

          <hr className="km-bulletin-divider" />

          {/* Section 1: Executive Weather Synopsis */}
          <section className="km-bulletin-section">
            <h3 className="km-bulletin-sec-title">1. EXECUTIVE WEATHER SYNOPSIS</h3>
            <div className="km-bulletin-synopsis-grid">
              <div className="km-synopsis-card">
                <span className="km-synopsis-label">Focus Panchayat</span>
                <span className="km-synopsis-value">{activeUnit?.name || 'Central District'} ({activeUnit?.id || locationId})</span>
              </div>
              <div className="km-synopsis-card">
                <span className="km-synopsis-label">5-Day Expected Rainfall</span>
                <span className="km-synopsis-value">
                  {strip.reduce((acc, s) => acc + (s.rainfall?.prediction || 0), 0).toFixed(1)} mm total
                </span>
              </div>
              <div className="km-synopsis-card">
                <span className="km-synopsis-label">High / Low Temp Range</span>
                <span className="km-synopsis-value">
                  {Math.min(...strip.map((s) => s.temp_min?.prediction || 20)).toFixed(0)}°C to{' '}
                  {Math.max(...strip.map((s) => s.temp_max?.prediction || 32)).toFixed(0)}°C
                </span>
              </div>
              <div className="km-synopsis-card">
                <span className="km-synopsis-label">Risk Profile</span>
                <span className="km-synopsis-value km-text-danger">
                  {alerts.length > 0 ? `${alerts.length} Panchayat Alerts Active` : 'Normal Seasonal Profile'}
                </span>
              </div>
            </div>
          </section>

          {/* Section 2: 5-Day Numerical Forecast Table */}
          <section className="km-bulletin-section">
            <h3 className="km-bulletin-sec-title">2. 5-DAY PANCHAYAT FORECAST TABLE</h3>
            <table className="km-bulletin-table">
              <thead>
                <tr>
                  <th>Target Date</th>
                  <th>Lead Time</th>
                  <th>Rain Est (mm)</th>
                  <th>Rain Prob</th>
                  <th>P10 - P90 Band</th>
                  <th>Max Temp (°C)</th>
                  <th>Min Temp (°C)</th>
                  <th>Confidence</th>
                </tr>
              </thead>
              <tbody>
                {strip.map((item, idx) => (
                  <tr key={idx}>
                    <td><strong>{formatDateLocale(item.date, lang)}</strong></td>
                    <td>+{item.day_offset || (idx + 1)} Day{idx > 0 ? 's' : ''}</td>
                    <td className="km-text-right"><strong>{(item.rainfall?.prediction || 0).toFixed(1)}</strong></td>
                    <td className="km-text-right">{Math.round((item.rainfall?.rain_probability || 0) * 100)}%</td>
                    <td className="km-text-center km-text-muted">
                      {(item.rainfall?.uncertainty_interval?.p10 || 0).toFixed(1)} – {(item.rainfall?.uncertainty_interval?.p90 || 0).toFixed(1)}
                    </td>
                    <td className="km-text-right">{(item.temp_max?.prediction || 30).toFixed(1)}</td>
                    <td className="km-text-right">{(item.temp_min?.prediction || 20).toFixed(1)}</td>
                    <td className="km-text-center">
                      <span className={`km-conf-tag km-conf-${item.rainfall?.uncertainty_label || 'medium'}`}>
                        {(item.rainfall?.uncertainty_label || 'medium').toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* Section 3: Agricultural Crop Advisories */}
          <section className="km-bulletin-section">
            <h3 className="km-bulletin-sec-title">3. STAGE-AWARE CROP MANAGEMENT INSTRUCTIONS</h3>
            <div className="km-bulletin-advisories">
              {advisories.length === 0 ? (
                <div className="km-advisory-empty">
                  No critical operational warnings for the chosen date. Standard agricultural maintenance applies.
                </div>
              ) : (
                advisories.map((adv, idx) => (
                  <div key={idx} className={`km-bulletin-advisory-card km-sev-${adv.severity}`}>
                    <div className="km-adv-top">
                      <span className="km-adv-badge">{adv.severity.toUpperCase()}</span>
                      <strong>{adv.title}</strong>
                      <span className="km-adv-crop-tag">ID: {adv.rule_id}</span>
                    </div>
                    <p className="km-adv-msg">{adv.message}</p>
                    <div className="km-adv-footer">
                      <span><strong>Trigger rule:</strong> {adv.rule_id}</span>
                      <span><strong>Confidence:</strong> {adv.confidence}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Section 4: Provenance, Legal Disclaimer & Contact */}
          <footer className="km-bulletin-footer">
            <div className="km-provenance-legal">
              <p>
                <strong>Scientific Data Provenance:</strong> Meteorological estimates produced by KrishiMitra LightGBM 
                probabilistic downscaling engine. District outline: official open-source boundary. Sub-district units: 
                illustrative seeded Voronoi partition. Climatological calibration: NASA POWER / IMD normals.
              </p>
              <p className="km-disclaimer-note">
                <strong>Disclaimer:</strong> Advisory guidelines are operational decision aids. Field implementation 
                should always be cross-referenced with your local Krishi Vigyan Kendra (KVK) and block agricultural officers.
              </p>
            </div>
            <div className="km-signature-row">
              <div className="km-sign-box">
                <div className="km-sign-line"></div>
                <span>Technical Officer (Agrometeorology)</span>
              </div>
              <div className="km-sign-box">
                <div className="km-sign-line"></div>
                <span>District Agricultural Extension In-Charge</span>
              </div>
            </div>
          </footer>
        </article>
      )}
    </div>
  );
};
