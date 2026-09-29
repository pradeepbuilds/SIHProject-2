import os
import pandas as pd
import geopandas as gpd

DATA_DIR = os.path.join(os.path.dirname(__file__), 'ml', 'data', 'synthetic')

print("=== VERIFYING PHASE 1: SYNTHETIC DATA GENERATION ===")

files = [
    'blocks.parquet',
    'panchayats.parquet',
    'grids.parquet',
    'environmental_features.parquet',
    'weather_observations.parquet',
    'weather_forecasts.parquet'
]

for f in files:
    path = os.path.join(DATA_DIR, f)
    if not os.path.exists(path):
        print(f"[FAIL] MISSING: {f}")
        continue
    
    if f in ['blocks.parquet', 'panchayats.parquet', 'grids.parquet']:
        df = gpd.read_parquet(path)
    else:
        df = pd.read_parquet(path)
        
    print(f"[OK] FOUND: {f} - Rows: {len(df)}")
    print(f"   Columns: {list(df.columns)}")

print("\n=== VERIFYING PHASE 2: SQLALCHEMY MODELS ===")
try:
    from backend.db.models import Base
    print(f"[OK] Models imported successfully. Found {len(Base.metadata.tables)} tables defined.")
    for table_name in Base.metadata.tables.keys():
        print(f"   - {table_name}")
except Exception as e:
    print(f"[FAIL] Failed to import models: {e}")
