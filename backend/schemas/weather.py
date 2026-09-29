from typing import Optional
from pydantic import BaseModel


class ForecastOut(BaseModel):
    block_id: str
    date: str
    rainfall_mm: float
    temp_max_c: float
    temp_min_c: float
    humidity_pct: float
    horizon_days: int = 1
    data_source_tag: str = "FORECAST"
    is_synthetic: bool = True
