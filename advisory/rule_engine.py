import os
import yaml
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional

RULES_FILE = os.path.join(os.path.dirname(__file__), 'rules.yaml')
RULES_V2_FILE = os.path.join(os.path.dirname(__file__), 'rules', 'rules_v2.yaml')
CROPS_FILE = os.path.join(os.path.dirname(__file__), 'crops.yaml')
MESSAGES_DIR = os.path.join(os.path.dirname(__file__), 'messages')

SEVERITY_DOWNGRADE = {
    'warning': 'watch',
    'watch': 'info',
    'info': 'info'
}

DEFAULT_ALERT_THRESHOLDS = {
    'heavy_rain_mm': 50.0,
    'heat_c': 38.0,
    'cold_c': 6.0,
    'dry_spell_days': 5
}


class RuleEngine:
    def __init__(self, rules_path: str = RULES_FILE, crops_path: str = CROPS_FILE):
        self.rules = []
        self.crops = {}
        self.messages: Dict[str, Dict[str, Any]] = {}
        self._load_configs(rules_path, crops_path)
        self._load_messages()

    def _load_configs(self, rules_path: str, crops_path: str):
        if os.path.exists(rules_path):
            with open(rules_path, 'r', encoding='utf-8') as f:
                data = yaml.safe_load(f)
                self.rules = data.get('rules', [])
        
        if os.path.exists(crops_path):
            with open(crops_path, 'r', encoding='utf-8') as f:
                data = yaml.safe_load(f)
                self.crops = data.get('crops', {})

    def _load_messages(self):
        if os.path.exists(MESSAGES_DIR):
            for lang_file in os.listdir(MESSAGES_DIR):
                if lang_file.endswith('.yaml') or lang_file.endswith('.yml'):
                    lang = lang_file.split('.')[0]
                    p = os.path.join(MESSAGES_DIR, lang_file)
                    try:
                        with open(p, 'r', encoding='utf-8') as f:
                            self.messages[lang] = yaml.safe_load(f) or {}
                    except Exception:
                        pass

    def get_crop_threshold(self, crop_name: str, stage_name: str) -> Dict[str, float]:
        norm_crop = (crop_name or 'ragi').lower()
        norm_stage = (stage_name or 'vegetative').lower()
        
        crop_data = self.crops.get(norm_crop, {})
        stages_data = crop_data.get('stages', {})
        stage_info = stages_data.get(norm_stage, {})
        
        return {
            "heat_max_c": float(stage_info.get("heat_max_c", 35.0)),
            "min_moisture_pct": float(stage_info.get("min_moisture_pct", 40.0))
        }

    def evaluate_rule_trigger(self, trigger_expr: str, eval_context: Dict[str, Any]) -> bool:
        try:
            return bool(eval(trigger_expr, {"__builtins__": None}, eval_context))
        except Exception:
            return False

    def evaluate(
        self,
        rainfall_mm: float = 0.0,
        temp_max_c: float = 30.0,
        temp_min_c: float = 20.0,
        horizon_days: int = 1,
        days_since_last_rain: int = 0,
        crop_name: str = "ragi",
        stage_name: str = "vegetative",
        uncertainty_label: str = "medium",
        issued_at: Optional[str] = None,
        # Hurdle / v2 parameters
        rain_probability: Optional[float] = None,
        rainfall_p90_mm: Optional[float] = None,
        tmax_p50: Optional[float] = None,
        tmin_p50: Optional[float] = None,
        rain_3d_sum: float = 0.0,
        rain_7d_sum: float = 0.0,
        region_thresholds: Optional[Dict[str, Any]] = None,
        lang: str = "en"
    ) -> List[Dict[str, Any]]:
        """
        Evaluates agricultural weather rules, returning explainable advisories
        with confidence gating, localized copy, and trigger provenance.
        """
        if not issued_at:
            issued_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

        if tmax_p50 is None:
            tmax_p50 = float(temp_max_c)
        if tmin_p50 is None:
            tmin_p50 = float(temp_min_c)
        if rainfall_p90_mm is None:
            rainfall_p90_mm = float(rainfall_mm)

        has_explicit_prob = (rain_probability is not None)
        effective_prob = rain_probability if has_explicit_prob else (0.85 if rainfall_mm >= 1.0 else 0.05)

        thresholds = region_thresholds or DEFAULT_ALERT_THRESHOLDS
        heavy_rain_mm = float(thresholds.get('heavy_rain_mm', 50.0))
        heat_c = float(thresholds.get('heat_c', 38.0))
        cold_c = float(thresholds.get('cold_c', 6.0))
        dry_spell_days = int(thresholds.get('dry_spell_days', 5))

        crop_thresh = self.get_crop_threshold(crop_name, stage_name)
        crop_heat_max = crop_thresh["heat_max_c"]

        norm_unc = (uncertainty_label or "medium").lower()

        # Select language dictionary
        msg_dict = self.messages.get(lang) or self.messages.get("en") or {}
        messages = msg_dict.get("messages", {})
        titles = msg_dict.get("titles", {})
        confidence_phrases = msg_dict.get("confidence_phrases", {
            "low": "Confident forecast",
            "medium": "Fairly confident",
            "high": "Forecast is uncertain; check again tomorrow."
        })
        disclaimer = msg_dict.get("disclaimer", "Illustrative advisory rules. Validate thresholds with your local KVK / agricultural university before real use.")

        triggered = []

        # 1. Heavy Rainfall (Legacy + Hurdle)
        if has_explicit_prob:
            is_heavy = (effective_prob >= 0.5 and rainfall_p90_mm >= heavy_rain_mm)
        else:
            is_heavy = (rainfall_mm >= heavy_rain_mm and horizon_days <= 1)
        if is_heavy:
            base_severity = "warning"
            sev = SEVERITY_DOWNGRADE[base_severity] if norm_unc == "high" else base_severity
            conf_phrase = confidence_phrases.get(norm_unc, "")
            
            raw_msg = messages.get(
                "heavy_rain_msg",
                f"Heavy rainfall (>= {heavy_rain_mm}mm) expected within 24h. Consider delaying irrigation; check drainage for low-lying fields."
            ).format(
                heavy_rain_mm=int(heavy_rain_mm),
                rain_probability_pct=int(round(effective_prob * 100))
            )
            
            if norm_unc == "high":
                msg = f"[Informational only — wide forecast uncertainty] {raw_msg} {conf_phrase}".strip()
            else:
                msg = raw_msg

            triggered.append({
                "rule_id": "heavy_rainfall_v1",
                "title": titles.get("heavy_rain_title", "Heavy Rainfall Advisory"),
                "severity": sev,
                "confidence": norm_unc,
                "confidence_phrase": conf_phrase,
                "message": msg,
                "trigger_inputs": {
                    "rain_probability": round(float(effective_prob), 3),
                    "rainfall_p90_mm": round(float(rainfall_p90_mm), 2),
                    "heavy_rain_threshold_mm": heavy_rain_mm,
                    "horizon_days": horizon_days
                },
                "disclaimer": disclaimer,
                "issued_at": issued_at
            })

        # 2. Irrigation Suggestion
        if has_explicit_prob:
            is_dry = (effective_prob < 0.2 and days_since_last_rain >= dry_spell_days)
        else:
            is_dry = (rainfall_mm < 2.0 and days_since_last_rain >= dry_spell_days)
        if is_dry:
            base_severity = "info"
            sev = SEVERITY_DOWNGRADE[base_severity] if norm_unc == "high" else base_severity
            conf_phrase = confidence_phrases.get(norm_unc, "")
            
            raw_msg = messages.get(
                "irrigation_msg",
                f"Low rainfall and dry spell detected ({days_since_last_rain} days). Consider scheduling irrigation if soil moisture is low."
            ).format(
                days_since_last_rain=days_since_last_rain,
                rain_probability_pct=int(round(effective_prob * 100))
            )

            if norm_unc == "high":
                msg = f"[Informational only — wide forecast uncertainty] {raw_msg} {conf_phrase}".strip()
            else:
                msg = raw_msg

            triggered.append({
                "rule_id": "irrigation_suggestion_v1",
                "title": titles.get("irrigation_title", "Irrigation Scheduling Advisory"),
                "severity": sev,
                "confidence": norm_unc,
                "confidence_phrase": conf_phrase,
                "message": msg,
                "trigger_inputs": {
                    "days_since_last_rain": days_since_last_rain,
                    "rain_probability": round(float(effective_prob), 3),
                    "rainfall_mm": round(float(rainfall_mm), 2),
                    "dry_spell_threshold_days": dry_spell_days
                },
                "disclaimer": disclaimer,
                "issued_at": issued_at
            })

        # 3. Heat Stress
        is_heat = (
            (tmax_p50 >= crop_heat_max and stage_name == "flowering") or
            (tmax_p50 >= heat_c)
        )
        if is_heat:
            base_severity = "warning"
            sev = SEVERITY_DOWNGRADE[base_severity] if norm_unc == "high" else base_severity
            conf_phrase = confidence_phrases.get(norm_unc, "")

            raw_msg = messages.get(
                "heat_stress_msg",
                f"Forecast max temperature exceeds the heat-stress threshold for this crop's {stage_name} stage."
            ).format(
                tmax_p50=round(tmax_p50, 1),
                stage_name=stage_name,
                crop_heat_max=round(crop_heat_max, 1),
                heat_c=heat_c
            )

            if norm_unc == "high":
                msg = f"[Informational only — wide forecast uncertainty] {raw_msg} {conf_phrase}".strip()
            else:
                msg = raw_msg

            triggered.append({
                "rule_id": "heat_stress_v1",
                "title": titles.get("heat_stress_title", "Heat Stress Advisory"),
                "severity": sev,
                "confidence": norm_unc,
                "confidence_phrase": conf_phrase,
                "message": msg,
                "trigger_inputs": {
                    "tmax_p50": round(float(tmax_p50), 1),
                    "crop_heat_max": crop_heat_max,
                    "regional_heat_threshold_c": heat_c,
                    "crop_stage": stage_name
                },
                "disclaimer": disclaimer,
                "issued_at": issued_at
            })

        # 4. Cold / Frost Risk
        if tmin_p50 <= cold_c:
            base_severity = "warning"
            sev = SEVERITY_DOWNGRADE[base_severity] if norm_unc == "high" else base_severity
            conf_phrase = confidence_phrases.get(norm_unc, "")

            raw_msg = messages.get(
                "cold_risk_msg",
                f"Minimum temperature dropping to {tmin_p50}°C. High risk of cold stress or frost."
            ).format(
                tmin_p50=round(tmin_p50, 1),
                cold_c=cold_c
            )

            if norm_unc == "high":
                msg = f"[Informational only — wide forecast uncertainty] {raw_msg} {conf_phrase}".strip()
            else:
                msg = raw_msg

            triggered.append({
                "rule_id": "cold_snap_v1",
                "title": titles.get("cold_risk_title", "Cold Wave & Frost Risk Advisory"),
                "severity": sev,
                "confidence": norm_unc,
                "confidence_phrase": conf_phrase,
                "message": msg,
                "trigger_inputs": {
                    "tmin_p50": round(float(tmin_p50), 1),
                    "cold_threshold_c": cold_c
                },
                "disclaimer": disclaimer,
                "issued_at": issued_at
            })

        # 5. Waterlogging / Drainage
        if rain_3d_sum >= 70.0:
            base_severity = "watch"
            sev = SEVERITY_DOWNGRADE[base_severity] if norm_unc == "high" else base_severity
            conf_phrase = confidence_phrases.get(norm_unc, "")

            raw_msg = messages.get(
                "waterlogging_msg",
                f"Cumulative 3-day rainfall reached {rain_3d_sum} mm. High risk of waterlogging."
            ).format(
                rain_3d_sum=round(rain_3d_sum, 1)
            )

            if norm_unc == "high":
                msg = f"[Informational only — wide forecast uncertainty] {raw_msg} {conf_phrase}".strip()
            else:
                msg = raw_msg

            triggered.append({
                "rule_id": "waterlogging_drainage_v1",
                "title": titles.get("waterlogging_title", "Waterlogging & Field Drainage Watch"),
                "severity": sev,
                "confidence": norm_unc,
                "confidence_phrase": conf_phrase,
                "message": msg,
                "trigger_inputs": {
                    "rain_3d_sum_mm": round(float(rain_3d_sum), 1),
                    "threshold_mm": 70.0
                },
                "disclaimer": disclaimer,
                "issued_at": issued_at
            })

        # 6. Spraying Window (Only if explicitly checking hurdle rain probability)
        if has_explicit_prob and rain_probability >= 0.4:
            base_severity = "watch"
            sev = SEVERITY_DOWNGRADE[base_severity] if norm_unc == "high" else base_severity
            conf_phrase = confidence_phrases.get(norm_unc, "")

            raw_msg = messages.get(
                "spraying_avoid_msg",
                f"High chance of rain ({int(round(rain_probability * 100))}%). Delay spraying operations."
            ).format(
                rain_probability_pct=int(round(rain_probability * 100))
            )

            if norm_unc == "high":
                msg = f"[Informational only — wide forecast uncertainty] {raw_msg} {conf_phrase}".strip()
            else:
                msg = raw_msg

            triggered.append({
                "rule_id": "spraying_window_v1",
                "title": titles.get("spraying_title", "Foliar Spraying Operation Advisory"),
                "severity": sev,
                "confidence": norm_unc,
                "confidence_phrase": conf_phrase,
                "message": msg,
                "trigger_inputs": {
                    "rain_probability": round(float(rain_probability), 3)
                },
                "disclaimer": disclaimer,
                "issued_at": issued_at
            })

        # 7. Sowing Moisture Window
        if rain_7d_sum >= 30.0 and stage_name in ["sowing", "nursery"]:
            base_severity = "info"
            sev = SEVERITY_DOWNGRADE[base_severity] if norm_unc == "high" else base_severity
            conf_phrase = confidence_phrases.get(norm_unc, "")

            raw_msg = messages.get(
                "sowing_window_msg",
                f"Adequate cumulative rainfall ({round(rain_7d_sum, 1)} mm) provides good soil moisture for field operations."
            ).format(
                rain_7d_sum=round(rain_7d_sum, 1)
            )

            if norm_unc == "high":
                msg = f"[Informational only — wide forecast uncertainty] {raw_msg} {conf_phrase}".strip()
            else:
                msg = raw_msg

            triggered.append({
                "rule_id": "sowing_window_v1",
                "title": titles.get("sowing_title", "Sowing & Seedbed Moisture Advisory"),
                "severity": sev,
                "confidence": norm_unc,
                "confidence_phrase": conf_phrase,
                "message": msg,
                "trigger_inputs": {
                    "rain_7d_sum_mm": round(float(rain_7d_sum), 1),
                    "crop_stage": stage_name
                },
                "disclaimer": disclaimer,
                "issued_at": issued_at
            })

        # 8. Fallback: General Weather Advisory
        if not triggered:
            conf_phrase = confidence_phrases.get(norm_unc, "")
            raw_msg = messages.get(
                "normal_weather_msg",
                "Normal meteorological conditions expected. Standard crop management practices recommended."
            )

            if norm_unc == "high":
                msg = f"[Informational only — wide forecast uncertainty] {raw_msg} {conf_phrase}".strip()
            else:
                msg = raw_msg

            triggered.append({
                "rule_id": "general_weather_v1",
                "title": titles.get("normal_weather_title", "General Crop Advisory"),
                "severity": "info",
                "confidence": norm_unc,
                "confidence_phrase": conf_phrase,
                "message": msg,
                "trigger_inputs": {
                    "rainfall_mm": round(float(rainfall_mm), 2),
                    "temp_max_c": round(float(tmax_p50), 1),
                    "temp_min_c": round(float(tmin_p50), 1)
                },
                "disclaimer": disclaimer,
                "issued_at": issued_at
            })

        return triggered


rule_engine = RuleEngine()
