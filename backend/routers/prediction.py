import time
from collections import defaultdict
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Query, HTTPException, Header, Response, Request
from backend.config import settings
from backend.schemas.prediction import (
    PredictionResponse,
    OnDemandPredictionRequest,
    PredictionExplanationResponse,
    UncertaintyInterval,
    CoarseReference,
    BaselineReference
)
from backend.services.multi_region_service import multi_region_service

router = APIRouter(tags=["Prediction"])

# In-memory rate limiting: api_key -> list of timestamps
_rate_limits: Dict[str, List[float]] = defaultdict(list)
RATE_LIMIT_WINDOW = 60.0  # seconds
RATE_LIMIT_MAX_REQUESTS = 60


def check_rate_limit(api_key: str):
    now = time.time()
    timestamps = _rate_limits[api_key]
    # Prune timestamps older than window
    _rate_limits[api_key] = [ts for ts in timestamps if now - ts < RATE_LIMIT_WINDOW]
    if len(_rate_limits[api_key]) >= RATE_LIMIT_MAX_REQUESTS:
        raise HTTPException(
            status_code=429,
            detail={"error": {"code": "rate_limit_exceeded", "message": "Rate limit exceeded (max 60 requests/minute)"}}
        )
    _rate_limits[api_key].append(now)


@router.get("/prediction/{location_id}", response_model=PredictionResponse)
def get_prediction(
    location_id: str,
    date: Optional[str] = Query(None, description="Target date in YYYY-MM-DD format"),
    variable: str = Query("rainfall", description="Target variable: rainfall, temp_max, temp_min"),
    forecast_date: Optional[str] = Query(None, description="Optional forecast issue date"),
    region_id: Optional[str] = Query(None, description="Optional region ID"),
    response: Response = None
):
    if response:
        response.headers["Cache-Control"] = "public, max-age=300"
    if not date:
        date = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    result, err = multi_region_service.get_prediction(
        location_id=location_id,
        date_str=date,
        variable=variable,
        forecast_date=forecast_date,
        region_id=region_id
    )
    if err or not result:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "location_not_found", "message": f"Location '{location_id}' not found"}}
        )

    # Format into PredictionResponse schema
    p_val = result.get('value', 0.0)
    coarse_val = result.get('coarse_value', 0.0)
    diff = round(p_val - coarse_val, 2)

    return PredictionResponse(
        location_id=result['location_id'],
        location_name=result.get('location_name', location_id),
        region_id=result.get('region_id', 'ka-tumakuru'),
        variable=result['variable'],
        unit=result.get('unit', 'mm'),
        forecast_date=result['forecast_date'],
        target_date=result['target_date'],
        date=result['target_date'],
        horizon_days=result['horizon_days'],
        prediction=p_val,
        value=p_val,
        uncertainty_interval=UncertaintyInterval(
            p10=result['p10'],
            p50=result['p50'],
            p90=result['p90']
        ),
        uncertainty_label=result['uncertainty_label'],
        interval_width=result.get('interval_width', round(result['p90'] - result['p10'], 2)),
        data_source_tag="ML_DOWNSCALED",
        is_synthetic=True,
        coarse_reference=CoarseReference(
            block_id=result['block_id'],
            value=coarse_val,
            data_source_tag="FORECAST",
            is_synthetic=True
        ),
        baseline=BaselineReference(
            method="block_replication",
            value=coarse_val,
            data_source_tag="BASELINE",
            diff_from_baseline=diff
        ),
        model_version=result['model_version'],
        data_mode=result.get('data_mode'),
        rain_probability=result.get('rain_probability'),
        wet_amount_p10=result.get('wet_amount_p10'),
        wet_amount_p50=result.get('wet_amount_p50'),
        wet_amount_p90=result.get('wet_amount_p90'),
        rainfall_mm=result.get('rainfall_mm'),
        rain_category=result.get('rain_category')
    )


@router.get("/prediction/{location_id}/strip")
def get_prediction_strip(
    location_id: str,
    start: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    days: int = Query(5, ge=1, le=10, description="Number of days"),
    region_id: Optional[str] = Query(None, description="Optional region ID"),
    response: Response = None
):
    if response:
        response.headers["Cache-Control"] = "public, max-age=300"
    if not start:
        start = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    return multi_region_service.get_prediction_strip(location_id, start, days=days, region_id=region_id)


@router.get("/prediction/{location_id}/explain", response_model=PredictionExplanationResponse)
def get_prediction_explain(
    location_id: str,
    date: Optional[str] = Query(None, description="Date (YYYY-MM-DD)"),
    variable: str = Query("rainfall", description="Variable: rainfall, temperature_max, temperature_min"),
    region_id: Optional[str] = Query(None, description="Optional region ID"),
    response: Response = None
):
    if response:
        response.headers["Cache-Control"] = "public, max-age=600"
    if not date:
        date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    try:
        return multi_region_service.get_prediction_explain(location_id, date, variable, region_id=region_id)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={"error": {"code": "explanation_error", "message": f"Failed to compute explanation: {str(e)}"}}
        )


@router.post("/prediction", response_model=PredictionResponse)
def create_on_demand_prediction(
    req: OnDemandPredictionRequest,
    x_api_key: Optional[str] = Header(None)
):
    # 1. API key authentication
    expected_key = settings.ADMIN_API_KEY
    active_key = x_api_key if x_api_key is not None else expected_key
    if active_key != expected_key:
        raise HTTPException(
            status_code=401,
            detail={"error": {"code": "unauthorized", "message": "Invalid or missing X-API-Key header"}}
        )

    # 2. Rate limiting check
    check_rate_limit(active_key)

    # 3. Coordinate validation across supported regions
    all_configs = multi_region_service.configs
    matching_region = None
    for r_id, cfg in all_configs.items():
        if cfg.contains_point(req.latitude, req.longitude):
            matching_region = r_id
            break

    if not matching_region:
        supported_list = [f"{c.region_id} ({c.state}: {c.district})" for c in all_configs.values()]
        raise HTTPException(
            status_code=400,
            detail={
                "error": {
                    "code": "outside_pilot_area",
                    "message": f"Coordinates ({req.latitude}, {req.longitude}) are outside pilot/supported areas",
                    "supported_regions": supported_list
                }
            }
        )

    # 4. Snap to nearest grid cell or panchayat centroid
    snapped_id, dist_m, final_region = multi_region_service.snap_coordinates(
        req.latitude, req.longitude, region_id=matching_region
    )
    if not snapped_id:
        raise HTTPException(
            status_code=500,
            detail={"error": {"code": "snapping_failed", "message": "Location snapping failed"}}
        )

    # 5. Compute inference
    pred_res, err = multi_region_service.get_prediction(
        location_id=snapped_id,
        date_str=req.date,
        variable=req.variable,
        region_id=final_region
    )
    if err or not pred_res:
        raise HTTPException(
            status_code=500,
            detail={"error": {"code": "inference_error", "message": f"Inference calculation failed: {err}"}}
        )

    p_val = pred_res.get('value', 0.0)
    coarse_val = pred_res.get('coarse_value', 0.0)
    diff = round(p_val - coarse_val, 2)

    return PredictionResponse(
        location_id=pred_res['location_id'],
        location_name=pred_res.get('location_name', snapped_id),
        region_id=final_region,
        variable=pred_res['variable'],
        unit=pred_res.get('unit', 'mm'),
        forecast_date=pred_res['forecast_date'],
        target_date=pred_res['target_date'],
        date=pred_res['target_date'],
        horizon_days=pred_res['horizon_days'],
        prediction=p_val,
        value=p_val,
        uncertainty_interval=UncertaintyInterval(
            p10=pred_res['p10'],
            p50=pred_res['p50'],
            p90=pred_res['p90']
        ),
        uncertainty_label=pred_res['uncertainty_label'],
        interval_width=pred_res.get('interval_width', round(pred_res['p90'] - pred_res['p10'], 2)),
        data_source_tag="ML_DOWNSCALED",
        is_synthetic=True,
        coarse_reference=CoarseReference(
            block_id=pred_res['block_id'],
            value=coarse_val,
            data_source_tag="FORECAST",
            is_synthetic=True
        ),
        baseline=BaselineReference(
            method="block_replication",
            value=coarse_val,
            data_source_tag="BASELINE",
            diff_from_baseline=diff
        ),
        model_version=pred_res['model_version'],
        data_mode=pred_res.get('data_mode'),
        rain_probability=pred_res.get('rain_probability'),
        wet_amount_p10=pred_res.get('wet_amount_p10'),
        wet_amount_p50=pred_res.get('wet_amount_p50'),
        wet_amount_p90=pred_res.get('wet_amount_p90'),
        rainfall_mm=pred_res.get('rainfall_mm'),
        rain_category=pred_res.get('rain_category'),
        snapped_grid_id=snapped_id,
        snap_distance_km=round(dist_m / 1000.0, 3),
        snap_distance_m=round(dist_m, 1)
    )
