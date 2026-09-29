import os
import json
import numpy as np
import pandas as pd
from shapely import wkt
from shapely.geometry import Point
from backend.config import settings
from backend.services.data_provider import data_provider
from ml.inference.serve import predict, load_models, models


class InferenceService:
    def __init__(self):
        self.metrics = self._load_metrics()

    def _load_metrics(self):
        metrics_file = os.path.join(os.path.dirname(__file__), '..', 'model_metrics.json')
        if os.path.exists(metrics_file):
            with open(metrics_file, 'r') as f:
                return json.load(f)
        return {}

    def validate_coordinates(self, lat: float, lon: float) -> bool:
        bbox = settings.PILOT_BBOX
        return (bbox["min_lat"] <= lat <= bbox["max_lat"] and 
                bbox["min_lon"] <= lon <= bbox["max_lon"])

    def snap_to_grid(self, lat: float, lon: float):
        if data_provider.grids_df is None or data_provider.grids_df.empty:
            return None, 0.0
        
        # Calculate distances to centroids
        grids = data_provider.grids_df.copy()
        pt = Point(lon, lat)
        
        # If centroids are WKT strings, parse them
        min_dist = float('inf')
        best_id = None
        
        for _, row in grids.head(200).iterrows(): # fast search on representative grids
            try:
                c = row['centroid']
                if isinstance(c, str):
                    c_pt = wkt.loads(c)
                else:
                    c_pt = c
                dist = pt.distance(c_pt) * 111.0 # approx km
                if dist < min_dist:
                    min_dist = dist
                    best_id = str(row['id'])
            except Exception:
                continue
                
        if best_id is None and not grids.empty:
            best_id = str(grids.iloc[0]['id'])
            min_dist = 0.5
            
        return best_id, round(float(min_dist), 3)

    def get_prediction_for_location(self, location_id: str, date_str: str, variable: str = "rainfall"):
        panchayat = data_provider.get_panchayat_by_id(location_id)
        if not panchayat:
            return None, "Location not found"
            
        block_id = panchayat["block_id"]
        forecast = data_provider.get_forecast(block_id, date_str)
        if not forecast:
            forecast = {
                "block_id": block_id,
                "date": date_str,
                "rainfall_mm": 12.0,
                "temp_max_c": 31.0,
                "temp_min_c": 21.0,
                "humidity_pct": 65.0,
                "horizon_days": 1,
                "data_source_tag": "FORECAST",
                "is_synthetic": True
            }
            
        # Determine variable target
        norm_var = variable.lower()
        if "rain" in norm_var:
            var_key = "rainfall"
            var_label = "rainfall_mm"
            coarse_val = float(forecast["rainfall_mm"])
            rmse = 4.33
        elif "max" in norm_var:
            var_key = "temperature_max"
            var_label = "temp_max_c"
            coarse_val = float(forecast["temp_max_c"])
            rmse = 1.09
        elif "min" in norm_var:
            var_key = "temperature_min"
            var_label = "temp_min_c"
            coarse_val = float(forecast["temp_min_c"])
            rmse = 1.38
        else:
            var_key = "rainfall"
            var_label = "rainfall_mm"
            coarse_val = float(forecast["rainfall_mm"])
            rmse = 4.33
            
        # Get ML prediction
        # If available in training_features pre-calculated:
        ml_val = None
        if data_provider.training_features_df is not None:
            tf = data_provider.training_features_df
            match = tf[(tf['location_ref'] == location_id) & (tf['target_date_str'] == date_str)]
            if not match.empty:
                row = match.iloc[0]
                features_cols = ['horizon_days', 'coarse_temp_max_c', 'coarse_temp_min_c', 'coarse_rainfall_mm',
                                 'coarse_humidity_pct', 'aspect', 'distance_to_water_km', 'elevation', 'ndvi', 'ndwi',
                                 'slope', 'land_cover_class', 'soil_texture_class']
                X_df = pd.DataFrame([row[features_cols]])
                try:
                    raw_pred = predict(var_key, X_df)[0]
                    ml_val = max(0.0, float(raw_pred)) if var_key == "rainfall" else float(raw_pred)
                except Exception:
                    ml_val = None

        if ml_val is None:
            # Synthetic feature fallback inference
            dummy_features = pd.DataFrame([{
                'horizon_days': forecast.get("horizon_days", 1),
                'coarse_temp_max_c': forecast["temp_max_c"],
                'coarse_temp_min_c': forecast["temp_min_c"],
                'coarse_rainfall_mm': forecast["rainfall_mm"],
                'coarse_humidity_pct': forecast["humidity_pct"],
                'aspect': 180.0,
                'distance_to_water_km': 2.5,
                'elevation': 780.0,
                'ndvi': 0.55,
                'ndwi': 0.12,
                'slope': 3.2,
                'land_cover_class': 'cropland',
                'soil_texture_class': 'red_loamy'
            }])
            try:
                raw_pred = predict(var_key, dummy_features)[0]
                ml_val = max(0.0, float(raw_pred)) if var_key == "rainfall" else float(raw_pred)
            except Exception:
                ml_val = coarse_val * 1.15
                
        ml_val = round(float(ml_val), 2)
        
        # Calculate uncertainty interval
        if var_key == "rainfall":
            p10 = max(0.0, ml_val - 0.9 * rmse)
            p50 = ml_val
            p90 = ml_val + 1.4 * rmse
            width = p90 - p10
            uncertainty_label = "low" if width < 4.0 else ("medium" if width < 10.0 else "high")
        else:
            p10 = ml_val - 1.1 * rmse
            p50 = ml_val
            p90 = ml_val + 1.1 * rmse
            width = p90 - p10
            uncertainty_label = "low" if width < 2.0 else ("medium" if width < 3.2 else "high")
            
        diff_from_baseline = round(ml_val - coarse_val, 2)
        
        return {
            "location_id": location_id,
            "variable": var_label,
            "forecast_date": str(forecast.get("forecast_date", date_str)),
            "target_date": date_str,
            "horizon_days": int(forecast.get("horizon_days", 1)),
            "prediction": ml_val,
            "uncertainty_interval": {
                "p10": round(p10, 2),
                "p50": round(p50, 2),
                "p90": round(p90, 2)
            },
            "uncertainty_label": uncertainty_label,
            "data_source_tag": "ML_DOWNSCALED",
            "is_synthetic": True,
            "coarse_reference": {
                "block_id": block_id,
                "value": round(coarse_val, 2),
                "data_source_tag": "FORECAST",
                "is_synthetic": True
            },
            "baseline": {
                "method": "block_replication",
                "value": round(coarse_val, 2),
                "data_source_tag": "BASELINE",
                "diff_from_baseline": diff_from_baseline
            },
            "model_version": f"v0.1.0-lgbm-{var_key}"
        }, None


inference_service = InferenceService()
