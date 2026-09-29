import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.config import settings

client = TestClient(app)


def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_get_districts():
    response = client.get("/districts")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) > 0
    assert data[0]["id"] == settings.PILOT_DISTRICT_ID
    assert data[0]["name"] == settings.PILOT_DISTRICT_NAME


def test_get_blocks():
    response = client.get("/blocks")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) > 0
    assert "id" in data[0]
    assert "district_id" in data[0]


def test_get_panchayats():
    response = client.get("/panchayats")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) > 0
    assert "id" in data[0]
    assert "block_id" in data[0]


def test_get_weather_forecast():
    response = client.get("/weather/forecast?block_id=BLK-KA-001&date=2026-05-15")
    assert response.status_code == 200
    data = response.json()
    assert data["block_id"] == "BLK-KA-001"
    assert "rainfall_mm" in data
    assert "temp_max_c" in data
    assert "temp_min_c" in data
    assert data["data_source_tag"] == "FORECAST"
    assert data["is_synthetic"] is True


def test_get_prediction_valid():
    response = client.get("/prediction/PNC-KA-0001?variable=temperature_max&date=2026-05-15")
    assert response.status_code == 200
    data = response.json()
    assert data["location_id"] == "PNC-KA-0001"
    assert "prediction" in data
    assert "uncertainty_interval" in data
    assert "p10" in data["uncertainty_interval"]
    assert "p50" in data["uncertainty_interval"]
    assert "p90" in data["uncertainty_interval"]
    assert data["uncertainty_label"] in ["low", "medium", "high"]
    assert data["data_source_tag"] == "ML_DOWNSCALED"
    assert data["is_synthetic"] is True
    assert "baseline" in data
    assert data["baseline"]["data_source_tag"] == "BASELINE"


def test_get_prediction_not_found():
    response = client.get("/prediction/NON_EXISTING_ID_99999")
    assert response.status_code == 404


def test_post_prediction_in_bounds():
    payload = {
        "latitude": 13.34,
        "longitude": 77.10,
        "date": "2026-05-15",
        "variable": "rainfall"
    }
    response = client.post("/prediction", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "prediction" in data
    assert "snapped_grid_id" in data
    assert "snap_distance_km" in data


def test_post_prediction_out_of_bounds():
    payload = {
        "latitude": 28.61,  # Delhi latitude
        "longitude": 77.20,
        "date": "2026-05-15",
        "variable": "rainfall"
    }
    response = client.post("/prediction", json=payload)
    assert response.status_code == 400
    data = response.json()
    assert "detail" in data
    assert data["detail"]["error"]["code"] == "outside_pilot_area"


def test_get_advisory():
    response = client.get("/advisory?location_id=PNC-KA-0001&crop=ragi&stage=flowering")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) > 0
    assert "rule_id" in data[0]
    assert "message" in data[0]
    assert "uncertainty_label" in data[0]


def test_get_model_info():
    response = client.get("/model/info")
    assert response.status_code == 200
    data = response.json()
    assert "active_versions" in data
    assert "training_window" in data


def test_get_model_metrics():
    response = client.get("/model/metrics")
    assert response.status_code == 200
    data = response.json()
    assert "temperature_max" in data
    assert "temperature_min" in data
    assert "rainfall" in data


def test_get_map_layer():
    response = client.get("/map/layer?variable=rainfall&level=panchayat")
    assert response.status_code == 200
    data = response.json()
    assert data["type"] == "FeatureCollection"
    assert "features" in data
    assert len(data["features"]) > 0


def test_model_train_auth():
    # Without key -> 401
    resp_unauth = client.post("/model/train")
    assert resp_unauth.status_code == 401
    
    # With valid key -> 202
    resp_auth = client.post("/model/train", headers={"X-API-KEY": settings.ADMIN_API_KEY})
    assert resp_auth.status_code == 202
    data = resp_auth.json()
    assert "job_id" in data
    assert data["status"] == "queued"
