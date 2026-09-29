import os
import json
import pytest
import numpy as np


METRICS_FILE = os.path.join(os.path.dirname(__file__), '..', '..', 'backend', 'model_metrics.json')
SPLIT_FILE = os.path.join(os.path.dirname(__file__), '..', '..', 'ml', 'data', 'split.json')


def test_model_metrics_file_exists():
    """Check that the model_metrics.json file exists and is valid JSON."""
    assert os.path.exists(METRICS_FILE), f"Metrics file not found at {METRICS_FILE}"
    with open(METRICS_FILE, 'r') as f:
        data = json.load(f)
    assert isinstance(data, dict)


def test_spatial_split_integrity():
    """Verify train and test spatial locations are mutually exclusive (no data leakage)."""
    assert os.path.exists(SPLIT_FILE), f"Split file not found at {SPLIT_FILE}"
    with open(SPLIT_FILE, 'r') as f:
        split = json.load(f)
        
    train_locs = set(split.get("train_locations", []))
    test_locs = set(split.get("test_locations", []))
    
    assert len(train_locs) > 0, "Train locations set is empty"
    assert len(test_locs) > 0, "Test locations set is empty"
    
    overlap = train_locs.intersection(test_locs)
    assert len(overlap) == 0, f"Spatial data leakage detected! Overlapping locations: {overlap}"


def test_model_metrics_structure_and_bounds():
    """Verify all variables have complete, non-null, bounded metrics."""
    with open(METRICS_FILE, 'r') as f:
        data = json.load(f)
        
    for var in ["temperature_max", "temperature_min", "rainfall"]:
        assert var in data, f"Missing variable '{var}' in metrics"
        entry = data[var]
        
        assert entry.get("status") == "evaluated", f"Status for '{var}' is not evaluated"
        assert "baseline_block_replication" in entry, f"Missing baseline for '{var}'"
        assert "ml" in entry, f"Missing ML metrics for '{var}'"
        assert "improvement" in entry, f"Missing improvement section for '{var}'"
        
        # Test baseline and ML test metrics
        base = entry["baseline_block_replication"]
        ml = entry["ml"]
        
        for reg_block in [base, ml]:
            assert reg_block["mae"] >= 0, "MAE must be non-negative"
            assert reg_block["rmse"] >= 0, "RMSE must be non-negative"
            assert -1.0 <= reg_block["r"] <= 1.0, f"Pearson correlation r out of range: {reg_block['r']}"
            assert reg_block["r2"] <= 1.0, f"R2 score > 1: {reg_block['r2']}"
            
        # Temperature ML model must outperform baseline
        if "temperature" in var:
            assert ml["mae"] < base["mae"], f"ML MAE ({ml['mae']}) is not better than Baseline MAE ({base['mae']}) for {var}"
            assert ml["rmse"] < base["rmse"], f"ML RMSE ({ml['rmse']}) is not better than Baseline RMSE ({base['rmse']}) for {var}"
            assert entry["improvement"]["beats_baseline"] is True
            

def test_rainfall_occurrence_metrics():
    """Verify rainfall classification metrics are present and valid."""
    with open(METRICS_FILE, 'r') as f:
        data = json.load(f)
        
    assert "rainfall" in data
    rain = data["rainfall"]
    assert "rain_occurrence" in rain
    
    for split_key in ["baseline_test", "ml_test"]:
        assert split_key in rain["rain_occurrence"]
        cls_metrics = rain["rain_occurrence"][split_key]
        for metric in ["precision", "recall", "f1", "accuracy"]:
            assert metric in cls_metrics
            val = cls_metrics[metric]
            assert 0.0 <= val <= 1.0, f"{metric} out of bounds: {val}"
