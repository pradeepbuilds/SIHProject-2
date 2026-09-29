from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query, Response
from backend.services.multi_region_service import multi_region_service
from backend.schemas.region import RegionSummary, RegionDetail, UnitHierarchyItem

router = APIRouter(tags=["Regions"])


@router.get("/regions", response_model=List[RegionSummary])
def list_regions(response: Response):
    response.headers["Cache-Control"] = "public, max-age=600"
    return multi_region_service.list_regions()


@router.get("/regions/{region_id}", response_model=RegionDetail)
def get_region_detail(region_id: str, response: Response):
    response.headers["Cache-Control"] = "public, max-age=600"
    detail = multi_region_service.get_region_detail(region_id)
    if not detail:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "region_not_found", "message": f"Region '{region_id}' does not exist"}}
        )
    return detail


@router.get("/regions/{region_id}/units", response_model=List[UnitHierarchyItem])
def get_region_units(
    region_id: str,
    level: str = Query("panchayat", pattern="^(block|panchayat)$", description="Administrative unit level"),
    response: Response = None
):
    if response:
        response.headers["Cache-Control"] = "public, max-age=600"
    if region_id not in multi_region_service.configs:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "region_not_found", "message": f"Region '{region_id}' not found"}}
        )
    return multi_region_service.get_units(region_id, level=level)
