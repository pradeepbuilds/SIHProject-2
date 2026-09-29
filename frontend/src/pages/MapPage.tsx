import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { MapView } from '../components/MapView';
import { ForecastCard } from '../components/ForecastCard';
import { ScenarioBar } from '../components/ScenarioBar';
import { OfficerTable } from '../components/OfficerTable';
import { OnDemandModal } from '../components/OnDemandModal';
import {
  fetchUnits,
  fetchMapLayer,
  fetchPrediction,
  fetchAdvisories,
  fetchAlerts,
  fetchScenarios,
  fetchRegionDetail
} from '../services/api';
import type {
  UnitItem,
  GeoJSONFeatureCollection,
  PredictionResponse,
  Advisory,
  AlertItem,
  ScenarioItem,
  RegionDetail
} from '../types/api';
import { getTranslation, type SupportedLanguage } from '../i18n';

interface MapPageProps {
  currentRegionId: string;
  lang: SupportedLanguage;
  userView: 'farmer' | 'officer';
  onSelectRegion: (regionId: string) => void;
  isOnDemandOpen: boolean;
  onCloseOnDemand: () => void;
}

export const MapPage: React.FC<MapPageProps> = ({
  currentRegionId,
  lang,
  userView,
  isOnDemandOpen,
  onCloseOnDemand
}) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // URL state synchronization
  const selectedUnit = searchParams.get('unit') || 'PNC-KA-0001';
  const selectedVariable = searchParams.get('var') || 'rainfall';
  const selectedDate = searchParams.get('date') || '2026-05-15';
  const selectedMode = (searchParams.get('mode') || 'downscaled') as 'coarse' | 'downscaled' | 'difference';

  // Data states
  const [regionDetail, setRegionDetail] = useState<RegionDetail | null>(null);
  const [units, setUnits] = useState<UnitItem[]>([]);
  const [mapData, setMapData] = useState<GeoJSONFeatureCollection | null>(null);
  const [prediction, setPrediction] = useState<PredictionResponse | null>(null);
  const [advisories, setAdvisories] = useState<Advisory[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [scenarios, setScenarios] = useState<ScenarioItem[]>([]);
  const [selectedCrop, setSelectedCrop] = useState<string>('ragi');
  const [activeScenarioId, setActiveScenarioId] = useState<string | undefined>(undefined);

  // Loading states
  const [mapLoading, setMapLoading] = useState(false);

  const t = getTranslation(lang);

  // Update query params helper
  const updateQuery = (key: string, val: string) => {
    const next = new URLSearchParams(searchParams);
    next.set(key, val);
    setSearchParams(next, { replace: true });
  };

  // Load Region Detail, Units, and Scenarios
  useEffect(() => {
    async function loadMeta() {
      try {
        const [rData, uList, scList, aList] = await Promise.all([
          fetchRegionDetail(currentRegionId).catch(() => null),
          fetchUnits(currentRegionId, 'panchayat').catch(() => []),
          fetchScenarios(currentRegionId).catch(() => []),
          fetchAlerts(currentRegionId, selectedDate).catch(() => [])
        ]);
        setRegionDetail(rData);
        setUnits(uList);
        setScenarios(scList);
        setAlerts(aList);

        if (rData && rData.main_crops && rData.main_crops.length > 0) {
          setSelectedCrop(rData.main_crops[0]);
        }

        // Set default unit if none selected or unit does not belong to region
        if (uList.length > 0) {
          const currentUnitValid = uList.some((u) => u.id === selectedUnit);
          if (!selectedUnit || !currentUnitValid) {
            updateQuery('unit', uList[0].id);
          }
        }
      } catch (err) {
        console.error('Error loading region metadata:', err);
      }
    }
    loadMeta();
  }, [currentRegionId]);

  // Load Map Layer
  useEffect(() => {
    async function loadLayer() {
      setMapLoading(true);
      try {
        const data = await fetchMapLayer(
          selectedVariable,
          selectedDate,
          'panchayat',
          currentRegionId,
          selectedMode
        );
        setMapData(data);
      } catch (err) {
        console.error('Error loading map layer:', err);
      } finally {
        setMapLoading(false);
      }
    }
    loadLayer();
  }, [currentRegionId, selectedVariable, selectedDate, selectedMode]);

  // Load Prediction & Advisories for Selected Panchayat
  useEffect(() => {
    if (!selectedUnit) return;
    async function loadPredictionAndAdvisories() {
      try {
        const [pred, advs] = await Promise.all([
          fetchPrediction(selectedUnit, selectedVariable, selectedDate, currentRegionId).catch(() => null),
          fetchAdvisories(selectedUnit, selectedCrop, lang, selectedDate, currentRegionId).catch(() => [])
        ]);
        setPrediction(pred);
        setAdvisories(advs);
      } catch (err) {
        console.error('Error loading prediction:', err);
      }
    }
    loadPredictionAndAdvisories();
  }, [selectedUnit, selectedVariable, selectedDate, selectedCrop, currentRegionId, lang]);

  const handleSelectScenario = (sc: ScenarioItem) => {
    setActiveScenarioId(sc.id);
    const next = new URLSearchParams(searchParams);
    next.set('date', sc.date);
    if (sc.event_type.includes('heat') || sc.event_type.includes('cold')) {
      next.set('var', sc.event_type.includes('heat') ? 'temperature_max' : 'temperature_min');
    } else {
      next.set('var', 'rainfall');
    }
    if (sc.suggested_panchayat) {
      next.set('unit', sc.suggested_panchayat);
    }
    setSearchParams(next, { replace: true });
  };

  const selectedUnitName = units.find((u) => u.id === selectedUnit)?.name || selectedUnit;

  return (
    <div className="km-page km-map-page">
      {/* Scenario Presets Banner */}
      <ScenarioBar
        scenarios={scenarios}
        onSelectScenario={handleSelectScenario}
        activeScenarioId={activeScenarioId}
        lang={lang}
      />

      {/* Main Map Toolbar & Controls */}
      <div className="km-map-toolbar">
        <div className="km-container km-toolbar-inner">
          {/* Mode Selector */}
          <div className="km-mode-selector" role="radiogroup" aria-label="Map Display Mode">
            <button
              type="button"
              className={`km-mode-btn ${selectedMode === 'coarse' ? 'active' : ''}`}
              onClick={() => updateQuery('mode', 'coarse')}
            >
              {t.map_controls?.mode_coarse || 'Block forecast'}
            </button>
            <button
              type="button"
              className={`km-mode-btn ${selectedMode === 'downscaled' ? 'active' : ''}`}
              onClick={() => updateQuery('mode', 'downscaled')}
            >
              {t.map_controls?.mode_downscaled || 'KrishiMitra local estimate'}
            </button>
            <button
              type="button"
              className={`km-mode-btn ${selectedMode === 'difference' ? 'active' : ''}`}
              onClick={() => updateQuery('mode', 'difference')}
            >
              {t.map_controls?.mode_difference || 'Difference'}
            </button>
          </div>

          {/* Variable, Date and Unit Selectors */}
          <div className="km-control-bar">
            {/* Variable */}
            <div className="km-field">
              <label htmlFor="var-select" className="km-label-sm">Variable</label>
              <select
                id="var-select"
                className="km-select km-select-sm"
                value={selectedVariable}
                onChange={(e) => updateQuery('var', e.target.value)}
              >
                <option value="rainfall">Rainfall (mm)</option>
                <option value="temperature_max">Max Temp (°C)</option>
                <option value="temperature_min">Min Temp (°C)</option>
              </select>
            </div>

            {/* Date */}
            <div className="km-field">
              <label htmlFor="date-input" className="km-label-sm">Date</label>
              <input
                id="date-input"
                type="date"
                className="km-input km-input-sm"
                value={selectedDate}
                onChange={(e) => updateQuery('date', e.target.value)}
              />
            </div>

            {/* Panchayat Quick Selector */}
            <div className="km-field">
              <label htmlFor="unit-select" className="km-label-sm">Panchayat</label>
              <select
                id="unit-select"
                className="km-select km-select-sm km-select-unit"
                value={selectedUnit}
                onChange={(e) => updateQuery('unit', e.target.value)}
              >
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.id})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Main Map + Forecast Layout */}
      <div className="km-container km-map-layout">
        {/* Map View */}
        <div className="km-map-column">
          <MapView
            geoJsonData={mapData}
            regionDetail={regionDetail}
            mode={selectedMode}
            variable={selectedVariable}
            selectedPanchayatId={selectedUnit}
            onSelectPanchayat={(id) => updateQuery('unit', id)}
            onMapClickCoords={() => {}}
            loading={mapLoading}
            lang={lang}
          />
        </div>

        {/* Forecast Card Column */}
        <div className="km-forecast-column">
          <ForecastCard
            prediction={prediction}
            selectedPanchayatId={selectedUnit}
            selectedPanchayatName={selectedUnitName}
            selectedCrop={selectedCrop}
            onSelectCrop={setSelectedCrop}
            availableCrops={regionDetail?.main_crops || ['ragi']}
            advisories={advisories}
            date={selectedDate}
            lang={lang}
            userView={userView}
            regionId={currentRegionId}
            onOpenBulletin={() => navigate(`/bulletin?region_id=${currentRegionId}&date=${selectedDate}&lang=${lang}&location_id=${selectedUnit}`)}
          />
        </div>
      </div>

      {/* Officer View Multi-Panchayat Table & Alerts */}
      {userView === 'officer' && (
        <div className="km-container km-officer-container">
          <OfficerTable
            regionId={currentRegionId}
            units={units}
            alerts={alerts}
            selectedPanchayatId={selectedUnit}
            onSelectPanchayat={(id) => updateQuery('unit', id)}
            lang={lang}
          />
        </div>
      )}

      {/* On-Demand Point Query Modal */}
      <OnDemandModal
        isOpen={isOnDemandOpen}
        onClose={onCloseOnDemand}
        defaultDate={selectedDate}
      />
    </div>
  );
};
