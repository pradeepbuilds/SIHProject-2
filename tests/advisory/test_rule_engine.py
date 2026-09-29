import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

import pytest
from advisory.rule_engine import rule_engine


def test_heavy_rainfall_rule_triggers():
    """Verify that heavy rainfall >= 50mm on 1-day horizon triggers heavy_rainfall_v1."""
    advisories = rule_engine.evaluate(
        rainfall_mm=65.0,
        temp_max_c=29.0,
        horizon_days=1,
        crop_name="ragi",
        stage_name="vegetative",
        uncertainty_label="low"
    )
    rule_ids = [a["rule_id"] for a in advisories]
    assert "heavy_rainfall_v1" in rule_ids
    
    adv = next(a for a in advisories if a["rule_id"] == "heavy_rainfall_v1")
    assert "Heavy rainfall" in adv["message"]
    assert not adv["message"].startswith("[Informational only")


def test_irrigation_suggestion_rule_triggers():
    """Verify that dry spell (< 2mm rain and >= 5 dry days) triggers irrigation_suggestion_v1."""
    advisories = rule_engine.evaluate(
        rainfall_mm=0.2,
        temp_max_c=31.0,
        days_since_last_rain=7,
        crop_name="groundnut",
        stage_name="vegetative",
        uncertainty_label="medium"
    )
    rule_ids = [a["rule_id"] for a in advisories]
    assert "irrigation_suggestion_v1" in rule_ids
    
    adv = next(a for a in advisories if a["rule_id"] == "irrigation_suggestion_v1")
    assert "Low rainfall and dry spell detected" in adv["message"]


def test_heat_stress_rule_triggers():
    """Verify that high temperature during flowering stage triggers heat_stress_v1."""
    # Ragi flowering heat threshold is 34.0°C
    advisories = rule_engine.evaluate(
        rainfall_mm=10.0,
        temp_max_c=36.2,
        crop_name="ragi",
        stage_name="flowering",
        uncertainty_label="medium"
    )
    rule_ids = [a["rule_id"] for a in advisories]
    assert "heat_stress_v1" in rule_ids
    
    adv = next(a for a in advisories if a["rule_id"] == "heat_stress_v1")
    assert "exceeds the heat-stress threshold" in adv["message"]


def test_uncertainty_suppression_and_downgrading():
    """Verify that high uncertainty prefixes messages with informational notice while low uncertainty does not."""
    # 1. High uncertainty case
    adv_high = rule_engine.evaluate(
        rainfall_mm=60.0,
        temp_max_c=30.0,
        horizon_days=1,
        uncertainty_label="high"
    )
    heavy_adv_high = next(a for a in adv_high if a["rule_id"] == "heavy_rainfall_v1")
    assert heavy_adv_high["message"].startswith("[Informational only — wide forecast uncertainty]")

    # 2. Low uncertainty case (authoritative, no prefix)
    adv_low = rule_engine.evaluate(
        rainfall_mm=60.0,
        temp_max_c=30.0,
        horizon_days=1,
        uncertainty_label="low"
    )
    heavy_adv_low = next(a for a in adv_low if a["rule_id"] == "heavy_rainfall_v1")
    assert not heavy_adv_low["message"].startswith("[Informational only")


def test_general_weather_fallback():
    """Verify that normal conditions return the general weather advisory."""
    advisories = rule_engine.evaluate(
        rainfall_mm=12.0,
        temp_max_c=30.0,
        crop_name="paddy",
        stage_name="vegetative",
        uncertainty_label="low"
    )
    assert len(advisories) == 1
    assert advisories[0]["rule_id"] == "general_weather_v1"
    assert "Normal meteorological conditions expected" in advisories[0]["message"]
