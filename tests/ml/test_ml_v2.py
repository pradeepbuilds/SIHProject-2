import os
import json
import pytest
import pandas as pd
from backend.services.multi_region_service import multi_region_service
from krishimitra.config import load_all_region_configs

REF_V1_PATH = os.path.join(os.path.dirname(__file__), '..', '..', 'docs', 'regression_reference', 'model_metrics_v1.json')
EVAL_BASE_DIR = os.path.join(os.path.dirname(__file__), '..', '..', 'ml', 'evaluation')
DATA_BASE_DIR = os.path.join(os.path.dirname(__file__), '..', '..', 'ml', 'data')


def test_baseline_regression_vs_v1():
    """Verify Tumakuru baseline metrics match v1 reference down to rounding."""
    assert os.path.exists(REF_V1_PATH), "v1 reference metrics not found"
    with open(REF_V1_PATH, 'r') as f:
        v1 = json.load(f)

    tumakuru_eval_path = os.path.join(EVAL_BASE_DIR, 'ka-tumakuru', 'metrics.json')
    assert os.path.exists(tumakuru_eval_path), "Tumakuru v2 metrics.json not found"
    with open(tumakuru_eval_path, 'r') as f:
        v2 = json.load(f)

    for var in ['temperature_max', 'temperature_min', 'rainfall']:
        base_v1 = v1[var]['baseline_block_replication']
        base_v2 = v2[var]['baseline_block_replication']
        
        # Exact decimal match on held-out test panchayats
        assert round(base_v1['mae'], 4) == round(base_v2['mae'], 4), f"{var} baseline MAE mismatch: v1={base_v1['mae']} v2={base_v2['mae']}"
        assert round(base_v1['rmse'], 4) == round(base_v2['rmse'], 4), f"{var} baseline RMSE mismatch: v1={base_v1['rmse']} v2={base_v2['rmse']}"


def test_data_leakage_all_regions():
    """Verify that no test location appears in train or calibration across all 4 regions,
    and no target_* column exists in features."""
    configs = load_all_region_configs()
    assert len(configs) >= 4

    for r_id in configs.keys():
        split_path = os.path.join(DATA_BASE_DIR, r_id, 'split.json')
        if not os.path.exists(split_path):
            continue
        with open(split_path, 'r') as f:
            split = json.load(f)

        train_locs = set(split.get('train_locations', []))
        calib_locs = set(split.get('calibration_locations', []))
        test_locs = set(split.get('test_locations', []))

        # Test locations must never intersect train or calibration
        train_test_overlap = train_locs.intersection(test_locs)
        calib_test_overlap = calib_locs.intersection(test_locs)
        assert len(train_test_overlap) == 0, f"Leakage in {r_id}: train/test overlap: {train_test_overlap}"
        assert len(calib_test_overlap) == 0, f"Leakage in {r_id}: calib/test overlap: {calib_test_overlap}"

        # Feature matrix column check
        feat_path = os.path.join(DATA_BASE_DIR, r_id, 'features.parquet')
        if os.path.exists(feat_path):
            df_feat = pd.read_parquet(feat_path)
            feature_cols = [c for c in df_feat.columns if c.startswith('target_')]
            # target columns must only be targets, and ML training features must exclude them
            assert len(feature_cols) >= 1  # targets exist in dataset
            # In meta.json, ensure feature_names list contains NO target_ columns
            for var in ['temperature_max', 'temperature_min', 'rainfall']:
                meta_path = os.path.join(os.path.dirname(__file__), '..', '..', 'ml', 'models', r_id, f'{var}.meta.json')
                if os.path.exists(meta_path):
                    with open(meta_path, 'r') as mf:
                        meta = json.load(mf)
                    feat_names = meta.get('features', [])
                    leak_features = [fn for fn in feat_names if 'target' in fn.lower()]
                    assert len(leak_features) == 0, f"Target leakage in {r_id} {var} feature set: {leak_features}"


def test_hurdle_output_invariants():
    """Verify hurdle output invariants: 0 <= rain_probability <= 1, p10 <= p50 <= p90."""
    for r_id in ['ka-tumakuru', 'mh-ratnagiri', 'pb-ludhiana', 'rj-jodhpur']:
        units = multi_region_service.get_units(r_id, level='panchayat')
        if not units:
            continue
        pnc_id = units[0]['id']
        
        # Test rainfall prediction
        pred, err = multi_region_service.get_prediction(pnc_id, '2026-05-15', 'rainfall', region_id=r_id)
        assert err is None
        assert pred is not None

        prob = pred.get('rain_probability')
        assert prob is not None
        assert 0.0 <= prob <= 1.0, f"Probability {prob} out of [0, 1] for {pnc_id}"

        p10 = pred['p10']
        p50 = pred['p50']
        p90 = pred['p90']
        assert p10 <= p50 <= p90 + 1e-4, f"Quantile monotonicity violated in {r_id} {pnc_id}: {p10} <= {p50} <= {p90}"


def test_split_determinism():
    """Verify that split.json locations count is consistent and deterministic."""
    tumakuru_split = os.path.join(DATA_BASE_DIR, 'ka-tumakuru', 'split.json')
    with open(tumakuru_split, 'r') as f:
        split = json.load(f)
    assert len(split['test_locations']) == 23
    assert len(split['train_locations']) == 72
    assert len(split['calibration_locations']) == 18
