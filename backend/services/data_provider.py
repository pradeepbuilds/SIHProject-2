import os
import json
import pandas as pd
from shapely import wkt, wkb
from shapely.geometry import Point, mapping
from backend.config import settings

SYNTHETIC_DATA_DIR = os.path.join(os.path.dirname(__file__), '..', '..', 'ml', 'data', 'synthetic')
FEATURES_DIR = os.path.join(os.path.dirname(__file__), '..', '..', 'ml', 'data', 'features')


def parse_geometry_to_dict(geom_data):
    if geom_data is None:
        return None
    try:
        if isinstance(geom_data, bytes):
            return mapping(wkb.loads(geom_data))
        elif isinstance(geom_data, str):
            try:
                return mapping(wkt.loads(geom_data))
            except Exception:
                return mapping(wkb.loads(bytes.fromhex(geom_data)))
        elif hasattr(geom_data, '__geo_interface__'):
            return mapping(geom_data)
    except Exception:
        return None
    return None


class DataProvider:
    def __init__(self):
        self.districts = []
        self.blocks_df = None
        self.panchayats_df = None
        self.grids_df = None
        self.forecasts_df = None
        self.env_features_df = None
        self.training_features_df = None
        self._load_data()

    def _load_data(self):
        print("Loading data into DataProvider...")
        # District definition
        self.districts = [
            {
                "id": settings.PILOT_DISTRICT_ID,
                "name": settings.PILOT_DISTRICT_NAME,
                "state": settings.PILOT_STATE,
                "lgd_code": "550"
            }
        ]
        
        # Load Parquet files
        blocks_path = os.path.join(SYNTHETIC_DATA_DIR, 'blocks.parquet')
        if os.path.exists(blocks_path):
            self.blocks_df = pd.read_parquet(blocks_path)
            
        panchayats_path = os.path.join(SYNTHETIC_DATA_DIR, 'panchayats.parquet')
        if os.path.exists(panchayats_path):
            self.panchayats_df = pd.read_parquet(panchayats_path)
            
        grids_path = os.path.join(SYNTHETIC_DATA_DIR, 'grids.parquet')
        if os.path.exists(grids_path):
            self.grids_df = pd.read_parquet(grids_path)
            
        forecasts_path = os.path.join(SYNTHETIC_DATA_DIR, 'weather_forecasts.parquet')
        if os.path.exists(forecasts_path):
            self.forecasts_df = pd.read_parquet(forecasts_path)
            # Ensure string date formatting
            self.forecasts_df['target_date_str'] = self.forecasts_df['target_date'].astype(str)
            self.forecasts_df['forecast_date_str'] = self.forecasts_df['forecast_date'].astype(str)
            
        training_features_path = os.path.join(FEATURES_DIR, 'training_features.parquet')
        if os.path.exists(training_features_path):
            self.training_features_df = pd.read_parquet(training_features_path)
            self.training_features_df['target_date_str'] = self.training_features_df['target_date'].astype(str)
            
        print("DataProvider initialization complete.")

    def get_districts(self):
        return self.districts

    def get_blocks(self, district_id=None):
        if self.blocks_df is None:
            return []
        df = self.blocks_df
        if district_id:
            df = df[df['district_id'] == district_id]
        
        results = []
        for _, row in df.iterrows():
            geom = parse_geometry_to_dict(row.get('geometry'))
            results.append({
                "id": str(row['id']),
                "district_id": str(row['district_id']),
                "name": str(row['name']),
                "lgd_code": str(row.get('lgd_code', '')),
                "geometry": geom
            })
        return results

    def get_panchayats(self, block_id=None):
        if self.panchayats_df is None:
            return []
        df = self.panchayats_df
        if block_id:
            df = df[df['block_id'] == block_id]
            
        results = []
        for _, row in df.iterrows():
            geom = parse_geometry_to_dict(row.get('geometry'))
            results.append({
                "id": str(row['id']),
                "block_id": str(row['block_id']),
                "name": str(row['name']),
                "lgd_code": str(row.get('lgd_code', '')),
                "geometry": geom,
                "is_synthetic_boundary": bool(row.get('is_synthetic_boundary', True))
            })
        return results

    def get_panchayat_by_id(self, panchayat_id):
        if self.panchayats_df is None:
            return None
        match = self.panchayats_df[self.panchayats_df['id'] == panchayat_id]
        if match.empty:
            # Check grid cells
            if self.grids_df is not None:
                grid_match = self.grids_df[self.grids_df['id'] == panchayat_id]
                if not grid_match.empty:
                    row = grid_match.iloc[0]
                    return {
                        "id": str(row['id']),
                        "block_id": str(row['block_id']),
                        "name": f"Grid Cell {row['id']}",
                        "is_grid": True
                    }
            return None
        row = match.iloc[0]
        return {
            "id": str(row['id']),
            "block_id": str(row['block_id']),
            "name": str(row['name']),
            "is_grid": False
        }

    def get_forecast(self, block_id, date_str):
        if self.forecasts_df is None:
            return None
        match = self.forecasts_df[
            (self.forecasts_df['block_id'] == block_id) & 
            (self.forecasts_df['target_date_str'] == str(date_str))
        ]
        if match.empty:
            # Fallback to nearest date or default synthetic forecast
            match = self.forecasts_df[self.forecasts_df['block_id'] == block_id]
            if match.empty:
                return None
            row_sample = match.iloc[0]
            return {
                "block_id": block_id,
                "date": date_str,
                "rainfall_mm": 12.5,
                "temp_max_c": 31.0,
                "temp_min_c": 21.5,
                "humidity_pct": 65.0,
                "horizon_days": 1,
                "data_source_tag": "FORECAST",
                "is_synthetic": True
            }
        
        # Pivot variables
        res = {
            "block_id": block_id,
            "date": date_str,
            "rainfall_mm": 0.0,
            "temp_max_c": 30.0,
            "temp_min_c": 20.0,
            "humidity_pct": 60.0,
            "horizon_days": int(match.iloc[0].get('horizon_days', 1)),
            "data_source_tag": "FORECAST",
            "is_synthetic": True
        }
        for _, r in match.iterrows():
            var = r['variable']
            val = float(r['value'])
            if 'rain' in var:
                res["rainfall_mm"] = val
            elif 'max' in var:
                res["temp_max_c"] = val
            elif 'min' in var:
                res["temp_min_c"] = val
            elif 'humid' in var:
                res["humidity_pct"] = val
        return res


data_provider = DataProvider()
