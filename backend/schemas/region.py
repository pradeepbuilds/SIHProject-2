from typing import List, Dict, Any, Optional
from pydantic import BaseModel


class RegionSummary(BaseModel):
    region_id: str
    id_prefix: str
    state: str
    district: str
    agro_climatic_zone: str
    languages: List[str]
    main_crops: List[str]
    data_mode: Dict[str, str]
    horizon_days: Dict[str, int]
    bbox: Dict[str, float]
    attribution: str


class RegionDetail(RegionSummary):
    boundary: Dict[str, Any]
    climatology: Dict[str, Any]
    alert_thresholds: Dict[str, Any]
    district_geojson: Optional[Dict[str, Any]] = None


class UnitHierarchyItem(BaseModel):
    id: str
    name: str
    level: str
    region_id: str
    block_id: Optional[str] = None
    boundary_is_official: bool = False
    geometry: Optional[Dict[str, Any]] = None
