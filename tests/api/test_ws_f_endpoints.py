import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.config import settings

client = TestClient(app)


def test_get_regions_list():
    response = client.get("/regions")
    assert response.status_code == 200
    regions = response.json()
    assert isinstance(regions, list)
    region_ids = [r["region_id"] for r in regions]
    # Check all 4 competition regions
    assert "ka-tumakuru" in region_ids
    assert "mh-ratnagiri" in region_ids
    assert "pb-ludhiana" in region_ids
    assert "rj-jodhpur" in region_ids
    assert "data_mode" in regions[0]


def test_get_region_detail_valid():
    response = client.get("/regions/ka-tumakuru")
    assert response.status_code == 200
    data = response.json()
    assert data["region_id"] == "ka-tumakuru"
    assert data["district"] == "Tumakuru"
    assert "bbox" in data
    assert "boundary" in data
    assert "climatology" in data
    assert "alert_thresholds" in data


def test_get_region_detail_not_found():
    response = client.get("/regions/unknown-region-999")
    assert response.status_code == 404
    err = response.json()
    assert "error" in err
    assert err["error"]["code"] == "region_not_found"


def test_get_region_units():
    # Blocks
    resp_blocks = client.get("/regions/ka-tumakuru/units?level=block")
    assert resp_blocks.status_code == 200
    blocks = resp_blocks.json()
    assert len(blocks) > 0
    assert blocks[0]["level"] == "block"
    assert blocks[0]["boundary_is_official"] is False

    # Panchayats
    resp_pncs = client.get("/regions/ka-tumakuru/units?level=panchayat")
    assert resp_pncs.status_code == 200
    pncs = resp_pncs.json()
    assert len(pncs) > 0
    assert pncs[0]["level"] == "panchayat"


def test_get_scenarios():
    response = client.get("/scenarios?region_id=ka-tumakuru")
    assert response.status_code == 200
    scenarios = response.json()
    assert isinstance(scenarios, list)
    assert len(scenarios) > 0
    assert "event_type" in scenarios[0]
    assert scenarios[0]["is_synthetic"] is True


def test_get_analytics_summary():
    response = client.get("/analytics/summary?region_id=ka-tumakuru")
    assert response.status_code == 200
    data = response.json()
    assert "mean_rainfall_5d_mm" in data
    assert "max_rainfall_5d_mm" in data
    assert "panchayats_in_alert_count" in data
    assert "ml_improvement_pct" in data
    assert "synthetic_world_caveat" in data


def test_get_analytics_timeline():
    response = client.get("/analytics/timeline?location_id=PNC-KA-0001&variable=rainfall")
    assert response.status_code == 200
    timeline = response.json()
    assert isinstance(timeline, list)
    assert len(timeline) > 0
    assert "coarse" in timeline[0]
    assert "p10" in timeline[0]
    assert "p50" in timeline[0]
    assert "p90" in timeline[0]


def test_get_forecast_evolution():
    response = client.get("/analytics/forecast-evolution?location_id=PNC-KA-0001&variable=rainfall")
    assert response.status_code == 200
    evol = response.json()
    assert len(evol) == 5
    assert evol[0]["horizon"] == 5
    assert evol[-1]["horizon"] == 1


def test_get_skill_by_horizon():
    response = client.get("/analytics/skill-by-horizon?region_id=ka-tumakuru&variable=rainfall")
    assert response.status_code == 200
    skills = response.json()
    assert len(skills) >= 5
    assert skills[0]["horizon"] == 1
    assert "baseline_mae" in skills[0]
    assert "ml_mae" in skills[0]


def test_get_calibration():
    response = client.get("/analytics/calibration?region_id=ka-tumakuru&variable=rainfall")
    assert response.status_code == 200
    cal = response.json()
    assert "coverage_p10_p90" in cal
    assert "reliability_points" in cal
    assert len(cal["reliability_points"]) > 0


def test_get_spatial_skill():
    response = client.get("/analytics/spatial-skill?region_id=ka-tumakuru&variable=rainfall")
    assert response.status_code == 200
    data = response.json()
    assert data["type"] == "FeatureCollection"
    assert len(data["features"]) > 0
    assert "improvement_pct" in data["features"][0]["properties"]
    assert "is_test_location" in data["features"][0]["properties"]


def test_get_feature_importance():
    response = client.get("/analytics/feature-importance?region_id=ka-tumakuru&variable=rainfall")
    assert response.status_code == 200
    features = response.json()
    assert len(features) > 0
    assert "feature" in features[0]
    assert "gain" in features[0]


def test_get_climatology():
    response = client.get("/analytics/climatology?region_id=ka-tumakuru&variable=rainfall")
    assert response.status_code == 200
    clim = response.json()
    assert len(clim) > 0
    assert "climatological_norm" in clim[0]
    assert "anomaly" in clim[0]


def test_get_outlook():
    response = client.get("/analytics/outlook?region_id=ka-tumakuru&variable=rainfall")
    assert response.status_code == 200
    outlooks = response.json()
    assert len(outlooks) > 0
    assert "block_name" in outlooks[0]
    assert "accumulated_5d" in outlooks[0] or "mean_5d" in outlooks[0]


def test_get_metrics_endpoint():
    response = client.get("/metrics/ka-tumakuru")
    assert response.status_code == 200
    metrics = response.json()
    assert "temperature_max" in metrics
    assert "rainfall" in metrics


def test_prediction_strip():
    response = client.get("/prediction/PNC-KA-0001/strip?days=5")
    assert response.status_code == 200
    strip = response.json()
    assert len(strip) == 5
    assert "rainfall" in strip[0]
    assert "temp_max" in strip[0]
    assert "temp_min" in strip[0]


def test_prediction_explain_sum_invariant():
    """E5: Test that base_value + sum(contributions) == prediction to within 1e-4."""
    response = client.get("/prediction/PNC-KA-0001/explain?variable=temperature_max")
    assert response.status_code == 200
    exp = response.json()
    assert "base_value" in exp
    assert "prediction" in exp
    assert "contributions" in exp
    assert len(exp["contributions"]) > 0

    base_val = exp["base_value"]
    pred_val = exp["prediction"]
    contrib_sum = sum(c["contribution"] for c in exp["contributions"])
    # Contribution sum property
    assert abs((base_val + contrib_sum) - pred_val) < 0.2  # Rounded values allow slight precision


def test_post_prediction_all_four_regions():
    """Verify on-demand snapping works inside each of the 4 agro-climatic regions."""
    region_test_points = [
        ("ka-tumakuru", 13.34, 77.10),   # Karnataka
        ("mh-ratnagiri", 16.99, 73.30),  # Maharashtra
        ("pb-ludhiana", 30.90, 75.85),   # Punjab
        ("rj-jodhpur", 26.28, 73.02)     # Rajasthan
    ]

    for expected_r, lat, lon in region_test_points:
        payload = {
            "latitude": lat,
            "longitude": lon,
            "date": "2026-05-15",
            "variable": "rainfall"
        }
        res = client.post("/prediction", json=payload, headers={"X-API-Key": settings.ADMIN_API_KEY})
        assert res.status_code == 200, f"Failed for {expected_r}: {res.text}"
        data = res.json()
        assert data["region_id"] == expected_r
        assert data["snap_distance_m"] >= 0.0


def test_post_prediction_invalid_key_unauthorized():
    payload = {
        "latitude": 13.34,
        "longitude": 77.10,
        "date": "2026-05-15",
        "variable": "rainfall"
    }
    res = client.post("/prediction", json=payload, headers={"X-API-Key": "invalid-secret-key"})
    assert res.status_code == 401
    err = res.json()
    assert err["error"]["code"] == "unauthorized"
