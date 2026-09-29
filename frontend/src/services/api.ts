import type {
  RegionSummary,
  RegionDetail,
  UnitItem,
  PredictionResponse,
  StripItem,
  PredictionExplanation,
  Advisory,
  AlertItem,
  ScenarioItem,
  AnalyticsSummary,
  TimelineItem,
  ForecastEvolutionItem,
  SkillByHorizonItem,
  CalibrationReport,
  FeatureImportanceItem,
  ClimatologyItem,
  BlockOutlookItem,
  GeoJSONFeatureCollection
} from '../types/api';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

export async function fetchHealth(): Promise<{ status: string }> {
  const res = await fetch(`${API_BASE}/health`);
  if (!res.ok) throw new Error('Health check failed');
  return res.json();
}

export async function fetchRegions(): Promise<RegionSummary[]> {
  const res = await fetch(`${API_BASE}/regions`);
  if (!res.ok) throw new Error('Failed to fetch regions');
  return res.json();
}

export async function fetchRegionDetail(regionId: string): Promise<RegionDetail> {
  const res = await fetch(`${API_BASE}/regions/${regionId}`);
  if (!res.ok) throw new Error(`Failed to fetch region detail for ${regionId}`);
  return res.json();
}

export async function fetchUnits(regionId: string, level: 'block' | 'panchayat' = 'panchayat'): Promise<UnitItem[]> {
  const res = await fetch(`${API_BASE}/regions/${regionId}/units?level=${level}`);
  if (!res.ok) throw new Error(`Failed to fetch units for ${regionId}`);
  return res.json();
}

export async function fetchMapLayer(
  variable: string = 'rainfall',
  date: string,
  level: string = 'panchayat',
  regionId: string = 'ka-tumakuru',
  mode: 'coarse' | 'downscaled' | 'difference' = 'downscaled'
): Promise<GeoJSONFeatureCollection> {
  const url = `${API_BASE}/map/layer?region_id=${regionId}&variable=${variable}&date=${date}&level=${level}&mode=${mode}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch map layer');
  return res.json();
}

export async function fetchPrediction(
  locationId: string,
  variable: string = 'rainfall',
  date?: string,
  regionId?: string,
  forecastDate?: string
): Promise<PredictionResponse> {
  let url = `${API_BASE}/prediction/${locationId}?variable=${variable}`;
  if (date) url += `&date=${date}`;
  if (regionId) url += `&region_id=${regionId}`;
  if (forecastDate) url += `&forecast_date=${forecastDate}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch prediction for ${locationId}`);
  return res.json();
}

export async function fetchPredictionStrip(
  locationId: string,
  start: string,
  days: number = 5,
  regionId?: string
): Promise<StripItem[]> {
  let url = `${API_BASE}/prediction/${locationId}/strip?start=${start}&days=${days}`;
  if (regionId) url += `&region_id=${regionId}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch prediction strip for ${locationId}`);
  return res.json();
}

export async function fetchPredictionExplain(
  locationId: string,
  date: string,
  variable: string = 'rainfall',
  regionId?: string
): Promise<PredictionExplanation> {
  let url = `${API_BASE}/prediction/${locationId}/explain?date=${date}&variable=${variable}`;
  if (regionId) url += `&region_id=${regionId}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch explanation for ${locationId}`);
  return res.json();
}

export async function postOnDemandPrediction(
  latitude: number,
  longitude: number,
  variable: string,
  date: string,
  regionId?: string
): Promise<PredictionResponse> {
  const body: any = { latitude, longitude, variable, date };
  if (regionId) body.region_id = regionId;
  const res = await fetch(`${API_BASE}/prediction`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const msg = errData?.error?.message || errData?.detail?.error?.message || 'Prediction failed';
    throw new Error(msg);
  }
  return res.json();
}

export async function fetchCrops(): Promise<Record<string, { name: string; stages: Record<string, { heat_max_c: number; min_moisture_pct: number }> }>> {
  const res = await fetch(`${API_BASE}/crops`);
  if (!res.ok) throw new Error('Failed to fetch crops catalog');
  return res.json();
}

export async function fetchAdvisories(
  locationId: string,
  crop: string = 'ragi',
  lang: string = 'en',
  date?: string,
  regionId?: string,
  stage?: string
): Promise<Advisory[]> {
  let url = `${API_BASE}/advisory/${locationId}?crop=${encodeURIComponent(crop)}&lang=${lang}`;
  if (date) url += `&date=${date}`;
  if (regionId) url += `&region_id=${regionId}`;
  if (stage) url += `&stage=${encodeURIComponent(stage)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch advisories');
  return res.json();
}

export async function fetchAlerts(regionId: string, date?: string, lang: string = 'en'): Promise<AlertItem[]> {
  let url = `${API_BASE}/advisory/alerts?region_id=${regionId}&lang=${lang}`;
  if (date) url += `&date=${date}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch alerts');
  return res.json();
}

export async function fetchScenarios(regionId: string): Promise<ScenarioItem[]> {
  const res = await fetch(`${API_BASE}/scenarios?region_id=${regionId}`);
  if (!res.ok) throw new Error('Failed to fetch scenarios');
  return res.json();
}

export async function fetchAnalyticsSummary(regionId: string, date?: string): Promise<AnalyticsSummary> {
  let url = `${API_BASE}/analytics/summary?region_id=${regionId}`;
  if (date) url += `&date=${date}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch analytics summary');
  return res.json();
}

export async function fetchAnalyticsTimeline(
  locationId: string,
  variable: string = 'rainfall',
  start?: string,
  end?: string,
  horizon: number = 1
): Promise<TimelineItem[]> {
  let url = `${API_BASE}/analytics/timeline?location_id=${locationId}&variable=${variable}&horizon=${horizon}`;
  if (start) url += `&start=${start}`;
  if (end) url += `&end=${end}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch timeline');
  return res.json();
}

export async function fetchForecastEvolution(
  locationId: string,
  variable: string = 'rainfall',
  targetDate?: string
): Promise<ForecastEvolutionItem[]> {
  let url = `${API_BASE}/analytics/forecast-evolution?location_id=${locationId}&variable=${variable}`;
  if (targetDate) url += `&target_date=${targetDate}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch forecast evolution');
  return res.json();
}

export async function fetchSkillByHorizon(regionId: string, variable: string = 'rainfall'): Promise<SkillByHorizonItem[]> {
  const res = await fetch(`${API_BASE}/analytics/skill-by-horizon?region_id=${regionId}&variable=${variable}`);
  if (!res.ok) throw new Error('Failed to fetch skill by horizon');
  return res.json();
}

export async function fetchCalibration(regionId: string, variable: string = 'rainfall'): Promise<CalibrationReport> {
  const res = await fetch(`${API_BASE}/analytics/calibration?region_id=${regionId}&variable=${variable}`);
  if (!res.ok) throw new Error('Failed to fetch calibration report');
  return res.json();
}

export async function fetchSpatialSkill(regionId: string, variable: string = 'rainfall'): Promise<GeoJSONFeatureCollection> {
  const res = await fetch(`${API_BASE}/analytics/spatial-skill?region_id=${regionId}&variable=${variable}`);
  if (!res.ok) throw new Error('Failed to fetch spatial skill layer');
  return res.json();
}

export async function fetchFeatureImportance(regionId: string, variable: string = 'rainfall'): Promise<FeatureImportanceItem[]> {
  const res = await fetch(`${API_BASE}/analytics/feature-importance?region_id=${regionId}&variable=${variable}`);
  if (!res.ok) throw new Error('Failed to fetch feature importance');
  return res.json();
}

export async function fetchClimatology(
  regionId: string,
  variable: string = 'rainfall',
  start?: string,
  end?: string
): Promise<ClimatologyItem[]> {
  let url = `${API_BASE}/analytics/climatology?region_id=${regionId}&variable=${variable}`;
  if (start) url += `&start=${start}`;
  if (end) url += `&end=${end}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch climatology');
  return res.json();
}

export async function fetchOutlook(regionId: string, variable: string = 'rainfall', date?: string): Promise<BlockOutlookItem[]> {
  let url = `${API_BASE}/analytics/outlook?region_id=${regionId}&variable=${variable}`;
  if (date) url += `&date=${date}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch block outlook');
  return res.json();
}

export async function fetchMetrics(regionId: string): Promise<any> {
  const res = await fetch(`${API_BASE}/metrics/${regionId}`);
  if (!res.ok) throw new Error(`Failed to fetch metrics for ${regionId}`);
  return res.json();
}
