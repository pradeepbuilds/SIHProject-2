import os
import joblib
import numpy as np
import pandas as pd
from typing import Dict, Any, List

HUMAN_FEATURE_LABELS = {
    'elevation': 'Terrain Elevation',
    'slope': 'Topographical Slope',
    'aspect': 'Solar & Wind Aspect',
    'distance_to_water_km': 'Distance to Water Body',
    'ndvi': 'Vegetation Density (NDVI)',
    'ndwi': 'Water Moisture Index (NDWI)',
    'land_cover_class': 'Land Cover Classification',
    'soil_texture_class': 'Soil Texture Type',
    'horizon_days': 'Forecast Horizon / Lead Time',
    'coarse_temp_max_c': 'Block Coarse Max Temp',
    'coarse_temp_min_c': 'Block Coarse Min Temp',
    'coarse_rainfall_mm': 'Block Coarse Rainfall',
    'coarse_humidity_pct': 'Block Coarse Humidity'
}

FEATURE_UNITS = {
    'elevation': 'm',
    'slope': '°',
    'aspect': '°',
    'distance_to_water_km': 'km',
    'ndvi': '',
    'ndwi': '',
    'land_cover_class': '',
    'soil_texture_class': '',
    'horizon_days': 'days',
    'coarse_temp_max_c': '°C',
    'coarse_temp_min_c': '°C',
    'coarse_rainfall_mm': 'mm',
    'coarse_humidity_pct': '%'
}


def explain_prediction(model_path: str, input_features_df: pd.DataFrame, variable: str) -> Dict[str, Any]:
    """
    Computes exact additive TreeSHAP contributions from LightGBM p50 model,
    aggregating one-hot encoded categories back to source features.
    """
    if not os.path.exists(model_path):
        raise FileNotFoundError(f"Model not found at {model_path}")

    container = joblib.load(model_path)
    preprocessor = getattr(container, 'preprocessor', None)

    # If rainfall hurdle, use p50_amount or underlying regressor
    if hasattr(container, 'p50_amount'):
        lgb_model = container.p50_amount
    elif hasattr(container, 'p50'):
        lgb_model = container.p50
    else:
        lgb_model = container

    if preprocessor:
        X_trans = preprocessor.transform(input_features_df)
    else:
        X_trans = input_features_df.values

    # LightGBM pred_contrib=True returns [n_samples, n_features + 1] where last element is expected value
    contribs = lgb_model.predict(X_trans, pred_contrib=True)[0]
    feature_contribs = contribs[:-1]
    base_val = float(contribs[-1])
    total_pred = float(np.sum(contribs))

    # Map transformed feature columns back to original feature names
    from krishimitra.models import NUMERIC_FEATURES, CATEGORICAL_FEATURES
    cat_names = []
    if preprocessor and hasattr(preprocessor, 'named_transformers_'):
        cat_encoder = preprocessor.named_transformers_['cat']
        if hasattr(cat_encoder, 'get_feature_names_out'):
            cat_names = list(cat_encoder.get_feature_names_out(CATEGORICAL_FEATURES))

    transformed_cols = NUMERIC_FEATURES + cat_names

    aggregated_contribs = {}
    for col_name, c_val in zip(transformed_cols, feature_contribs):
        # Check if one-hot column
        orig_name = col_name
        for cat_f in CATEGORICAL_FEATURES:
            if col_name.startswith(f"{cat_f}_"):
                orig_name = cat_f
                break
        aggregated_contribs[orig_name] = aggregated_contribs.get(orig_name, 0.0) + float(c_val)

    # Sort contributions by absolute magnitude
    sorted_items = sorted(aggregated_contribs.items(), key=lambda kv: abs(kv[1]), reverse=True)

    contributions_list = []
    for f_name, f_contrib in sorted_items:
        raw_val = input_features_df[f_name].iloc[0] if f_name in input_features_df else None
        if hasattr(raw_val, 'item'):
            raw_val = raw_val.item()
        contributions_list.append({
            'feature': f_name,
            'label': HUMAN_FEATURE_LABELS.get(f_name, f_name),
            'value': raw_val,
            'unit': FEATURE_UNITS.get(f_name, ''),
            'contribution': round(float(f_contrib), 3),
            'impact': 'positive' if f_contrib > 0 else ('negative' if f_contrib < 0 else 'neutral')
        })

    return {
        'variable': variable,
        'base_value': round(base_val, 2),
        'prediction': round(total_pred, 2),
        'contributions': contributions_list,
        'verification_sum': round(float(np.sum(contribs)), 4)
    }
