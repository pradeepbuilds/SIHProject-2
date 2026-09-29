import os
import sys
import argparse
import pandas as pd
import geopandas as gpd
from sqlalchemy import create_engine, select, func
from sqlalchemy.orm import sessionmaker
from geoalchemy2 import WKTElement

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from backend.db.models import (
    Base, Region, District, Block, Panchayat, GridCell,
    EnvironmentalFeature, WeatherObservation, WeatherForecast
)

DATA_DIR = os.path.join(os.path.dirname(__file__), '..', 'ml', 'data', 'synthetic')


def get_db_url():
    url = os.getenv("DATABASE_URL", "postgresql+psycopg2://app:app@postgres:5432/weatherdb")
    if url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+psycopg2://")
    return url


def load_synthetic_data(database_url=None, data_dir=DATA_DIR):
    db_url = database_url or get_db_url()
    print(f"Connecting to database at {db_url}...")
    engine = create_engine(db_url)
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()

    print("--- 1. Loading Region & District ---")
    reg = session.query(Region).filter_by(id='ka-tumakuru').first()
    if not reg:
        reg = Region(
            id='ka-tumakuru',
            state='Karnataka',
            district='Tumakuru',
            config_json='{"region_id":"ka-tumakuru","name":"Tumakuru"}',
            data_mode_json='{"weather":"synthetic","terrain":"synthetic","boundaries_district":"real"}',
            loaded_at=pd.Timestamp.now(tz='UTC')
        )
        session.add(reg)
        session.commit()

    if not session.query(District).filter_by(id='DIST-KA-TUM').first():
        d = District(id='DIST-KA-TUM', region_id='ka-tumakuru', name='Tumakuru', state='Karnataka', lgd_code='550')
        session.add(d)
        session.commit()

    # Load Parquet Data
    blocks_file = os.path.join(data_dir, 'blocks.parquet')
    panchayats_file = os.path.join(data_dir, 'panchayats.parquet')
    grids_file = os.path.join(data_dir, 'grids.parquet')
    features_file = os.path.join(data_dir, 'environmental_features.parquet')
    obs_file = os.path.join(data_dir, 'weather_observations.parquet')
    fcst_file = os.path.join(data_dir, 'weather_forecasts.parquet')

    blocks_gdf = gpd.read_parquet(blocks_file)
    panchayats_gdf = gpd.read_parquet(panchayats_file)
    grids_gdf = gpd.read_parquet(grids_file)
    features_df = pd.read_parquet(features_file)
    obs_df = pd.read_parquet(obs_file)
    fcst_df = pd.read_parquet(fcst_file)

    print("--- 2. Loading Blocks ---")
    for _, row in blocks_gdf.iterrows():
        if not session.query(Block).filter_by(id=row['id']).first():
            geom = WKTElement(row['geometry'].wkt, srid=4326) if row.get('geometry') is not None else None
            b = Block(
                id=str(row['id']),
                region_id='ka-tumakuru',
                district_id=str(row['district_id']),
                name=str(row['name']),
                lgd_code=str(row.get('lgd_code', '')),
                geometry=geom
            )
            session.add(b)
    session.commit()

    print("--- 3. Loading Panchayats ---")
    for _, row in panchayats_gdf.iterrows():
        if not session.query(Panchayat).filter_by(id=row['id']).first():
            geom = WKTElement(row['geometry'].wkt, srid=4326) if row.get('geometry') is not None else None
            p = Panchayat(
                id=str(row['id']),
                region_id='ka-tumakuru',
                block_id=str(row['block_id']),
                name=str(row['name']),
                lgd_code=str(row.get('lgd_code', '')),
                geometry=geom,
                is_synthetic_boundary=bool(row.get('is_synthetic_boundary', True)),
                boundary_is_official=bool(row.get('boundary_is_official', False))
            )
            session.add(p)
    session.commit()

    print("--- 4. Loading Grid Cells ---")
    existing_grid_count = session.query(func.count(GridCell.id)).scalar()
    if existing_grid_count == 0:
        grid_objects = []
        for _, row in grids_gdf.iterrows():
            geom = WKTElement(row['geometry'].wkt, srid=4326) if row.get('geometry') is not None else None
            cent_val = row['centroid']
            cent_wkt = cent_val.wkt if hasattr(cent_val, 'wkt') else str(cent_val)
            cent = WKTElement(cent_wkt, srid=4326)
            grid_objects.append(GridCell(
                id=str(row['id']),
                region_id='ka-tumakuru',
                block_id=str(row['block_id']),
                geometry=geom,
                centroid=cent
            ))
        session.bulk_save_objects(grid_objects)
        session.commit()

    print("--- 5. Loading Environmental Features (including string features) ---")
    existing_feat_count = session.query(func.count(EnvironmentalFeature.id)).scalar()
    if existing_feat_count == 0:
        feature_objects = []
        for _, row in features_df.iterrows():
            val_num = float(row['value_num']) if pd.notna(row['value_num']) else None
            val_str = str(row['value_str']) if pd.notna(row['value_str']) else None
            feature_objects.append(EnvironmentalFeature(
                location_ref=str(row['location_ref']),
                feature_name=str(row['feature_name']),
                value_num=val_num,
                value_str=val_str,
                value=val_num,  # Backwards compatibility
                valid_from=pd.to_datetime(row['valid_from']).date() if pd.notna(row.get('valid_from')) else None,
                valid_to=pd.to_datetime(row['valid_to']).date() if pd.notna(row.get('valid_to')) else None,
                is_synthetic=bool(row.get('is_synthetic', True))
            ))
        # Batch insert for memory & speed
        batch_size = 10000
        for i in range(0, len(feature_objects), batch_size):
            session.bulk_save_objects(feature_objects[i:i + batch_size])
            session.commit()

    print("--- 6. Loading Observations ---")
    existing_obs_count = session.query(func.count(WeatherObservation.id)).scalar()
    if existing_obs_count == 0:
        obs_objects = []
        for _, row in obs_df.iterrows():
            obs_objects.append(WeatherObservation(
                location_ref=str(row['location_ref']),
                timestamp=pd.to_datetime(row['timestamp']),
                variable=str(row['variable']),
                value=float(row['value']),
                source=str(row.get('source', 'synthetic')),
                is_synthetic=bool(row.get('is_synthetic', True)),
                data_source_tag=str(row.get('data_source_tag', 'OBSERVED'))
            ))
        batch_size = 15000
        for i in range(0, len(obs_objects), batch_size):
            session.bulk_save_objects(obs_objects[i:i + batch_size])
            session.commit()

    print("--- 7. Loading Weather Forecasts ---")
    existing_fcst_count = session.query(func.count(WeatherForecast.id)).scalar()
    if existing_fcst_count == 0:
        fcst_objects = []
        for _, row in fcst_df.iterrows():
            fcst_objects.append(WeatherForecast(
                block_id=str(row['block_id']),
                forecast_date=pd.to_datetime(row['forecast_date']).date(),
                target_date=pd.to_datetime(row['target_date']).date(),
                horizon_days=int(row['horizon_days']),
                variable=str(row['variable']),
                value=float(row['value']),
                is_synthetic=bool(row.get('is_synthetic', True)),
                data_source_tag=str(row.get('data_source_tag', 'FORECAST'))
            ))
        batch_size = 15000
        for i in range(0, len(fcst_objects), batch_size):
            session.bulk_save_objects(fcst_objects[i:i + batch_size])
            session.commit()

    # --- ASSERTIONS (B1 requirement) ---
    print("\n" + "=" * 60)
    print("VERIFYING DATABASE VS PARQUET ROW COUNTS")
    print("=" * 60)

    counts = [
        ("block", session.query(func.count(Block.id)).scalar(), len(blocks_gdf)),
        ("panchayat", session.query(func.count(Panchayat.id)).scalar(), len(panchayats_gdf)),
        ("grid_cell", session.query(func.count(GridCell.id)).scalar(), len(grids_gdf)),
        ("environmental_feature", session.query(func.count(EnvironmentalFeature.id)).scalar(), len(features_df)),
        ("weather_observation", session.query(func.count(WeatherObservation.id)).scalar(), len(obs_df)),
        ("weather_forecast", session.query(func.count(WeatherForecast.id)).scalar(), len(fcst_df)),
    ]

    all_matched = True
    for table_name, db_cnt, pq_cnt in counts:
        match_str = "MATCH" if db_cnt == pq_cnt else "MISMATCH"
        print(f"Table: {table_name:<25} | DB: {db_cnt:<8} | Parquet: {pq_cnt:<8} [{match_str}]")
        if db_cnt != pq_cnt:
            all_matched = False

    session.close()

    if not all_matched:
        raise ValueError("Assertion Failed: DB row counts do not match Parquet row counts!")
    print("\nAll database row counts exactly equal Parquet dataset row counts! (B1 Passed)")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Load synthetic datasets into PostgreSQL")
    parser.add_argument("--db-url", type=str, default=None, help="Database URL")
    parser.add_argument("--data-dir", type=str, default=DATA_DIR, help="Data directory path")
    args = parser.parse_args()

    load_synthetic_data(args.db_url, args.data_dir)
