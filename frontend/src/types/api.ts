export interface RegionSummary {
  region_id: string;
  id_prefix: string;
  state: string;
  district: string;
  agro_climatic_zone: string;
  languages: string[];
  main_crops: string[];
  data_mode: {
    boundaries_district: string;
    boundaries_sub_units: string;
    terrain: string;
    weather: string;
  };
  horizon_days: {
    min: number;
    max: number;
  };
  bbox: {
    min_lat: number;
    max_lat: number;
    min_lon: number;
    max_lon: number;
  };
  attribution: string;
}

export interface RegionDetail extends RegionSummary {
  boundary: {
    source: string;
    license: string;
    attribution: string;
    sub_units: Record<string, any>;
  };
  climatology: {
    source?: string;
    tmax_c?: number[];
    tmin_c?: number[];
    rain_mm?: number[];
    wet_day_prob?: number[];
  };
  alert_thresholds: {
    heavy_rain_mm: number;
    heat_c: number;
    cold_c: number;
    dry_spell_days: number;
  };
  district_geojson?: any;
}

export interface UnitItem {
  id: string;
  name: string;
  level: 'block' | 'panchayat';
  region_id: string;
  block_id?: string;
  boundary_is_official: boolean;
  geometry?: any;
}

export interface UncertaintyInterval {
  p10: number;
  p50: number;
  p90: number;
}

export interface CoarseReference {
  block_id: string;
  value: number;
  data_source_tag: string;
  is_synthetic: boolean;
}

export interface BaselineReference {
  method: string;
  value: number;
  data_source_tag: string;
  diff_from_baseline: number;
}

export interface PredictionResponse {
  location_id: string;
  location_name?: string;
  region_id?: string;
  variable: string;
  unit?: string;
  forecast_date: string;
  target_date: string;
  date?: string;
  horizon_days: number;
  prediction: number;
  value?: number;
  uncertainty_interval: UncertaintyInterval;
  uncertainty_label: 'low' | 'medium' | 'high';
  interval_width?: number;
  data_source_tag: string;
  is_synthetic: boolean;
  coarse_reference: CoarseReference;
  baseline: BaselineReference;
  model_version: string;
  data_mode?: Record<string, string>;
  rain_probability?: number;
  wet_amount_p10?: number;
  wet_amount_p50?: number;
  wet_amount_p90?: number;
  rainfall_mm?: number;
  rain_category?: 'unlikely' | 'possible' | 'likely';
  snapped_grid_id?: string;
  snap_distance_km?: number;
  snap_distance_m?: number;
}

export interface StripItem {
  date: string;
  day_offset: number;
  rainfall: PredictionResponse;
  temp_max: PredictionResponse;
  temp_min: PredictionResponse;
}

export interface ExplanationContribution {
  feature: string;
  label: string;
  value: any;
  unit: string;
  contribution: number;
  impact: 'positive' | 'negative' | 'neutral';
}

export interface PredictionExplanation {
  location_id: string;
  date: string;
  variable: string;
  base_value: number;
  prediction: number;
  coarse_value: number;
  contributions: ExplanationContribution[];
  verification_sum: number;
}

export interface Advisory {
  rule_id: string;
  title: string;
  message: string;
  severity: 'info' | 'watch' | 'warning';
  confidence: 'low' | 'medium' | 'high';
  confidence_phrase?: string;
  trigger_inputs?: Record<string, any>;
  disclaimer: string;
  issued_at: string;
  crop?: string;
  stage?: string;
  confidence_level?: string;
}

export interface AlertItem {
  panchayat_id: string;
  panchayat_name: string;
  block_id: string;
  severity: 'info' | 'watch' | 'warning';
  rule_id: string;
  title: string;
  message: string;
  confidence: string;
}

export interface ScenarioItem {
  id: string;
  label: string;
  event_type: string;
  date: string;
  suggested_panchayat: string;
  peak_value: number;
  is_synthetic: boolean;
}

export interface AnalyticsSummary {
  region_id: string;
  date: string;
  mean_rainfall_5d_mm: number;
  max_rainfall_5d_mm: number;
  panchayats_in_alert_count: number;
  heavy_rain_alerts_count: number;
  heat_or_cold_alerts_count: number;
  advisories_issued_count: number;
  ml_improvement_pct: number;
  temp_improvement_pct: number;
  interval_coverage_pct: number;
  data_mode: Record<string, string>;
  synthetic_world_caveat: string;
}

export interface TimelineItem {
  date: string;
  coarse: number;
  p10: number;
  p50: number;
  p90: number;
  observed?: number;
}

export interface ForecastEvolutionItem {
  horizon: number;
  issue_date: string;
  target_date: string;
  p10: number;
  p50: number;
  p90: number;
  coarse: number;
  observed: number;
}

export interface SkillByHorizonItem {
  horizon: number;
  baseline_mae: number;
  ml_mae: number;
  baseline_rmse: number;
  ml_rmse: number;
  bias: number;
}

export interface CalibrationReport {
  coverage_p10_p90: number;
  tail_rate_p10: number;
  tail_rate_p90: number;
  target_coverage: number;
  verdict: string;
  reliability_points: Array<{
    quantile: number;
    observed_frequency: number;
  }>;
}

export interface FeatureImportanceItem {
  feature: string;
  label: string;
  gain: number;
}

export interface ClimatologyItem {
  date: string;
  climatological_norm: number;
  observed_or_forecast: number;
  anomaly: number;
}

export interface BlockOutlookItem {
  block_id: string;
  block_name: string;
  accumulated_5d?: number;
  mean_5d?: number;
  variable: string;
  unit: string;
}

export interface GeoJSONFeature {
  type: 'Feature';
  geometry: any;
  properties: {
    id: string;
    name: string;
    block_id?: string;
    variable?: string;
    unit?: string;
    value: number;
    coarse_value?: number;
    downscaled_value?: number;
    diff_value?: number;
    rain_probability?: number;
    uncertainty_label?: string;
    boundary_is_official?: boolean;
    data_mode?: Record<string, string>;
    is_test_location?: boolean;
    baseline_mae?: number;
    ml_mae?: number;
    improvement_pct?: number;
  };
}

export interface GeoJSONFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
  notice?: string;
  data_mode?: Record<string, string>;
}
