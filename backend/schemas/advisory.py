from typing import Optional
from pydantic import BaseModel


class AdvisoryOut(BaseModel):
    rule_id: str
    message: str
    uncertainty_label: str
    crop: Optional[str] = None
    stage: Optional[str] = None
    issued_at: str
