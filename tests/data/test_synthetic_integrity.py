import pytest
from backend.services.inference_service import inference_service


def test_quantile_monotonicity():
    location_id = "PNC-KA-0001"
    
    # Test temperature quantile monotonicity via get_prediction_for_location
    temp_res, err = inference_service.get_prediction_for_location(location_id, "2026-09-28", "temp_max")
    assert err is None
    assert temp_res is not None
    q = temp_res["uncertainty_interval"]
    assert q["p10"] <= q["p50"] <= q["p90"], f"Monotonicity violated for temperature: {q}"

    # Test rainfall quantile monotonicity
    rain_res, err = inference_service.get_prediction_for_location(location_id, "2026-09-28", "rainfall")
    assert err is None
    assert rain_res is not None
    q = rain_res["uncertainty_interval"]
    assert q["p10"] <= q["p50"] <= q["p90"], f"Monotonicity violated for rainfall: {q}"


def test_rainfall_non_negative():
    location_id = "PNC-KA-0001"
    rain_res, err = inference_service.get_prediction_for_location(location_id, "2026-09-28", "rainfall")
    assert err is None
    assert rain_res is not None
    assert rain_res["prediction"] >= 0.0, f"Negative rainfall estimate: {rain_res['prediction']}"
    assert rain_res["uncertainty_interval"]["p10"] >= 0.0, f"Negative p10 rainfall: {rain_res['uncertainty_interval']['p10']}"


def test_uncertainty_label_validity():
    location_id = "PNC-KA-0001"
    res, err = inference_service.get_prediction_for_location(location_id, "2026-09-28", "temp_max")
    assert err is None
    assert res is not None
    assert res["uncertainty_label"] in ["low", "medium", "high"]
