from typing import List, Dict, Any, Optional
from pydantic import BaseModel


class AnalyticsSummaryResponse(BaseModel):
    region_id: str
    date: str
    mean_rainfall_5d_mm: float
    max_rainfall_5d_mm: float
    panchayats_in_alert_count: int
    heavy_rain_alerts_count: int
    heat_or_cold_alerts_count: int
    advisories_issued_count: int
    ml_improvement_pct: float
    temp_improvement_pct: float
    interval_coverage_pct: float
    data_mode: Dict[str, str]
    synthetic_world_caveat: str


class TimelinePoint(BaseModel):
    date: str
    coarse: float
    p10: float
    p50: float
    p90: float
    observed: Optional[float] = None


class SkillByHorizonItem(BaseModel):
    horizon: int
    baseline_mae: float
    ml_mae: float
    baseline_rmse: float
    ml_rmse: float
    bias: float


class CalibrationReportResponse(BaseModel):
    coverage_p10_p90: float
    tail_rate_p10: float
    tail_rate_p90: float
    target_coverage: float
    verdict: str
    reliability_points: List[Dict[str, float]]


class FeatureImportanceItem(BaseModel):
    feature: str
    label: str
    gain: float


class ClimatologyAnomalyItem(BaseModel):
    date: str
    climatological_norm: float
    observed_or_forecast: float
    anomaly: float


class BlockOutlookItem(BaseModel):
    block_id: str
    block_name: str
    accumulated_5d: Optional[float] = None
    mean_5d: Optional[float] = None
    variable: str
    unit: str
