import os
import json
import uuid
from datetime import datetime, timezone
from typing import Dict, Any, Optional
from fastapi import APIRouter, Header, HTTPException, status
from backend.config import settings
from backend.schemas.model import ModelInfoOut, TrainJobResponse

router = APIRouter(prefix="/model", tags=["Model"])

METRICS_FILE = os.path.join(os.path.dirname(__file__), '..', 'model_metrics.json')


@router.get("/info", response_model=ModelInfoOut)
def get_model_info():
    return {
        "active_versions": {
            "rainfall": "v0.1.0-lgbm",
            "temperature_max": "v0.1.0-lgbm",
            "temperature_min": "v0.1.0-lgbm"
        },
        "training_window": "2024-06-01/2026-06-01",
        "feature_schema_hash": "sha256-d41d8cd98f00b204e9800998ecf8427e"
    }


@router.get("/metrics")
def get_model_metrics() -> Dict[str, Any]:
    if not os.path.exists(METRICS_FILE):
        return {
            "temperature_max": {"status": "not_yet_evaluated", "baseline": None, "ml": None},
            "rainfall": {"status": "not_yet_evaluated", "baseline": None, "ml": None}
        }
    with open(METRICS_FILE, 'r') as f:
        return json.load(f)


@router.post("/train", response_model=TrainJobResponse, status_code=status.HTTP_202_ACCEPTED)
def trigger_training(
    x_api_key: Optional[str] = Header(None, description="Admin API Key for model retraining")
):
    if not x_api_key or x_api_key != settings.ADMIN_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized: Valid X-API-KEY header required to trigger model training."
        )
        
    job_id = f"train-{datetime.now(timezone.utc).strftime('%Y-%m-%d')}-{str(uuid.uuid4())[:8]}"
    return {
        "job_id": job_id,
        "status": "queued"
    }
