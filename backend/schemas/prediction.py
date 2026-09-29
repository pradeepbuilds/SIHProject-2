from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field


class UncertaintyInterval(BaseModel):
    p10: float
    p50: float
    p90: float


class CoarseReference(BaseModel):
    block_id: str
    value: float
    data_source_tag: str = "FORECAST"
    is_synthetic: bool = True


class BaselineReference(BaseModel):
    method: str = "block_replication"
    value: float
    data_source_tag: str = "BASELINE"
    diff_from_baseline: float


class PredictionResponse(BaseModel):
    location_id: str
    location_name: Optional[str] = None
    region_id: Optional[str] = "ka-tumakuru"
    variable: str
    unit: Optional[str] = None
    forecast_date: str
    target_date: str
    date: Optional[str] = None
    horizon_days: int
    prediction: float
    value: Optional[float] = None
    uncertainty_interval: UncertaintyInterval
    uncertainty_label: str  # low | medium | high
    interval_width: Optional[float] = None
    data_source_tag: str = "ML_DOWNSCALED"
    is_synthetic: bool = True
    coarse_reference: CoarseReference
    baseline: BaselineReference
    model_version: str
    data_mode: Optional[Dict[str, Any]] = None
    
    # Hurdle fields for rainfall
    rain_probability: Optional[float] = None
    wet_amount_p10: Optional[float] = None
    wet_amount_p50: Optional[float] = None
    wet_amount_p90: Optional[float] = None
    rainfall_mm: Optional[float] = None
    rain_category: Optional[str] = None

    # Snapping info
    snapped_grid_id: Optional[str] = None
    snap_distance_km: Optional[float] = None
    snap_distance_m: Optional[float] = None


class OnDemandPredictionRequest(BaseModel):
    latitude: float = Field(..., description="Latitude in decimal degrees", ge=-90, le=90)
    longitude: float = Field(..., description="Longitude in decimal degrees", ge=-180, le=180)
    date: str = Field(..., description="Target date in YYYY-MM-DD format")
    variable: str = Field("rainfall", description="Target weather variable (rainfall, temp_max, temp_min)")
    region_id: Optional[str] = Field(None, description="Optional region ID")


class ExplanationContribution(BaseModel):
    feature: str
    label: str
    value: Optional[Any] = None
    unit: str
    contribution: float
    impact: str


class PredictionExplanationResponse(BaseModel):
    location_id: str
    date: str
    variable: str
    base_value: float
    prediction: float
    coarse_value: float
    contributions: List[ExplanationContribution]
    verification_sum: float
