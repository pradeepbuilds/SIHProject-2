import React, { useState, useEffect } from 'react';
import { ShieldAlert, HelpCircle, ChevronDown, ChevronUp, CheckCircle2 } from 'lucide-react';
import { fetchAlerts, fetchAdvisories, fetchUnits, fetchRegionDetail } from '../services/api';
import type { AlertItem, Advisory, UnitItem, RegionDetail } from '../types/api';
import type { SupportedLanguage } from '../i18n';

interface AdvisoriesPageProps {
  currentRegionId: string;
  lang: SupportedLanguage;
}

export const AdvisoriesPage: React.FC<AdvisoriesPageProps> = ({ currentRegionId, lang }) => {
  const [region, setRegion] = useState<RegionDetail | null>(null);
  const [units, setUnits] = useState<UnitItem[]>([]);
  const [selectedUnit, setSelectedUnit] = useState<string>('');
  const [selectedCrop, setSelectedCrop] = useState<string>('all');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [advisories, setAdvisories] = useState<Advisory[]>([]);
  const [expandedWhy, setExpandedWhy] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [rData, uList, aList] = await Promise.all([
          fetchRegionDetail(currentRegionId).catch(() => null),
          fetchUnits(currentRegionId, 'panchayat').catch(() => []),
          fetchAlerts(currentRegionId).catch(() => [])
        ]);
        setRegion(rData);
        setUnits(uList);
        setAlerts(aList);

        const targetLoc = uList.length > 0 ? uList[0].id : 'PNC-KA-0001';
        setSelectedUnit(targetLoc);

        const advList = await fetchAdvisories(
          targetLoc,
          rData?.main_crops?.[0] || 'ragi',
          lang,
          '2026-05-15',
          currentRegionId
        ).catch(() => []);
        setAdvisories(advList);
      } catch (err) {
        console.error('Error loading advisories:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [currentRegionId, lang]);

  // Handle location or crop change
  const handlePanchayatChange = async (unitId: string) => {
    setSelectedUnit(unitId);
    setLoading(true);
    try {
      const advList = await fetchAdvisories(
        unitId,
        selectedCrop === 'all' ? (region?.main_crops?.[0] || 'ragi') : selectedCrop,
        lang,
        '2026-05-15',
        currentRegionId
      );
      setAdvisories(advList);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const toggleWhy = (id: string) => {
    setExpandedWhy((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Combine and filter items
  const filteredAdvisories = advisories.filter((adv) => {
    const matchesCrop = selectedCrop === 'all' || (adv.crop ? adv.crop.toLowerCase() === selectedCrop.toLowerCase() : true);
    const matchesSev = selectedSeverity === 'all' || adv.severity === selectedSeverity;
    return matchesCrop && matchesSev;
  });

  return (
    <div className="km-page km-advisories-page">
      <div className="km-container km-page-header">
        <div>
          <h2 className="km-page-title">Stage-Aware Agrometeorological Advisories</h2>
          <p className="km-page-sub">
            Crop-stage phenological risk detection, operational mitigation guidance, and deterministic trigger explainability.
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="km-container km-advisory-filters">
        <div className="km-filter-group">
          <label htmlFor="adv-panchayat" className="km-label-sm">Location</label>
          <select
            id="adv-panchayat"
            className="km-select km-select-sm"
            value={selectedUnit}
            onChange={(e) => handlePanchayatChange(e.target.value)}
          >
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.id})
              </option>
            ))}
          </select>
        </div>

        <div className="km-filter-group">
          <label htmlFor="adv-crop" className="km-label-sm">Target Crop</label>
          <select
            id="adv-crop"
            className="km-select km-select-sm"
            value={selectedCrop}
            onChange={(e) => setSelectedCrop(e.target.value)}
          >
            <option value="all">All Regional Crops</option>
            {region?.main_crops?.map((c) => (
              <option key={c} value={c}>
                {c.charAt(0).toUpperCase() + c.slice(1)}
              </option>
            ))}
          </select>
        </div>

        <div className="km-filter-group">
          <label htmlFor="adv-sev" className="km-label-sm">Severity Level</label>
          <select
            id="adv-sev"
            className="km-select km-select-sm"
            value={selectedSeverity}
            onChange={(e) => setSelectedSeverity(e.target.value)}
          >
            <option value="all">All Severities</option>
            <option value="warning">Warning (Immediate Action)</option>
            <option value="watch">Watch (Preparation)</option>
            <option value="info">Info (Advisory)</option>
          </select>
        </div>
      </div>

      {/* District Alert Summary Banner */}
      {alerts.length > 0 && (
        <div className="km-container km-district-alerts-banner">
          <div className="km-alerts-banner-top">
            <ShieldAlert size={18} className="km-text-danger" />
            <strong>District Weather Alerts Active ({alerts.length} Locations)</strong>
          </div>
          <div className="km-alerts-grid">
            {alerts.slice(0, 4).map((a, i) => (
              <div key={i} className={`km-district-alert-card km-sev-${a.severity}`}>
                <div className="km-dalert-loc">{a.panchayat_id} ({a.panchayat_name})</div>
                <div className="km-dalert-title">{a.title}</div>
                <div className="km-dalert-msg">{a.message}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Advisory Cards List */}
      <div className="km-container km-advisories-list">
        {loading ? (
          <div className="km-loading-box">
            <div className="km-spinner"></div>
            <p>Evaluating agricultural phenological rules...</p>
          </div>
        ) : filteredAdvisories.length === 0 ? (
          <div className="km-empty-card">
            <CheckCircle2 size={36} className="km-text-ok" />
            <h4>No Critical Weather Risks Detected</h4>
            <p>
              Weather conditions for {selectedCrop === 'all' ? 'monitored crops' : selectedCrop} at this location are 
              currently within normal agronomic thresholds.
            </p>
          </div>
        ) : (
          filteredAdvisories.map((adv, idx) => {
            const whyKey = `${adv.rule_id}-${idx}`;
            const isWhyOpen = !!expandedWhy[whyKey];

            return (
              <div key={idx} className={`km-advisory-full-card km-card-sev-${adv.severity}`}>
                <div className="km-af-header">
                  <div className="km-af-left">
                    <span className={`km-status-pill km-pill-${adv.severity === 'warning' ? 'danger' : adv.severity === 'watch' ? 'warn' : 'info'}`}>
                      {adv.severity.toUpperCase()}
                    </span>
                    <h3 className="km-af-title">{adv.title}</h3>
                  </div>
                  <div className="km-af-meta">
                    <span className="km-tag-crop">{(adv.crop || selectedCrop).toUpperCase()}</span>
                    <span className="km-tag-stage">{adv.stage || 'Active Growth'}</span>
                  </div>
                </div>

                <p className="km-af-message">{adv.message}</p>

                {/* Explainability "Why?" Toggle */}
                <div className="km-af-why-container">
                  <button
                    type="button"
                    className="km-btn km-btn-xs km-btn-ghost km-why-btn"
                    onClick={() => toggleWhy(whyKey)}
                  >
                    <HelpCircle size={14} />
                    <span>Why did this rule trigger?</span>
                    {isWhyOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>

                  {isWhyOpen && (
                    <div className="km-why-content">
                      <div className="km-why-rule">
                        <strong>Rule Identifier:</strong> <code>{adv.rule_id}</code>
                      </div>
                      <div className="km-why-params">
                        <strong>Numerical Evaluation Inputs:</strong>
                        <pre>{JSON.stringify(adv.trigger_inputs || { condition: 'threshold_exceeded', value: 'verified' }, null, 2)}</pre>
                      </div>
                      <div className="km-why-conf">
                        <strong>Confidence Assessment:</strong> {adv.confidence || adv.confidence_level || 'standard'}
                      </div>
                    </div>
                  )}
                </div>

                <div className="km-af-footer">
                  <span className="km-af-disclaimer">
                    {adv.disclaimer || 'Illustrative advisory rules. Validate thresholds with your local KVK / agricultural university before real use.'}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
