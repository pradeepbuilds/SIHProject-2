import React, { useState, useEffect } from 'react';
import { ShieldAlert, HelpCircle, ChevronDown, ChevronUp, CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import { fetchAlerts, fetchAdvisories, fetchUnits, fetchRegionDetail, fetchCrops } from '../services/api';
import type { AlertItem, Advisory, UnitItem, RegionDetail, CropInfo } from '../types/api';
import { getTranslation, formatDateLocale, type SupportedLanguage } from '../i18n';

interface AdvisoriesPageProps {
  currentRegionId: string;
  lang: SupportedLanguage;
}

export const AdvisoriesPage: React.FC<AdvisoriesPageProps> = ({ currentRegionId, lang }) => {
  const [region, setRegion] = useState<RegionDetail | null>(null);
  const [units, setUnits] = useState<UnitItem[]>([]);
  const [cropsCatalog, setCropsCatalog] = useState<Record<string, CropInfo>>({});
  const [selectedUnit, setSelectedUnit] = useState<string>('');
  const [selectedCrop, setSelectedCrop] = useState<string>('ragi');
  const [selectedStage, setSelectedStage] = useState<string>('vegetative');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [selectedDate, setSelectedDate] = useState<string>('2026-05-15');
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [advisories, setAdvisories] = useState<Advisory[]>([]);
  const [expandedWhy, setExpandedWhy] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState<boolean>(true);

  const t = getTranslation(lang);
  const advT = t.advisories_page || {};
  const f = t.farmer || {};

  // Load initial data
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [rData, uList, aList, cData] = await Promise.all([
          fetchRegionDetail(currentRegionId).catch(() => null),
          fetchUnits(currentRegionId, 'panchayat').catch(() => []),
          fetchAlerts(currentRegionId, selectedDate, lang).catch(() => []),
          fetchCrops().catch(() => ({} as Record<string, CropInfo>))
        ]);
        setRegion(rData);
        setUnits(uList);
        setAlerts(aList);
        setCropsCatalog(cData);

        const initialCrop = rData?.main_crops?.[0] || 'ragi';
        setSelectedCrop(initialCrop);

        const targetLoc = uList.length > 0 ? uList[0].id : 'PNC-KA-0001';
        setSelectedUnit(targetLoc);

        const advList = await fetchAdvisories(
          targetLoc,
          initialCrop,
          lang,
          selectedDate,
          currentRegionId,
          'vegetative'
        ).catch(() => []);
        setAdvisories(advList);
      } catch (err) {
        console.error('Error loading advisories:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [currentRegionId, lang, selectedDate]);

  // Handle filter changes
  const handleQueryChange = async (unitId: string, cropKey: string, stageKey: string) => {
    setLoading(true);
    try {
      const advList = await fetchAdvisories(
        unitId,
        cropKey,
        lang,
        selectedDate,
        currentRegionId,
        stageKey
      );
      setAdvisories(advList);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const currentCropMeta = cropsCatalog[selectedCrop.toLowerCase()];
  const availableStages = currentCropMeta ? Object.keys(currentCropMeta.stages) : ['sowing', 'vegetative', 'flowering', 'grain_filling', 'harvesting'];

  const handleCropSelect = (cropKey: string) => {
    setSelectedCrop(cropKey);
    const stages = cropsCatalog[cropKey.toLowerCase()]?.stages ? Object.keys(cropsCatalog[cropKey.toLowerCase()].stages) : ['vegetative'];
    const newStage = stages[0] || 'vegetative';
    setSelectedStage(newStage);
    handleQueryChange(selectedUnit, cropKey, newStage);
  };

  const handleStageSelect = (stageKey: string) => {
    setSelectedStage(stageKey);
    handleQueryChange(selectedUnit, selectedCrop, stageKey);
  };

  const handlePanchayatSelect = (unitId: string) => {
    setSelectedUnit(unitId);
    handleQueryChange(unitId, selectedCrop, selectedStage);
  };

  const toggleWhy = (id: string) => {
    setExpandedWhy((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Filter items
  const filteredAdvisories = advisories.filter((adv) => {
    const matchesSev = selectedSeverity === 'all' || adv.severity === selectedSeverity;
    return matchesSev;
  });

  const allAvailableCrops = Array.from(new Set([...(region?.main_crops || []), ...Object.keys(cropsCatalog)]));

  return (
    <div className="km-page km-advisories-page">
      <div className="km-container km-page-header">
        <div>
          <span className="km-unit-badge">{t.auth?.visual_crop_label || 'Agronomic Intelligence'}</span>
          <h1 className="km-page-title">{advT.header_title || 'Stage-Aware Agrometeorological Advisories'}</h1>
          <p className="km-page-sub">
            {advT.header_subtitle || 'Crop-stage phenological risk detection, operational mitigation guidance, and deterministic trigger explainability.'}
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="km-container km-advisory-filters">
        <div className="km-filter-group">
          <label htmlFor="adv-panchayat" className="km-label-sm">{advT.filter_location || 'Location / Panchayat'}</label>
          <select
            id="adv-panchayat"
            className="km-select km-select-sm"
            value={selectedUnit}
            onChange={(e) => handlePanchayatSelect(e.target.value)}
          >
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.id})
              </option>
            ))}
          </select>
        </div>

        <div className="km-filter-group">
          <label htmlFor="adv-crop" className="km-label-sm">{advT.filter_crop || 'Target Crop'}</label>
          <select
            id="adv-crop"
            className="km-select km-select-sm"
            value={selectedCrop}
            onChange={(e) => handleCropSelect(e.target.value)}
          >
            {allAvailableCrops.map((c) => (
              <option key={c} value={c}>
                {cropsCatalog[c]?.name || c.toUpperCase()}
              </option>
            ))}
          </select>
        </div>

        <div className="km-filter-group">
          <label htmlFor="adv-stage" className="km-label-sm">{advT.filter_stage || 'Crop Stage'}</label>
          <select
            id="adv-stage"
            className="km-select km-select-sm"
            value={selectedStage}
            onChange={(e) => handleStageSelect(e.target.value)}
          >
            {availableStages.map((st) => (
              <option key={st} value={st}>
                {st.replace('_', ' ').toUpperCase()}
              </option>
            ))}
          </select>
        </div>

        <div className="km-filter-group">
          <label htmlFor="adv-sev" className="km-label-sm">{advT.filter_severity || 'Severity Level'}</label>
          <select
            id="adv-sev"
            className="km-select km-select-sm"
            value={selectedSeverity}
            onChange={(e) => setSelectedSeverity(e.target.value)}
          >
            <option value="all">{advT.all_severities || 'All Severities'}</option>
            <option value="warning">{advT.sev_warning || 'Warning (High Risk)'}</option>
            <option value="watch">{advT.sev_watch || 'Watch (Moderate Risk)'}</option>
            <option value="info">{advT.sev_info || 'Info (Standard Guidance)'}</option>
          </select>
        </div>

        <div className="km-filter-group">
          <label htmlFor="adv-date" className="km-label-sm">{advT.filter_date || 'Target Date'}</label>
          <input
            id="adv-date"
            type="date"
            className="km-input km-input-sm"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
        </div>
      </div>

      {/* District Alert Summary Banner */}
      {alerts.length > 0 && (
        <div className="km-container km-district-alerts-banner">
          <div className="km-alerts-banner-top">
            <ShieldAlert size={18} className="km-text-danger" />
            <strong>
              {advT.active_alerts_banner
                ? advT.active_alerts_banner.replace('{{count}}', String(alerts.length)).replace('{{date}}', formatDateLocale(selectedDate, lang))
                : `District Weather Alerts Active (${alerts.length} Locations on ${formatDateLocale(selectedDate, lang)})`}
            </strong>
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
            <p>{t.common?.loading || 'Evaluating agricultural phenological rules...'}</p>
          </div>
        ) : filteredAdvisories.length === 0 ? (
          <div className="km-empty-card">
            <CheckCircle2 size={40} className="km-text-success" />
            <h4>{advT.no_advisories || 'No advisories triggered for the selected filters. Conditions are favorable for crop growth.'}</h4>
          </div>
        ) : (
          filteredAdvisories.map((adv, idx) => {
            const whyKey = `${adv.rule_id}-${idx}`;
            const isWhyOpen = !!expandedWhy[whyKey];
            const sev = adv.severity || 'info';

            return (
              <div key={idx} className={`km-adv-card km-adv-${sev} km-advisory-full-card`}>
                <div className="km-adv-header">
                  <div className="km-adv-badge-wrap">
                    <span className={`km-sev-badge km-sev-${sev}`}>
                      {sev === 'warning' ? <AlertTriangle size={14} /> : sev === 'watch' ? <ShieldAlert size={14} /> : <Info size={14} />}
                      {advT[`sev_${sev}`] ? advT[`sev_${sev}`].split(' ')[0] : sev.toUpperCase()}
                    </span>
                    <h3 className="km-adv-title">{adv.title}</h3>
                  </div>
                  <div className="km-af-meta">
                    <span className="km-tag-crop">{cropsCatalog[adv.crop || selectedCrop]?.name || (adv.crop || selectedCrop).toUpperCase()}</span>
                    <span className="km-tag-stage">{(adv.stage || selectedStage).toUpperCase()}</span>
                  </div>
                </div>

                <p className="km-adv-message">{adv.message}</p>

                {/* Explainability "Why?" Toggle */}
                <div className="km-af-why-container">
                  <button
                    type="button"
                    className="km-adv-why-btn"
                    onClick={() => toggleWhy(whyKey)}
                  >
                    <HelpCircle size={14} />
                    <span>{f.why_recommendation || f.why_rule || 'Why was this advisory issued?'}</span>
                    {isWhyOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>

                  {isWhyOpen && (
                    <div className="km-adv-why-drawer">
                      <div className="km-why-row">
                        <span>{f.trigger_rule || 'Rule Identifier:'}</span>
                        <code>{adv.rule_id}</code>
                      </div>
                      <div className="km-why-row">
                        <span>{f.crop_stage_context || 'Crop & Phenological Stage:'}</span>
                        <strong>{adv.crop || selectedCrop} ({adv.stage || selectedStage})</strong>
                      </div>
                      {adv.trigger_inputs && (
                        <div className="km-why-inputs">
                          <span>{f.evaluated_inputs || 'Evaluated Weather Inputs:'}</span>
                          <pre>{JSON.stringify(adv.trigger_inputs, null, 2)}</pre>
                        </div>
                      )}
                      <p className="km-why-disclaimer">
                        {adv.disclaimer || 'Meteorological advisory guidance generated by rule engine. Verify local conditions before field interventions.'}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
