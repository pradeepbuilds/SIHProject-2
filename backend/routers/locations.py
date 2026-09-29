from typing import List, Optional
from fastapi import APIRouter, Query, HTTPException
from backend.schemas.location import DistrictOut, BlockOut, PanchayatOut
from backend.services.data_provider import data_provider

router = APIRouter(tags=["Locations"])


@router.get("/districts", response_model=List[DistrictOut])
def get_districts():
    return data_provider.get_districts()


@router.get("/blocks", response_model=List[BlockOut])
def get_blocks(district_id: Optional[str] = Query(None, description="Filter by District ID")):
    return data_provider.get_blocks(district_id=district_id)


@router.get("/panchayats", response_model=List[PanchayatOut])
def get_panchayats(block_id: Optional[str] = Query(None, description="Filter by Block ID")):
    return data_provider.get_panchayats(block_id=block_id)
