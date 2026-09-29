from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Query, Response, HTTPException
from backend.services.multi_region_service import multi_region_service

router = APIRouter(tags=["Advisory"])


@router.get("/crops")
def get_crops_catalog(response: Response = None) -> Dict[str, Any]:
    if response:
        response.headers["Cache-Control"] = "public, max-age=3600"
    return multi_region_service.get_crops()


@router.get("/advisory/alerts")
def get_advisory_alerts(
    region_id: str = Query("ka-tumakuru", description="Region identifier"),
    date: Optional[str] = Query(None, description="Target date (YYYY-MM-DD)"),
    lang: str = Query("en", description="Language code: en, hi, kn, mr"),
    response: Response = None
) -> List[Dict[str, Any]]:
    if response:
        response.headers["Cache-Control"] = "public, max-age=300"
    if not date:
        date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    return multi_region_service.get_alerts(region_id, date, lang=lang)


@router.get("/advisory/{location_id}")
def get_location_advisory(
    location_id: str,
    date: Optional[str] = Query(None, description="Date in YYYY-MM-DD format"),
    crop: Optional[str] = Query("ragi", description="Crop name"),
    stage: Optional[str] = Query(None, description="Crop stage name"),
    lang: str = Query("en", description="Language code: en, hi, kn, mr"),
    region_id: Optional[str] = Query(None, description="Optional region ID"),
    response: Response = None
) -> List[Dict[str, Any]]:
    if response:
        response.headers["Cache-Control"] = "public, max-age=300"
    if not date:
        date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    return multi_region_service.get_advisories(
        location_id=location_id,
        date_str=date,
        crop=crop or "ragi",
        stage=stage,
        lang=lang,
        region_id=region_id
    )


# Backward-compatible query-param endpoint
@router.get("/advisory")
def get_advisories_legacy(
    location_id: str = Query(..., description="Panchayat / Grid ID"),
    crop: Optional[str] = Query("ragi", description="Crop name"),
    stage: Optional[str] = Query(None, description="Crop stage name"),
    date: Optional[str] = Query(None, description="Date in YYYY-MM-DD format"),
    lang: str = Query("en", description="Language code"),
    response: Response = None
) -> List[Dict[str, Any]]:
    if response:
        response.headers["Cache-Control"] = "public, max-age=300"
    if not date:
        date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    return multi_region_service.get_advisories(
        location_id=location_id,
        date_str=date,
        crop=crop or "ragi",
        stage=stage,
        lang=lang
    )
