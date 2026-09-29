from typing import List, Optional
from fastapi import APIRouter, Query, Response
from backend.services.multi_region_service import multi_region_service

router = APIRouter(tags=["Scenarios"])


@router.get("/scenarios")
def get_scenarios(
    region_id: str = Query("ka-tumakuru", description="Region identifier"),
    response: Response = None
):
    if response:
        response.headers["Cache-Control"] = "public, max-age=600"
    return multi_region_service.get_scenarios(region_id)
