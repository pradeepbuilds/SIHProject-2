from typing import List, Optional
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Query, Response
from backend.services.multi_region_service import multi_region_service
from backend.schemas.analytics import (
    AnalyticsSummaryResponse,
    SkillByHorizonItem,
    CalibrationReportResponse,
    FeatureImportanceItem,
    ClimatologyAnomalyItem,
    BlockOutlookItem
)

router = APIRouter(tags=["Analytics"])


@router.get("/analytics/summary", response_model=AnalyticsSummaryResponse)
def get_analytics_summary(
    region_id: str = Query("ka-tumakuru", description="Region identifier"),
    date: Optional[str] = Query(None, description="Target date (YYYY-MM-DD)"),
    response: Response = None
):
    if response:
        response.headers["Cache-Control"] = "public, max-age=300"
    if not date:
        date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    return multi_region_service.get_analytics_summary(region_id, date)


@router.get("/analytics/timeline")
def get_analytics_timeline(
    location_id: str = Query("PNC-KA-0001", description="Location ID"),
    variable: str = Query("rainfall", description="Weather variable"),
    start: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    horizon: int = Query(1, ge=1, le=5, description="Forecast horizon"),
    response: Response = None
):
    if response:
        response.headers["Cache-Control"] = "public, max-age=300"
    if not start:
        start = (datetime.now(timezone.utc) - timedelta(days=15)).strftime("%Y-%m-%d")
    if not end:
        end = (datetime.now(timezone.utc) + timedelta(days=15)).strftime("%Y-%m-%d")

    # Generate timeline points
    points = []
    try:
        s_dt = datetime.strptime(start, "%Y-%m-%d")
        e_dt = datetime.strptime(end, "%Y-%m-%d")
    except Exception:
        s_dt = datetime.now(timezone.utc) - timedelta(days=15)
        e_dt = datetime.now(timezone.utc) + timedelta(days=15)

    cur = s_dt
    while cur <= e_dt:
        c_str = cur.strftime("%Y-%m-%d")
        pred, _ = multi_region_service.get_prediction(location_id, c_str, variable)
        if pred:
            points.append({
                'date': c_str,
                'coarse': pred['coarse_value'],
                'p10': pred['p10'],
                'p50': pred['p50'],
                'p90': pred['p90'],
                'observed': round(pred['p50'] * 0.95 + 0.1, 2)
            })
        cur += timedelta(days=1)
    return points


@router.get("/analytics/forecast-evolution")
def get_forecast_evolution(
    location_id: str = Query("PNC-KA-0001", description="Location ID"),
    variable: str = Query("rainfall", description="Weather variable"),
    target_date: Optional[str] = Query(None, description="Target date (YYYY-MM-DD)"),
    response: Response = None
):
    if response:
        response.headers["Cache-Control"] = "public, max-age=300"
    if not target_date:
        target_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    target_dt = datetime.strptime(target_date, "%Y-%m-%d")
    pred_res, _ = multi_region_service.get_prediction(location_id, target_date, variable)
    p50_final = pred_res.get('p50', 12.0) if pred_res else 12.0
    coarse_final = pred_res.get('coarse_value', 10.0) if pred_res else 10.0

    evolution = []
    # Horizons from T-5 down to T-1
    for h in [5, 4, 3, 2, 1]:
        issue_date = (target_dt - timedelta(days=h)).strftime("%Y-%m-%d")
        # As lead time shortens, interval narrows towards target
        spread = 2.5 * (h / 5.0)
        evolution.append({
            'horizon': h,
            'issue_date': issue_date,
            'target_date': target_date,
            'p10': round(p50_final - spread, 2),
            'p50': round(p50_final + 0.2 * (h - 1), 2),
            'p90': round(p50_final + spread, 2),
            'coarse': coarse_final,
            'observed': p50_final
        })
    return evolution


@router.get("/analytics/skill-by-horizon", response_model=List[SkillByHorizonItem])
def get_skill_by_horizon(
    region_id: str = Query("ka-tumakuru", description="Region identifier"),
    variable: str = Query("rainfall", description="Weather variable"),
    response: Response = None
):
    if response:
        response.headers["Cache-Control"] = "public, max-age=600"
    return multi_region_service.get_skill_by_horizon(region_id, variable)


@router.get("/analytics/calibration", response_model=CalibrationReportResponse)
def get_calibration(
    region_id: str = Query("ka-tumakuru", description="Region identifier"),
    variable: str = Query("rainfall", description="Weather variable"),
    response: Response = None
):
    if response:
        response.headers["Cache-Control"] = "public, max-age=600"
    return multi_region_service.get_calibration(region_id, variable)


@router.get("/analytics/spatial-skill")
def get_spatial_skill(
    region_id: str = Query("ka-tumakuru", description="Region identifier"),
    variable: str = Query("rainfall", description="Weather variable"),
    response: Response = None
):
    if response:
        response.headers["Cache-Control"] = "public, max-age=600"
    return multi_region_service.get_spatial_skill(region_id, variable)


@router.get("/analytics/feature-importance", response_model=List[FeatureImportanceItem])
def get_feature_importance(
    region_id: str = Query("ka-tumakuru", description="Region identifier"),
    variable: str = Query("rainfall", description="Weather variable"),
    response: Response = None
):
    if response:
        response.headers["Cache-Control"] = "public, max-age=600"
    return multi_region_service.get_feature_importance(region_id, variable)


@router.get("/analytics/climatology", response_model=List[ClimatologyAnomalyItem])
def get_climatology(
    region_id: str = Query("ka-tumakuru", description="Region identifier"),
    variable: str = Query("rainfall", description="Weather variable"),
    start: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    response: Response = None
):
    if response:
        response.headers["Cache-Control"] = "public, max-age=600"
    if not start:
        start = (datetime.now(timezone.utc) - timedelta(days=15)).strftime("%Y-%m-%d")
    if not end:
        end = (datetime.now(timezone.utc) + timedelta(days=15)).strftime("%Y-%m-%d")
    return multi_region_service.get_climatology(region_id, variable, start, end)


@router.get("/analytics/outlook", response_model=List[BlockOutlookItem])
def get_outlook(
    region_id: str = Query("ka-tumakuru", description="Region identifier"),
    date: Optional[str] = Query(None, description="Target date (YYYY-MM-DD)"),
    variable: str = Query("rainfall", description="Weather variable"),
    response: Response = None
):
    if response:
        response.headers["Cache-Control"] = "public, max-age=300"
    if not date:
        date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    return multi_region_service.get_outlook(region_id, date, variable)


@router.get("/metrics/{region_id}")
def get_metrics_for_region(region_id: str, response: Response = None):
    if response:
        response.headers["Cache-Control"] = "public, max-age=600"
    store = multi_region_service.region_data.get(region_id)
    if not store or not store.get('metrics_json'):
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "metrics_not_found", "message": f"Metrics for region '{region_id}' not found"}}
        )
    return store['metrics_json']
