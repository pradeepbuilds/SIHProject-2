import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, X, Download } from 'lucide-react';
import { fetchUnits, fetchPredictionStrip } from '../services/api';
import type { UnitItem, StripItem } from '../types/api';

interface ComparePageProps {
  currentRegionId: string;
}

interface LocationComparison {
  unit: UnitItem;
  strip: StripItem[];
}

export const ComparePage: React.FC<ComparePageProps> = ({ currentRegionId }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [units, setUnits] = useState<UnitItem[]>([]);
  const [selectedLocations, setSelectedLocations] = useState<LocationComparison[]>([]);
  const [selectedUnitToAdd, setSelectedUnitToAdd] = useState<string>('');
  const [loading, setLoading] = useState(false);

  // URL state
  const locParams = searchParams.get('locs') ? searchParams.get('locs')!.split(',') : [];

  // Load units
  useEffect(() => {
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
      alert('You can compare a maximum of 5 locations simultaneously.');
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
    const headers = ['Panchayat ID', 'Name', 'Block', ...dates.map((d) => `Rain ${d} (mm)`)];
    const rows = selectedLocations.map((loc) => [
      loc.unit.id,
      `"${loc.unit.name}"`,
      `"${loc.unit.block_id || ''}"`,
      ...loc.strip.map((s) => (s.rainfall?.prediction || 0).toFixed(1))
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
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
          <h2 className="km-page-title">Multi-Panchayat Weather Comparison</h2>
          <p className="km-page-sub">
            Side-by-side contrast of downscaled forecasts across up to 5 panchayats or blocks.
          </p>
        </div>

        <div className="km-header-actions">
          <button type="button" className="km-btn km-btn-outline" onClick={exportComparisonCSV}>
            <Download size={15} />
            <span>Export Comparison CSV</span>
          </button>
        </div>
      </div>

      {/* Location Picker Toolbar */}
      <div className="km-container km-compare-toolbar">
        <div className="km-picker-row">
          <div className="km-field">
            <label htmlFor="cmp-add" className="km-label-sm">Add Panchayat to Comparison:</label>
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
            <span>Add to Compare</span>
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
                title="Remove location"
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
            <p>Gathering multi-location forecasts...</p>
          </div>
        ) : selectedLocations.length === 0 ? (
          <div className="km-empty-card">
            <h4>No Panchayats Selected</h4>
            <p>Use the selector above to add panchayats to the comparison matrix.</p>
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
                  >
                    <X size={14} />
                  </button>
                </div>

                <div className="km-cc-kpis">
                  <div className="km-cc-kpi">
                    <span className="km-cc-klabel">5-Day Total Rain</span>
                    <span className="km-cc-knum">{totalRain.toFixed(1)} mm</span>
                  </div>
                  <div className="km-cc-kpi">
                    <span className="km-cc-klabel">Peak Day</span>
                    <span className="km-cc-knum">{peakRain.toFixed(1)} mm</span>
                  </div>
                </div>

                {/* 5-day mini strip */}
                <div className="km-cc-strip">
                  {loc.strip.map((s, idx) => (
                    <div key={idx} className="km-cc-strip-item">
                      <span className="km-cc-sdate">{s.date.slice(5)}</span>
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
          <h3 className="km-section-title">Comparative Numerical Matrix</h3>
          <table className="km-table">
            <thead>
              <tr>
                <th>Location</th>
                <th>Block</th>
                {selectedLocations[0]?.strip.map((s, i) => (
                  <th key={i} className="km-text-right">
                    Day +{i + 1} ({s.date.slice(5)})
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
                          {Math.round((s.rainfall?.rain_probability || 0) * 100)}% rain | {(s.temp_max?.prediction || 30).toFixed(0)}°C
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
