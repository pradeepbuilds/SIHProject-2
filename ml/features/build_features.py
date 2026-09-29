import os
import pandas as pd
import numpy as np

DATA_DIR = os.path.join(os.path.dirname(__file__), '..', 'data', 'synthetic')
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'data', 'features')

def build_feature_table():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    print("Loading datasets...")
    # 1. Load Locations (Panchayats and Grids) to map location_id -> block_id
    panchayats = pd.read_parquet(os.path.join(DATA_DIR, 'panchayats.parquet'))
    grids = pd.read_parquet(os.path.join(DATA_DIR, 'grids.parquet'))
    
    loc_to_block = {}
    for _, row in panchayats.iterrows():
        loc_to_block[row['id']] = row['block_id']
    for _, row in grids.iterrows():
        loc_to_block[row['id']] = row['block_id']
        
    print(f"Loaded {len(loc_to_block)} location mappings.")
        
    # 2. Load Environmental Features
    env_df = pd.read_parquet(os.path.join(DATA_DIR, 'environmental_features.parquet'))
    # Coalesce value_num and value_str into a single value column
    env_df['value'] = env_df['value_num'].fillna(env_df['value_str'])
    static_features = env_df.pivot(index='location_ref', columns='feature_name', values='value').reset_index()
    
    # 3. Load Weather Observations (Targets)
    obs_df = pd.read_parquet(os.path.join(DATA_DIR, 'weather_observations.parquet'))
    # Pivot so each location+timestamp has columns for temp_max, rainfall, etc.
    targets = obs_df.pivot(index=['location_ref', 'timestamp'], columns='variable', values='value').reset_index()
    targets.rename(columns={
        'temp_max_c': 'target_temp_max_c',
        'temp_min_c': 'target_temp_min_c',
        'rainfall_mm': 'target_rainfall_mm',
        'humidity_pct': 'target_humidity_pct'
    }, inplace=True)
    
    # Ensure timestamp is string for merging
    targets['target_date'] = targets['timestamp'].astype(str)
    
    # 4. Load Forecasts (Features)
    fcst_df = pd.read_parquet(os.path.join(DATA_DIR, 'weather_forecasts.parquet'))
    # Pivot forecasts
    forecasts = fcst_df.pivot(index=['block_id', 'target_date', 'forecast_date', 'horizon_days'], columns='variable', values='value').reset_index()
    forecasts.rename(columns={
        'temp_max_c': 'coarse_temp_max_c',
        'temp_min_c': 'coarse_temp_min_c',
        'rainfall_mm': 'coarse_rainfall_mm',
        'humidity_pct': 'coarse_humidity_pct'
    }, inplace=True)
    
    # 5. Join them all together
    print("Joining features...")
    # Add block_id to targets
    targets['block_id'] = targets['location_ref'].map(loc_to_block)
    
    # Join targets with block forecasts on block_id and target_date
    # Since forecasts have multiple horizons for each target_date, this will multiply rows (1 observation -> N horizon predictions)
    merged = pd.merge(forecasts, targets, on=['block_id', 'target_date'], how='inner')
    
    # Join static features
    final_df = pd.merge(merged, static_features, on='location_ref', how='inner')
    
    print(f"Final feature table shape: {final_df.shape}")
    
    # Check nulls in required columns
    required_cols = ['coarse_temp_max_c', 'elevation', 'ndvi', 'target_temp_max_c']
    null_counts = final_df[required_cols].isnull().sum()
    if null_counts.sum() > 0:
        print("WARNING: Nulls found in required columns!")
        print(null_counts[null_counts > 0])
    else:
        print("Validation Passed: No nulls in required columns.")
        
    out_path = os.path.join(OUTPUT_DIR, 'training_features.parquet')
    final_df.to_parquet(out_path)
    print(f"Saved to {out_path}")

if __name__ == "__main__":
    build_feature_table()
