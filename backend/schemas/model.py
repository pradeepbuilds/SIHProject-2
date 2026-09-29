from typing import Dict, Any, Optional
from pydantic import BaseModel


class ModelInfoOut(BaseModel):
    active_versions: Dict[str, str]
    training_window: str
    feature_schema_hash: Optional[str] = None


class TrainJobResponse(BaseModel):
    job_id: str
    status: str
