from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Query, HTTPException
from backend.schemas.weather import ForecastOut
from backend.services.data_provider import data_provider

router = APIRouter(prefix="/weather", tags=["Weather"])


@router.get("/forecast", response_model=ForecastOut)
def get_weather_forecast(
    block_id: str = Query(..., description="Block identifier e.g. BLK-KA-001"),
    date: Optional[str] = Query(None, description="Forecast target date YYYY-MM-DD")
):
    if not date:
        date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        
    forecast = data_provider.get_forecast(block_id, date)
    if not forecast:
        raise HTTPException(status_code=404, detail=f"No forecast found for block {block_id}")
        
    return forecast
