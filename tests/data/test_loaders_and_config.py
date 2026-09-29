import os
import glob
import pytest
import yaml
import pandas as pd
from krishimitra.config import load_all_region_configs, get_region_config, find_region_by_coordinates, RegionConfig

REGIONS_DIR = os.path.join(os.path.dirname(__file__), '..', '..', 'regions')
ML_DATA_DIR = os.path.join(os.path.dirname(__file__), '..', '..', 'ml', 'data')


def test_region_config_loading_all_valid():
    """Verify all shipping region YAML files load and pass schema validation."""
    configs = load_all_region_configs()
    assert len(configs) >= 4
    for r_id, cfg in configs.items():
        assert isinstance(cfg, RegionConfig)
        assert cfg.region_id in ['ka-tumakuru', 'mh-ratnagiri', 'pb-ludhiana', 'rj-jodhpur', 'demo-region']
        assert len(cfg.languages) >= 2
        assert len(cfg.main_crops) >= 2
        assert cfg.boundary.get('district_geojson') is not None
        assert os.path.exists(cfg.district_geojson_path), f"GeoJSON missing for {cfg.region_id}"


def test_bad_region_yaml_rejected():
    """Verify corrupted or invalid YAML configs fail validation with clear exceptions."""
    bad_data = {"id_prefix": "PNC-TEST", "main_crops": ["wheat"]}
    with pytest.raises((ValueError, KeyError)):
        # Missing required region_id or state
        RegionConfig(bad_data)


def test_spatial_point_resolver_snapping():
    """Verify coordinate point resolution and bounds snapping for each region."""
    # Tumakuru coordinates: 13.34, 77.10
    reg = find_region_by_coordinates(13.34, 77.10)
    assert reg is not None
    assert reg.region_id == "ka-tumakuru"

    # Ratnagiri coordinates: 16.99, 73.30
    reg = find_region_by_coordinates(16.99, 73.30)
    assert reg is not None
    assert reg.region_id == "mh-ratnagiri"

    # Ludhiana coordinates: 30.90, 75.85
    reg = find_region_by_coordinates(30.90, 75.85)
    assert reg is not None
    assert reg.region_id == "pb-ludhiana"

    # Jodhpur coordinates: 26.28, 73.02
    reg = find_region_by_coordinates(26.28, 73.02)
    assert reg is not None
    assert reg.region_id == "rj-jodhpur"

    # Point outside all regions (e.g. Indian Ocean)
    reg_none = find_region_by_coordinates(0.0, 0.0)
    assert reg_none is None


def test_parquet_datasets_integrity():
    """Assert all 6 required datasets are present and non-empty for each region."""
    required_tables = [
        'blocks.parquet',
        'panchayats.parquet',
        'grids.parquet',
        'environmental_features.parquet',
        'weather_forecasts.parquet',
        'weather_observations.parquet'
    ]
    
    for r_id in ['ka-tumakuru', 'mh-ratnagiri', 'pb-ludhiana', 'rj-jodhpur']:
        r_dir = os.path.join(ML_DATA_DIR, r_id)
        assert os.path.exists(r_dir), f"Directory ml/data/{r_id} missing"
        for tbl in required_tables:
            p_path = os.path.join(r_dir, tbl)
            assert os.path.exists(p_path), f"Missing {tbl} in {r_id}"
            df = pd.read_parquet(p_path)
            assert len(df) > 0, f"Table {tbl} in {r_id} is unexpectedly empty"
            
            # String and numeric features assertion in environmental_features
            if tbl == 'environmental_features.parquet':
                assert 'feature_name' in df.columns
                assert 'value_num' in df.columns
                assert 'value_str' in df.columns
                # Verify string features exist
                str_feats = df[df['feature_name'].isin(['land_cover_class', 'soil_texture_class'])]
                assert len(str_feats) > 0, f"String features missing in {r_id} environmental_features"
