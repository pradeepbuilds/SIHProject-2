import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, X, Download } from 'lucide-react';
import { fetchUnits, fetchPredictionStrip, fetchRegionDetail } from '../services/api';
import type { UnitItem, StripItem, RegionDetail } from '../types/api';
import { getTranslation, formatDateLocale, type SupportedLanguage } from '../i18n';

interface ComparePageProps {
  currentRegionId: string;
  lang?: SupportedLanguage;
}

interface LocationComparison {
  unit: UnitItem;
  strip: StripItem[];
}

export const ComparePage: React.FC<ComparePageProps> = ({ currentRegionId, lang = 'en' }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [region, setRegion] = useState<RegionDetail | null>(null);
  const [units, setUnits] = useState<UnitItem[]>([]);
  const [selectedLocations, setSelectedLocations] = useState<LocationComparison[]>([]);
  const [selectedUnitToAdd, setSelectedUnitToAdd] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const t = getTranslation(lang);
  const cmpT = t.compare || {};
  const offT = t.officer || {};

  // URL state
  const locParams = searchParams.get('locs') ? searchParams.get('locs')!.split(',') : [];

  // Load region and units
  useEffect(() => {
    fetchRegionDetail(currentRegionId).then(setRegion).catch(console.error);
    fetchUnits(currentRegionId, 'panchayat')
      .then((uList) => {
        setUnits(uList);
        if (uList.length > 0) {
          setSelectedUnitToAdd(uList[0].id);
          // Initial selection if empty
          if (locParams.length === 0) {
            const defaults = uList.slice(0, 3).map((u) => u.id);
            updateUrlLocs(defaults);
          }
        }
      })
      .catch(console.error);
  }, [currentRegionId]);

  // Sync with URL locations
  useEffect(() => {
    if (!units.length || !locParams.length) return;

    async function loadComparisons() {
      setLoading(true);
      try {
        const comparisons: LocationComparison[] = await Promise.all(
          locParams.slice(0, 5).map(async (locId) => {
            const unit = units.find((u) => u.id === locId) || {
              id: locId,
              name: locId,
              level: 'panchayat' as const,
              region_id: currentRegionId,
              block_id: 'Block',
              boundary_is_official: false
            };
            const strip = await fetchPredictionStrip(locId, '2026-05-15', 5, currentRegionId).catch(() => []);
            return { unit, strip };
          })
        );
        setSelectedLocations(comparisons);
      } finally {
        setLoading(false);
      }
    }
    loadComparisons();
  }, [units, searchParams, currentRegionId]);

  const updateUrlLocs = (locs: string[]) => {
    const next = new URLSearchParams(searchParams);
    next.set('locs', locs.join(','));
    setSearchParams(next, { replace: true });
  };

  const handleAddLocation = () => {
    if (!selectedUnitToAdd) return;
    if (locParams.includes(selectedUnitToAdd)) return;
    if (locParams.length >= 5) {
      alert(cmpT.max_locations_note || 'You can compare a maximum of 5 locations simultaneously.');
      return;
    }
    updateUrlLocs([...locParams, selectedUnitToAdd]);
  };

  const handleRemoveLocation = (locId: string) => {
    updateUrlLocs(locParams.filter((id) => id !== locId));
  };

  const exportComparisonCSV = () => {
    if (!selectedLocations.length) return;
    const dates = selectedLocations[0]?.strip.map((s) => s.date) || [];
    const headers = [
      offT.panchayat_col || 'Panchayat ID',
      'Name',
      offT.block_col || 'Block',
      ...dates.map((d) => `Rain ${d} (mm)`)
    ];
    const rows = selectedLocations.map((loc) => [
      loc.unit.id,
      `"${loc.unit.name}"`,
      `"${loc.unit.block_id || ''}"`,
      ...loc.strip.map((s) => (s.rainfall?.prediction || 0).toFixed(1))
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `panchayat_comparison_${currentRegionId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="km-page km-compare-page">
      <div className="km-container km-page-header">
        <div>
          <h2 className="km-page-title">{cmpT.page_title || 'Multi-Panchayat Weather Comparison'}</h2>
          <p className="km-page-sub">
            {cmpT.page_subtitle
              ? cmpT.page_subtitle.replace('{{district}}', region?.district || currentRegionId)
              : `Side-by-side contrast of downscaled forecasts across up to 5 panchayats or blocks in ${region?.district || currentRegionId}.`}
          </p>
        </div>

        <div className="km-header-actions">
          <button type="button" className="km-btn km-btn-outline" onClick={exportComparisonCSV}>
            <Download size={15} />
            <span>{cmpT.export_comparison || 'Export Comparison CSV'}</span>
          </button>
        </div>
      </div>

      {/* Location Picker Toolbar */}
      <div className="km-container km-compare-toolbar">
        <div className="km-picker-row">
          <div className="km-field">
            <label htmlFor="cmp-add" className="km-label-sm">{cmpT.add_location || 'Add Panchayat to Comparison'}:</label>
            <select
              id="cmp-add"
              className="km-select km-select-sm"
              value={selectedUnitToAdd}
              onChange={(e) => setSelectedUnitToAdd(e.target.value)}
            >
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.id})
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            className="km-btn km-btn-sm km-btn-primary"
            onClick={handleAddLocation}
            disabled={locParams.length >= 5}
          >
            <Plus size={15} />
            <span>{cmpT.add_location || 'Add to Compare'}</span>
          </button>
        </div>

        {/* Selected Tags */}
        <div className="km-compare-chips">
          {selectedLocations.map((loc) => (
            <span key={loc.unit.id} className="km-compare-chip">
              <strong>{loc.unit.name}</strong> ({loc.unit.id})
              <button
                type="button"
                className="km-chip-del-btn"
                onClick={() => handleRemoveLocation(loc.unit.id)}
                title={cmpT.remove_loc || 'Remove location'}
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      </div>

      {/* Side-by-Side Small Multiples Cards */}
      <div className="km-container km-compare-grid">
        {loading ? (
          <div className="km-loading-box">
            <div className="km-spinner"></div>
            <p>{t.common?.loading || 'Gathering multi-location forecasts...'}</p>
          </div>
        ) : selectedLocations.length === 0 ? (
          <div className="km-empty-card">
            <h4>{cmpT.no_locations || 'No Panchayats Selected'}</h4>
            <p>{cmpT.select_panchayat_placeholder || 'Use the selector above to add panchayats to the comparison matrix.'}</p>
          </div>
        ) : (
          selectedLocations.map((loc) => {
            const totalRain = loc.strip.reduce((acc, s) => acc + (s.rainfall?.prediction || 0), 0);
            const peakRain = Math.max(...loc.strip.map((s) => s.rainfall?.prediction || 0), 0);

            return (
              <div key={loc.unit.id} className="km-compare-card">
                <div className="km-cc-header">
                  <div>
                    <h3 className="km-cc-title">{loc.unit.name}</h3>
                    <span className="km-cc-id">{loc.unit.id} · {loc.unit.block_id || 'Block'}</span>
                  </div>
                  <button
                    type="button"
                    className="km-cc-close"
                    onClick={() => handleRemoveLocation(loc.unit.id)}
                    title={cmpT.remove_loc || 'Remove'}
                  >
                    <X size={14} />
                  </button>
                </div>

                <div className="km-cc-kpis">
                  <div className="km-cc-kpi">
                    <span className="km-cc-klabel">{t.insights?.kpi_mean_rain || '5-Day Total Rain'}</span>
                    <span className="km-cc-knum">{totalRain.toFixed(1)} mm</span>
                  </div>
                  <div className="km-cc-kpi">
                    <span className="km-cc-klabel">{t.insights?.kpi_max_rain || 'Peak Day'}</span>
                    <span className="km-cc-knum">{peakRain.toFixed(1)} mm</span>
                  </div>
                </div>

                {/* 5-day mini strip */}
                <div className="km-cc-strip">
                  {loc.strip.map((s, idx) => (
                    <div key={idx} className="km-cc-strip-item">
                      <span className="km-cc-sdate">{formatDateLocale(s.date, lang).split(' ')[0]}</span>
                      <span className="km-cc-srain">{(s.rainfall?.prediction || 0).toFixed(1)} mm</span>
                      <span className="km-cc-sprob">{Math.round((s.rainfall?.rain_probability || 0) * 100)}%</span>
                      <span className="km-cc-stemp">{(s.temp_max?.prediction || 30).toFixed(0)}° / {(s.temp_min?.prediction || 20).toFixed(0)}°</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Comparison Matrix Table */}
      {selectedLocations.length > 0 && (
        <div className="km-container km-compare-table-container">
          <h3 className="km-section-title">{cmpT.page_title || 'Comparative Numerical Matrix'}</h3>
          <table className="km-table">
            <thead>
              <tr>
                <th>{cmpT.col_location || 'Location'}</th>
                <th>{cmpT.col_block || 'Block'}</th>
                {selectedLocations[0]?.strip.map((s, i) => (
                  <th key={i} className="km-text-right">
                    Day +{i + 1} ({formatDateLocale(s.date, lang).split(' ')[0]})
                  </th>
                ))}
                <th className="km-text-right">5-Day Total</th>
              </tr>
            </thead>
            <tbody>
              {selectedLocations.map((loc) => {
                const total = loc.strip.reduce((acc, s) => acc + (s.rainfall?.prediction || 0), 0);
                return (
                  <tr key={loc.unit.id}>
                    <td className="km-cell-bold">{loc.unit.name} ({loc.unit.id})</td>
                    <td className="km-cell-muted">{loc.unit.block_id || 'Block'}</td>
                    {loc.strip.map((s, i) => (
                      <td key={i} className="km-text-right km-cell-num">
                        <strong>{(s.rainfall?.prediction || 0).toFixed(1)} mm</strong>
                        <div className="km-text-muted" style={{ fontSize: '11px' }}>
                          {Math.round((s.rainfall?.rain_probability || 0) * 100)}% | {(s.temp_max?.prediction || 30).toFixed(0)}°C
                        </div>
                      </td>
                    ))}
                    <td className="km-text-right km-cell-num km-cell-bold">
                      {total.toFixed(1)} mm
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
