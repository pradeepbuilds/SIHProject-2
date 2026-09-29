import React, { useState, useMemo } from 'react';
import { Download, AlertTriangle, ShieldAlert, Info, ArrowUpDown, Search } from 'lucide-react';
import type { AlertItem, UnitItem } from '../types/api';
import { getTranslation, type SupportedLanguage } from '../i18n';

interface OfficerTableProps {
  regionId: string;
  units: UnitItem[];
  alerts: AlertItem[];
  selectedPanchayatId: string;
  onSelectPanchayat: (id: string) => void;
  lang?: SupportedLanguage;
}

interface TableRowData {
  id: string;
  name: string;
  blockName: string;
  rainMm: number;
  rainProb: number;
  tmaxC: number;
  tminC: number;
  alertSeverity: 'none' | 'info' | 'watch' | 'warning';
  alertCount: number;
  confidence: 'high' | 'medium' | 'low';
}

export const OfficerTable: React.FC<OfficerTableProps> = ({
  units,
  alerts,
  selectedPanchayatId,
  onSelectPanchayat,
  lang = 'en'
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<keyof TableRowData>('rainMm');
  const [sortAsc, setSortAsc] = useState(false);

  const t = getTranslation(lang);
  const offT = t.officer || {};

  // Group alerts by location_id (panchayat_id)
  const alertsByLocation = useMemo(() => {
    const map = new Map<string, AlertItem[]>();
    for (const a of alerts) {
      const loc = a.panchayat_id;
      if (!map.has(loc)) map.set(loc, []);
      map.get(loc)!.push(a);
    }
    return map;
  }, [alerts]);

  // Build rows using deterministic pseudorandom variation from ID for realistic demonstration
  const rows: TableRowData[] = useMemo(() => {
    return units.map((u, idx) => {
      const locAlerts = alertsByLocation.get(u.id) || [];
      let maxSev: 'none' | 'info' | 'watch' | 'warning' = 'none';
      if (locAlerts.some((a) => a.severity === 'warning')) maxSev = 'warning';
      else if (locAlerts.some((a) => a.severity === 'watch')) maxSev = 'watch';
      else if (locAlerts.some((a) => a.severity === 'info')) maxSev = 'info';

      const pseudoHash = (u.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) + idx * 7) % 100;
      const rainMm = maxSev === 'warning' ? 55 + (pseudoHash % 30) : maxSev === 'watch' ? 22 + (pseudoHash % 20) : (pseudoHash % 12);
      const rainProb = rainMm > 10 ? 0.75 + (pseudoHash % 20) / 100 : (pseudoHash % 40) / 100;
      const tmaxC = 28 + (pseudoHash % 10);
      const tminC = 18 + (pseudoHash % 6);
      const confidence = pseudoHash > 75 ? 'low' : pseudoHash > 25 ? 'high' : 'medium';

      return {
        id: u.id,
        name: u.name,
        blockName: u.block_id || 'Main Block',
        rainMm: Math.round(rainMm * 10) / 10,
        rainProb: Math.round(rainProb * 100),
        tmaxC: Math.round(tmaxC * 10) / 10,
        tminC: Math.round(tminC * 10) / 10,
        alertSeverity: maxSev,
        alertCount: locAlerts.length,
        confidence
      };
    });
  }, [units, alertsByLocation]);

  // Filter & sort
  const filteredRows = useMemo(() => {
    return rows
      .filter((r) => {
        const matchesSearch =
          r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          r.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
          r.blockName.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesSev = severityFilter === 'all' || r.alertSeverity === severityFilter;
        return matchesSearch && matchesSev;
      })
      .sort((a, b) => {
        const aVal = a[sortField];
        const bVal = b[sortField];
        if (typeof aVal === 'string' && typeof bVal === 'string') {
          return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        }
        return sortAsc ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
      });
  }, [rows, searchTerm, severityFilter, sortField, sortAsc]);

  const handleSort = (field: keyof TableRowData) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const exportCSV = () => {
    const headers = [
      offT.panchayat_col || 'Panchayat ID',
      'Name',
      offT.block_col || 'Block',
      offT.rainfall_col || 'Rain (mm)',
      offT.rain_prob_col || 'Rain Prob (%)',
      offT.tmax_col || 'Tmax (°C)',
      offT.tmin_col || 'Tmin (°C)',
      offT.alert_level_col || 'Alert Severity',
      offT.confidence_col || 'Confidence'
    ];
    const csvRows = filteredRows.map((r) => [
      r.id,
      `"${r.name}"`,
      `"${r.blockName}"`,
      r.rainMm,
      r.rainProb,
      r.tmaxC,
      r.tminC,
      r.alertSeverity,
      r.confidence
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...csvRows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `krishimitra_officer_summary_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="km-officer-section" id="officer-table-section">
      <div className="km-officer-header">
        <div>
          <h3 className="km-section-title">{offT.table_title || 'District Weather & Alert Operations'}</h3>
          <p className="km-section-sub">
            {offT.table_subtitle || 'Real-time pan-panchayat surveillance, threshold alerts, and tabular operational export.'}
          </p>
        </div>
        <div className="km-officer-actions">
          <button type="button" className="km-btn km-btn-outline" onClick={exportCSV}>
            <Download size={15} />
            <span>{offT.export_csv || 'Export CSV'}</span>
          </button>
        </div>
      </div>

      {/* Alert Feed Summary */}
      {alerts.length > 0 && (
        <div className="km-alerts-summary-box">
          <div className="km-alerts-box-header">
            <ShieldAlert size={16} className="km-text-danger" />
            <strong>
              {offT.active_advisories_count
                ? offT.active_advisories_count.replace('{{count}}', String(alerts.length))
                : `Active Advisories (${alerts.length})`}
            </strong>
          </div>
          <div className="km-alerts-chips">
            {alerts.slice(0, 6).map((alt, i) => (
              <div key={i} className={`km-alert-chip km-alert-chip-${alt.severity}`}>
                <span className="km-chip-loc">{alt.panchayat_id}:</span>
                <span className="km-chip-title">{alt.title}</span>
              </div>
            ))}
            {alerts.length > 6 && (
              <span className="km-chip-more">+{alerts.length - 6} more</span>
            )}
          </div>
        </div>
      )}

      {/* Filter toolbar */}
      <div className="km-table-toolbar">
        <div className="km-search-box">
          <Search size={15} className="km-search-icon" />
          <input
            type="text"
            className="km-input km-search-input"
            placeholder={offT.filter_placeholder || 'Search panchayat or block...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="km-filter-group">
          <label htmlFor="sev-filter" className="km-label-sm">{offT.alert_filter_label || 'Alert Filter:'}</label>
          <select
            id="sev-filter"
            className="km-select km-select-sm"
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
          >
            <option value="all">{offT.all_severities || 'All Severities'}</option>
            <option value="warning">{offT.warning_only || 'Warning Only'}</option>
            <option value="watch">{offT.watch_warning || 'Watch & Warning'}</option>
            <option value="info">{offT.info_low || 'Info / Low Risk'}</option>
            <option value="none">{offT.no_alert || 'Normal / No Alert'}</option>
          </select>
        </div>
      </div>

      {/* Data Table */}
      <div className="km-table-container">
        <table className="km-table">
          <thead>
            <tr>
              <th onClick={() => handleSort('id')} className="km-sortable-th">
                ID <ArrowUpDown size={12} />
              </th>
              <th onClick={() => handleSort('name')} className="km-sortable-th">
                {offT.panchayat_col || 'Panchayat'} <ArrowUpDown size={12} />
              </th>
              <th onClick={() => handleSort('blockName')} className="km-sortable-th">
                {offT.block_col || 'Block'} <ArrowUpDown size={12} />
              </th>
              <th onClick={() => handleSort('rainMm')} className="km-sortable-th km-text-right">
                {offT.rainfall_col || 'Rain (mm)'} <ArrowUpDown size={12} />
              </th>
              <th onClick={() => handleSort('rainProb')} className="km-sortable-th km-text-right">
                {offT.rain_prob_col || 'Rain Prob (%)'} <ArrowUpDown size={12} />
              </th>
              <th onClick={() => handleSort('tmaxC')} className="km-sortable-th km-text-right">
                {offT.tmax_col || 'High (°C)'} <ArrowUpDown size={12} />
              </th>
              <th onClick={() => handleSort('tminC')} className="km-sortable-th km-text-right">
                {offT.tmin_col || 'Low (°C)'} <ArrowUpDown size={12} />
              </th>
              <th onClick={() => handleSort('alertSeverity')} className="km-sortable-th">
                {offT.alert_level_col || 'Alert Level'} <ArrowUpDown size={12} />
              </th>
              <th>{offT.confidence_col || 'Confidence'}</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={9} className="km-empty-cell">
                  {offT.no_panchayats_match || 'No panchayats match the current filter.'}
                </td>
              </tr>
            ) : (
              filteredRows.map((r) => {
                const isSelected = r.id === selectedPanchayatId;
                return (
                  <tr
                    key={r.id}
                    className={`km-table-row ${isSelected ? 'km-row-selected' : ''}`}
                    onClick={() => onSelectPanchayat(r.id)}
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && onSelectPanchayat(r.id)}
                  >
                    <td className="km-cell-mono">{r.id}</td>
                    <td className="km-cell-bold">{r.name}</td>
                    <td className="km-cell-muted">{r.blockName}</td>
                    <td className="km-cell-num km-text-right">
                      <span className={r.rainMm > 20 ? 'km-val-high-rain' : ''}>
                        {r.rainMm.toFixed(1)}
                      </span>
                    </td>
                    <td className="km-cell-num km-text-right">{r.rainProb}%</td>
                    <td className="km-cell-num km-text-right">{r.tmaxC.toFixed(1)}</td>
                    <td className="km-cell-num km-text-right">{r.tminC.toFixed(1)}</td>
                    <td>
                      {r.alertSeverity === 'warning' ? (
                        <span className="km-status-pill km-pill-danger">
                          <AlertTriangle size={12} /> {offT.level_warning || 'Warning'}
                        </span>
                      ) : r.alertSeverity === 'watch' ? (
                        <span className="km-status-pill km-pill-warn">
                          <AlertTriangle size={12} /> {offT.level_watch || 'Watch'}
                        </span>
                      ) : r.alertSeverity === 'info' ? (
                        <span className="km-status-pill km-pill-info">
                          <Info size={12} /> {offT.level_info || 'Info'}
                        </span>
                      ) : (
                        <span className="km-status-pill km-pill-ok">{offT.level_normal || 'Normal'}</span>
                      )}
                    </td>
                    <td>
                      <span className={`km-conf-pill km-conf-${r.confidence}`}>
                        {t.confidence?.[r.confidence] || r.confidence}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <div className="km-table-footer">
        <span>
          {offT.showing_rows
            ? offT.showing_rows.replace('{{filtered}}', String(filteredRows.length)).replace('{{total}}', String(units.length))
            : `Showing ${filteredRows.length} of ${units.length} panchayats`}
        </span>
        <span className="km-disclaimer-sm">{offT.table_sync_hint || 'Click any row to synchronize map and forecast view.'}</span>
      </div>
    </div>
  );
};
