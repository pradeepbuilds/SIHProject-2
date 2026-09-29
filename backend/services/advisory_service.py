from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from backend.services.inference_service import inference_service
from advisory.rule_engine import rule_engine


class AdvisoryService:
    def get_advisories(
        self,
        location_id: str,
        crop: Optional[str] = "ragi",
        stage: Optional[str] = "flowering",
        date_str: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        if not date_str:
            date_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
            
        rain_pred, _ = inference_service.get_prediction_for_location(location_id, date_str, "rainfall")
        temp_pred, _ = inference_service.get_prediction_for_location(location_id, date_str, "temp_max")
        
        rain_val = rain_pred["prediction"] if rain_pred else 15.0
        temp_val = temp_pred["prediction"] if temp_pred else 31.0
        unc_label = rain_pred.get("uncertainty_label", "medium") if rain_pred else "medium"
        horizon = rain_pred.get("horizon_days", 1) if rain_pred else 1
        
        now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        
        # Evaluate rules via the advisory rule engine
        return rule_engine.evaluate(
            rainfall_mm=rain_val,
            temp_max_c=temp_val,
            horizon_days=horizon,
            days_since_last_rain=6 if rain_val < 2.0 else 0,
            crop_name=crop or "ragi",
            stage_name=stage or "flowering",
            uncertainty_label=unc_label,
            issued_at=now_iso
        )


advisory_service = AdvisoryService()
