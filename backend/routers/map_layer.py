from datetime import datetime, timezone
from typing import Optional, Dict, Any
from fastapi import APIRouter, Query, Response
from backend.services.multi_region_service import multi_region_service

router = APIRouter(prefix="/map", tags=["Map"])


@router.get("/layer")
def get_map_layer(
    region_id: str = Query("ka-tumakuru", description="Region identifier"),
    variable: str = Query("rainfall", description="Target variable: rainfall, temp_max, temp_min, temperature_max, temperature_min"),
    date: Optional[str] = Query(None, description="Date YYYY-MM-DD"),
    level: str = Query("panchayat", pattern="^(district|block|panchayat)$", description="Geographic level: block, panchayat"),
    mode: str = Query("downscaled", pattern="^(coarse|downscaled|difference)$", description="Display mode"),
    response: Response = None
) -> Dict[str, Any]:
    if response:
        response.headers["Cache-Control"] = "public, max-age=300"
    if not date:
        date = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    # If level is district, fallback to block
    actual_level = "block" if level in ["district", "block"] else "panchayat"
    return multi_region_service.get_map_layer(
        region_id=region_id,
        date_str=date,
        variable=variable,
        level=actual_level,
        mode=mode
    )
