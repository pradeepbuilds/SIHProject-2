from typing import Optional, Dict, Any, List
import pandas as pd
import numpy as np
from backend.services.data_provider import data_provider
from backend.services.inference_service import inference_service
from ml.inference.serve import predict


class MapService:
    def get_map_layer(self, variable: str, date_str: str, level: str = "panchayat") -> Dict[str, Any]:
        features = []
        norm_level = level.lower()
        norm_var = variable.lower()
        
        if "min" in norm_var:
            var_key = "temperature_min"
            var_label = "temp_min_c"
            rmse = 1.38
        elif "max" in norm_var:
            var_key = "temperature_max"
            var_label = "temp_max_c"
            rmse = 1.09
        else:
            var_key = "rainfall"
            var_label = "rainfall_mm"
            rmse = 4.33
        
        if norm_level == "block":
            blocks = data_provider.get_blocks()
            for b in blocks:
                if not b.get("geometry"):
                    continue
                fc = data_provider.get_forecast(b["id"], date_str)
                val = 0.0
                if fc:
                    if "rain" in norm_var:
                        val = fc["rainfall_mm"]
                    elif "min" in norm_var:
                        val = fc["temp_min_c"]
                    else:
                        val = fc["temp_max_c"]
                        
                features.append({
                    "type": "Feature",
                    "geometry": b["geometry"],
                    "properties": {
                        "id": b["id"],
                        "name": b["name"],
                        "variable": var_label,
                        "value": round(float(val), 2),
                        "data_source_tag": "FORECAST",
                        "is_synthetic": True,
                        "level": "block"
                    }
                })
        else: # panchayat level default
            panchayats = data_provider.get_panchayats()
            
            # Fast vectorized batch scoring if training_features_df is available
            tf = data_provider.training_features_df
            batch_predictions = {}
            if tf is not None:
                tf_date = tf[tf['target_date_str'] == str(date_str)]
                if not tf_date.empty:
                    feature_cols = ['horizon_days', 'coarse_temp_max_c', 'coarse_temp_min_c', 'coarse_rainfall_mm',
                                    'coarse_humidity_pct', 'aspect', 'distance_to_water_km', 'elevation', 'ndvi', 'ndwi',
                                    'slope', 'land_cover_class', 'soil_texture_class']
                    X_batch = tf_date[feature_cols]
                    try:
                        preds = predict(var_key, X_batch)
                        if var_key == "rainfall":
                            preds = np.maximum(0.0, preds)
                        for loc_ref, p_val, coarse_p in zip(
                            tf_date['location_ref'],
                            preds,
                            tf_date[f'coarse_{var_label}'] if f'coarse_{var_label}' in tf_date else preds
                        ):
                            batch_predictions[loc_ref] = (float(p_val), float(coarse_p))
                    except Exception:
                        pass
            
            for p in panchayats:
                if not p.get("geometry"):
                    continue
                loc_id = p["id"]
                if loc_id in batch_predictions:
                    ml_val, coarse_val = batch_predictions[loc_id]
                else:
                    pred_resp, _ = inference_service.get_prediction_for_location(loc_id, date_str, variable)
                    ml_val = pred_resp["prediction"] if pred_resp else 25.0
                    coarse_val = pred_resp["baseline"]["value"] if pred_resp else 25.0
                    
                ml_val = round(float(ml_val), 2)
                coarse_val = round(float(coarse_val), 2)
                
                # Uncertainty label
                if var_key == "rainfall":
                    width = 2.3 * rmse
                    unc = "low" if width < 4.0 else ("medium" if width < 10.0 else "high")
                else:
                    width = 2.2 * rmse
                    unc = "low" if width < 2.0 else ("medium" if width < 3.2 else "high")
                
                features.append({
                    "type": "Feature",
                    "geometry": p["geometry"],
                    "properties": {
                        "id": p["id"],
                        "name": p["name"],
                        "block_id": p["block_id"],
                        "variable": var_label,
                        "value": ml_val,
                        "coarse_value": coarse_val,
                        "uncertainty_label": unc,
                        "data_source_tag": "ML_DOWNSCALED",
                        "is_synthetic": True,
                        "level": "panchayat"
                    }
                })
                
        return {
            "type": "FeatureCollection",
            "features": features
        }


map_service = MapService()
