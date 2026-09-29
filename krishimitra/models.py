import os
import json
import hashlib
import joblib
import numpy as np
import pandas as pd
from datetime import datetime, timezone
import importlib.metadata

from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.isotonic import IsotonicRegression
import lightgbm as lgb

TRAIN_N_JOBS = 2

NUMERIC_FEATURES = [
    'horizon_days', 'coarse_temp_max_c', 'coarse_temp_min_c', 'coarse_rainfall_mm',
    'coarse_humidity_pct', 'aspect', 'distance_to_water_km', 'elevation', 'ndvi', 'ndwi', 'slope'
]
CATEGORICAL_FEATURES = ['land_cover_class', 'soil_texture_class']
ALL_FEATURES = NUMERIC_FEATURES + CATEGORICAL_FEATURES


class BlockReplicationBaseline:
    def __init__(self):
        self.model_version_id = 'v0.2-baseline-block-replication'
        self.model_type = 'baseline_block_replication'

    def fit(self, X, y=None):
        pass

    def predict(self, X, variable: str):
        if 'max' in variable:
            col = 'coarse_temp_max_c'
        elif 'min' in variable:
            col = 'coarse_temp_min_c'
        elif 'rain' in variable:
            col = 'coarse_rainfall_mm'
        elif 'hum' in variable:
            col = 'coarse_humidity_pct'
        else:
            raise ValueError(f"Unknown variable: {variable}")
        return X[col].values


def get_preprocessor():
    return ColumnTransformer(
        transformers=[
            ('num', StandardScaler(), NUMERIC_FEATURES),
            ('cat', OneHotEncoder(handle_unknown='ignore', sparse_output=False), CATEGORICAL_FEATURES)
        ]
    )


def compute_locations_hash(locations: list) -> str:
    loc_str = ",".join(sorted(locations))
    return hashlib.sha256(loc_str.encode('utf-8')).hexdigest()[:12]


def create_meta_sidecar(model_name: str, region_id: str, train_locs: list, extra_info: dict = None) -> dict:
    libs = ['pandas', 'numpy', 'scikit-learn', 'lightgbm', 'joblib', 'shapely']
    versions = {}
    for lib in libs:
        try:
            versions[lib] = importlib.metadata.version(lib)
        except Exception:
            versions[lib] = "unknown"

    meta = {
        'model_name': model_name,
        'region_id': region_id,
        'library_versions': versions,
        'features': ALL_FEATURES,
        'numeric_features': NUMERIC_FEATURES,
        'categorical_features': CATEGORICAL_FEATURES,
        'train_locations_hash': compute_locations_hash(train_locs),
        'train_locations_count': len(train_locs),
        'trained_at': datetime.now(timezone.utc).isoformat(),
        'n_jobs': TRAIN_N_JOBS
    }
    if extra_info:
        meta.update(extra_info)
    return meta


class QuantileModelContainer:
    """Holds p10, p50, p90 LightGBM regressors with shared preprocessor."""
    def __init__(self, preprocessor, p10_model, p50_model, p90_model):
        self.preprocessor = preprocessor
        self.p10 = p10_model
        self.p50 = p50_model
        self.p90 = p90_model

    def predict(self, X: pd.DataFrame):
        X_trans = self.preprocessor.transform(X[ALL_FEATURES])
        pred_p50 = self.p50.predict(X_trans)
        return pred_p50

    def predict_quantiles(self, X: pd.DataFrame):
        X_trans = self.preprocessor.transform(X[ALL_FEATURES])
        p10 = self.p10.predict(X_trans)
        p50 = self.p50.predict(X_trans)
        p90 = self.p90.predict(X_trans)
        return p10, p50, p90


class RainfallHurdleModel:
    """
    Two-stage Hurdle Model:
    Stage 1: Calibrated classifier for rain occurrence (rain_probability)
    Stage 2: Quantile regressors for wet amounts (wet_amount_p10, p50, p90)
    """
    def __init__(self, preprocessor, classifier, calibrator, p10_amount, p50_amount, p90_amount, threshold=0.35, rain_day_mm=1.0):
        self.preprocessor = preprocessor
        self.classifier = classifier
        self.calibrator = calibrator
        self.p10_amount = p10_amount
        self.p50_amount = p50_amount
        self.p90_amount = p90_amount
        self.threshold = threshold
        self.rain_day_mm = rain_day_mm

    def predict_components(self, X: pd.DataFrame):
        X_trans = self.preprocessor.transform(X[ALL_FEATURES])
        
        raw_probs = self.classifier.predict_proba(X_trans)[:, 1]
        probs = self.calibrator.predict(raw_probs) if self.calibrator else raw_probs
        probs = np.clip(probs, 0.0, 1.0)

        wet_p10 = np.maximum(0.0, self.p10_amount.predict(X_trans))
        wet_p50 = np.maximum(0.0, self.p50_amount.predict(X_trans))
        wet_p90 = np.maximum(0.0, self.p90_amount.predict(X_trans))

        # Expected value: probability * conditional median
        expected_rain = probs * wet_p50

        return {
            'rain_probability': np.round(probs, 4),
            'wet_amount_p10': np.round(wet_p10, 2),
            'wet_amount_p50': np.round(wet_p50, 2),
            'wet_amount_p90': np.round(wet_p90, 2),
            'rainfall_mm': np.round(expected_rain, 2)
        }

    def predict(self, X: pd.DataFrame):
        res = self.predict_components(X)
        return res['rainfall_mm']


def train_region_models(region_id: str, data_dir: str, models_dir: str, split_dict: dict):
    os.makedirs(models_dir, exist_ok=True)
    df = pd.read_parquet(os.path.join(data_dir, 'training_features.parquet'))

    train_locs = set(split_dict['train_locations'])
    calib_locs = set(split_dict.get('calibration_locations', []))

    train_df = df[df['location_ref'].isin(train_locs)].copy()
    calib_df = df[df['location_ref'].isin(calib_locs)].copy() if calib_locs else train_df.iloc[:5000].copy()

    print(f"[{region_id}] Training models with {len(train_locs)} train locations ({len(train_df)} rows), "
          f"{len(calib_locs)} calibration locations ({len(calib_df)} rows).")

    # Fit feature preprocessor
    preprocessor = get_preprocessor()
    preprocessor.fit(train_df[ALL_FEATURES])

    X_train_trans = preprocessor.transform(train_df[ALL_FEATURES])
    X_calib_trans = preprocessor.transform(calib_df[ALL_FEATURES])

    # --- 1. Temperature Max Models (P10, P50, P90) ---
    print(f"[{region_id}] Training Temperature Max models (P10, P50, P90)...")
    y_tmax = train_df['target_temp_max_c'].values
    p10_tmax = lgb.LGBMRegressor(objective='quantile', alpha=0.10, n_estimators=100, random_state=42, n_jobs=TRAIN_N_JOBS).fit(X_train_trans, y_tmax)
    p50_tmax = lgb.LGBMRegressor(objective='regression', n_estimators=100, random_state=42, n_jobs=TRAIN_N_JOBS).fit(X_train_trans, y_tmax)
    p90_tmax = lgb.LGBMRegressor(objective='quantile', alpha=0.90, n_estimators=100, random_state=42, n_jobs=TRAIN_N_JOBS).fit(X_train_trans, y_tmax)

    tmax_container = QuantileModelContainer(preprocessor, p10_tmax, p50_tmax, p90_tmax)
    joblib.dump(tmax_container, os.path.join(models_dir, 'temperature_max.joblib'))
    with open(os.path.join(models_dir, 'temperature_max.meta.json'), 'w') as f:
        json.dump(create_meta_sidecar('temperature_max', region_id, list(train_locs)), f, indent=2)

    # --- 2. Temperature Min Models (P10, P50, P90) ---
    print(f"[{region_id}] Training Temperature Min models (P10, P50, P90)...")
    y_tmin = train_df['target_temp_min_c'].values
    p10_tmin = lgb.LGBMRegressor(objective='quantile', alpha=0.10, n_estimators=100, random_state=42, n_jobs=TRAIN_N_JOBS).fit(X_train_trans, y_tmin)
    p50_tmin = lgb.LGBMRegressor(objective='regression', n_estimators=100, random_state=42, n_jobs=TRAIN_N_JOBS).fit(X_train_trans, y_tmin)
    p90_tmin = lgb.LGBMRegressor(objective='quantile', alpha=0.90, n_estimators=100, random_state=42, n_jobs=TRAIN_N_JOBS).fit(X_train_trans, y_tmin)

    tmin_container = QuantileModelContainer(preprocessor, p10_tmin, p50_tmin, p90_tmin)
    joblib.dump(tmin_container, os.path.join(models_dir, 'temperature_min.joblib'))
    with open(os.path.join(models_dir, 'temperature_min.meta.json'), 'w') as f:
        json.dump(create_meta_sidecar('temperature_min', region_id, list(train_locs)), f, indent=2)

    # --- 3. Rainfall Hurdle Model ---
    print(f"[{region_id}] Training Rainfall Hurdle Model (Classifier + Quantile Amount)...")
    rain_day_mm = 1.0
    y_rain_train = train_df['target_rainfall_mm'].values
    is_wet_train = (y_rain_train >= rain_day_mm).astype(int)

    base_clf = lgb.LGBMClassifier(n_estimators=100, random_state=42, n_jobs=TRAIN_N_JOBS)
    base_clf.fit(X_train_trans, is_wet_train)

    # Isotonic calibration on held-out calibration locations
    raw_calib_probs = base_clf.predict_proba(X_calib_trans)[:, 1]
    y_rain_calib = calib_df['target_rainfall_mm'].values
    is_wet_calib = (y_rain_calib >= rain_day_mm).astype(int)

    calibrator = IsotonicRegression(out_of_bounds='clip')
    calibrator.fit(raw_calib_probs, is_wet_calib)

    # Train Amount Regressors on wet rows only
    wet_mask = y_rain_train >= rain_day_mm
    if np.sum(wet_mask) > 50:
        X_wet = X_train_trans[wet_mask]
        y_wet = y_rain_train[wet_mask]
    else:
        X_wet = X_train_trans
        y_wet = y_rain_train

    p10_amount = lgb.LGBMRegressor(objective='quantile', alpha=0.10, n_estimators=100, random_state=42, n_jobs=TRAIN_N_JOBS).fit(X_wet, y_wet)
    p50_amount = lgb.LGBMRegressor(objective='regression', n_estimators=100, random_state=42, n_jobs=TRAIN_N_JOBS).fit(X_wet, y_wet)
    p90_amount = lgb.LGBMRegressor(objective='quantile', alpha=0.90, n_estimators=100, random_state=42, n_jobs=TRAIN_N_JOBS).fit(X_wet, y_wet)

    hurdle = RainfallHurdleModel(
        preprocessor=preprocessor,
        classifier=base_clf,
        calibrator=calibrator,
        p10_amount=p10_amount,
        p50_amount=p50_amount,
        p90_amount=p90_amount,
        threshold=0.35,
        rain_day_mm=rain_day_mm
    )
    joblib.dump(hurdle, os.path.join(models_dir, 'rainfall.joblib'))
    with open(os.path.join(models_dir, 'rainfall.meta.json'), 'w') as f:
        json.dump(create_meta_sidecar('rainfall', region_id, list(train_locs), {
            'model_type': 'hurdle_classifier_and_quantile_amount',
            'rain_day_mm': rain_day_mm
        }), f, indent=2)

    print(f"[{region_id}] All models successfully trained and saved with sidecar metadata!")
