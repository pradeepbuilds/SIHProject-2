from typing import Optional, List, Any, Dict
from pydantic import BaseModel


class DistrictOut(BaseModel):
    id: str
    name: str
    state: str
    lgd_code: Optional[str] = None


class BlockOut(BaseModel):
    id: str
    district_id: str
    name: str
    lgd_code: Optional[str] = None
    geometry: Optional[Dict[str, Any]] = None


class PanchayatOut(BaseModel):
    id: str
    block_id: str
    name: str
    lgd_code: Optional[str] = None
    geometry: Optional[Dict[str, Any]] = None
    is_synthetic_boundary: bool = True
