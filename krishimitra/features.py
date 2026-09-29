import os
import pandas as pd


def build_region_features(region_id: str, data_dir: str):
    out_path = os.path.join(data_dir, 'training_features.parquet')
    if os.path.exists(out_path):
        print(f"[{region_id}] training_features.parquet already exists at {out_path}.")
        return pd.read_parquet(out_path)

    print(f"[{region_id}] Building feature table...")
    panchayats = pd.read_parquet(os.path.join(data_dir, 'panchayats.parquet'))
    loc_to_block = dict(zip(panchayats['id'], panchayats['block_id']))

    grids_file = os.path.join(data_dir, 'grids.parquet')
    if os.path.exists(grids_file):
        grids = pd.read_parquet(grids_file)
        loc_to_block.update(dict(zip(grids['id'], grids['block_id'])))

    # Environmental static features
    env_df = pd.read_parquet(os.path.join(data_dir, 'environmental_features.parquet'))
    env_df['value'] = env_df['value_num'].fillna(env_df['value_str'])
    static_features = env_df.pivot(index='location_ref', columns='feature_name', values='value').reset_index()

    # Weather observations (targets)
    obs_df = pd.read_parquet(os.path.join(data_dir, 'weather_observations.parquet'))
    targets = obs_df.pivot(index=['location_ref', 'timestamp'], columns='variable', values='value').reset_index()
    targets.rename(columns={
        'temp_max_c': 'target_temp_max_c',
        'temp_min_c': 'target_temp_min_c',
        'rainfall_mm': 'target_rainfall_mm',
        'humidity_pct': 'target_humidity_pct'
    }, inplace=True)
    targets['target_date'] = targets['timestamp'].astype(str).str.slice(0, 10)
    targets['block_id'] = targets['location_ref'].map(loc_to_block)

    # Forecasts (features)
    fcst_df = pd.read_parquet(os.path.join(data_dir, 'weather_forecasts.parquet'))
    forecasts = fcst_df.pivot(
        index=['block_id', 'target_date', 'forecast_date', 'horizon_days'],
        columns='variable',
        values='value'
    ).reset_index()
    forecasts.rename(columns={
        'temp_max_c': 'coarse_temp_max_c',
        'temp_min_c': 'coarse_temp_min_c',
        'rainfall_mm': 'coarse_rainfall_mm',
        'humidity_pct': 'coarse_humidity_pct'
    }, inplace=True)
    forecasts['target_date'] = forecasts['target_date'].astype(str).str.slice(0, 10)

    # Join features
    merged = pd.merge(forecasts, targets, on=['block_id', 'target_date'], how='inner')
    final_df = pd.merge(merged, static_features, on='location_ref', how='inner')

    final_df.to_parquet(out_path)
    print(f"[{region_id}] Created feature table: shape {final_df.shape} saved to {out_path}")
    return final_df
