import os
import sys
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.pipeline import Pipeline
import joblib

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))
from ml.preprocessing.split import create_or_load_split
import lightgbm as lgb

DATA_DIR = os.path.join(os.path.dirname(__file__), '..', 'data', 'features')
MODEL_DIR = os.path.join(os.path.dirname(__file__), '..', 'models')

NUMERIC_FEATURES = ['horizon_days', 'coarse_temp_max_c', 'coarse_temp_min_c', 'coarse_rainfall_mm', 'coarse_humidity_pct', 'aspect', 'distance_to_water_km', 'elevation', 'ndvi', 'ndwi', 'slope']
CATEGORICAL_FEATURES = ['land_cover_class', 'soil_texture_class']

def get_preprocessor():
    numeric_transformer = StandardScaler()
    categorical_transformer = OneHotEncoder(handle_unknown='ignore')

    preprocessor = ColumnTransformer(
        transformers=[
            ('num', numeric_transformer, NUMERIC_FEATURES),
            ('cat', categorical_transformer, CATEGORICAL_FEATURES)
        ])
    return preprocessor

def train_temperature():
    print("Loading feature table...")
    df = pd.read_parquet(os.path.join(DATA_DIR, 'training_features.parquet'))
    
    split = create_or_load_split()
    train_locs = set(split['train_locations'])
    
    train_df = df[df['location_ref'].isin(train_locs)].copy()
    
    X_train = train_df[NUMERIC_FEATURES + CATEGORICAL_FEATURES]
    y_train_tmax = train_df['target_temp_max_c']
    y_train_tmin = train_df['target_temp_min_c']
    
    preprocessor = get_preprocessor()
    
    print("Training Temperature Max ML model...")
    model_tmax = Pipeline(steps=[
        ('preprocessor', preprocessor),
        ('regressor', lgb.LGBMRegressor(n_estimators=100, random_state=42, n_jobs=2))
    ])
    model_tmax.fit(X_train, y_train_tmax)
    
    print("Training Temperature Min ML model...")
    model_tmin = Pipeline(steps=[
        ('preprocessor', preprocessor),
        ('regressor', lgb.LGBMRegressor(n_estimators=100, random_state=42, n_jobs=2))
    ])
    model_tmin.fit(X_train, y_train_tmin)
    
    print("Training Rainfall ML model...")
    y_train_rain = train_df['target_rainfall_mm']
    model_rain = Pipeline(steps=[
        ('preprocessor', preprocessor),
        ('regressor', lgb.LGBMRegressor(n_estimators=100, random_state=42, n_jobs=2))
    ])
    model_rain.fit(X_train, y_train_rain)
    
    os.makedirs(MODEL_DIR, exist_ok=True)
    joblib.dump(model_tmax, os.path.join(MODEL_DIR, 'temperature_max.joblib'))
    joblib.dump(model_tmin, os.path.join(MODEL_DIR, 'temperature_min.joblib'))
    joblib.dump(model_rain, os.path.join(MODEL_DIR, 'rainfall.joblib'))
    print("Models saved.")

if __name__ == '__main__':
    train_temperature()
