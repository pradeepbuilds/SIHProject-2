import os
import sys
import hashlib
import json
import pandas as pd
import geopandas as gpd
from datetime import datetime, timezone
from sqlalchemy import create_engine, func
from sqlalchemy.orm import sessionmaker
from geoalchemy2 import WKTElement

from krishimitra.config import get_all_regions, get_region_config
from backend.db.models import (
    Base, Region, RegionLoadState, District, Block, Panchayat, GridCell,
    EnvironmentalFeature, WeatherObservation, WeatherForecast
)


def compute_dir_hash(directory: str) -> str:
    h = hashlib.sha256()
    for root, _, files in sorted(os.walk(directory)):
        for f in sorted(files):
            if f.endswith('.parquet') or f.endswith('.geojson'):
                p = os.path.join(root, f)
                h.update(f.encode('utf-8'))
                h.update(str(os.path.getsize(p)).encode('utf-8'))
    return h.hexdigest()[:16]


def seed_region_data(region_id: str, db_url: str, force: bool = False):
    config = get_region_config(region_id)
    if not config:
        print(f"Error: Region config not found for {region_id}")
        return False

    engine = create_engine(db_url)
    Session = sessionmaker(bind=engine)
    session = Session()

    data_dir = os.path.join(os.path.dirname(__file__), '..', 'ml', 'data', region_id)
    if not os.path.exists(data_dir):
        print(f"Data directory missing for {region_id} at {data_dir}. Generating...")
        from krishimitra.generator import generate_region_geography, generate_environmental_features, generate_climate_weather_and_events
        b, p, g = generate_region_geography(config, data_dir)
        generate_environmental_features(config, p, g, data_dir)
        generate_climate_weather_and_events(config, b, p, data_dir)

    cur_hash = compute_dir_hash(data_dir)
    load_state = session.query(RegionLoadState).filter_by(region_id=region_id).first()

    if load_state and load_state.data_hash == cur_hash and not force:
        print(f"[{region_id}] Already loaded and data hash matches ({cur_hash}). Skipping.")
        session.close()
        return True

    print(f"[{region_id}] Seeding database (Data hash: {cur_hash})...")

    # 1. Upsert Region
    reg = session.query(Region).filter_by(id=region_id).first()
    if not reg:
        reg = Region(
            id=region_id,
            state=config.state,
            district=config.district,
            config_json=json.dumps(config.to_dict()),
            data_mode_json=json.dumps(config.data_mode),
            loaded_at=datetime.now(timezone.utc)
        )
        session.add(reg)
    else:
        reg.config_json = json.dumps(config.to_dict())
        reg.data_mode_json = json.dumps(config.data_mode)
        reg.loaded_at = datetime.now(timezone.utc)
    session.commit()

    # 2. District
    dist_id = f"DIST-{config.id_prefix.replace('PNC-', '')}-01"
    if region_id == 'ka-tumakuru':
        dist_id = 'DIST-KA-TUM'
    if not session.query(District).filter_by(id=dist_id).first():
        session.add(District(id=dist_id, region_id=region_id, name=config.district, state=config.state, lgd_code='550'))
        session.commit()

    # 3. Blocks
    blocks_gdf = gpd.read_parquet(os.path.join(data_dir, 'blocks.parquet'))
    for _, row in blocks_gdf.iterrows():
        b_id = str(row['id'])
        if not session.query(Block).filter_by(id=b_id).first():
            geom = WKTElement(row['geometry'].wkt, srid=4326) if row.get('geometry') is not None else None
            session.add(Block(
                id=b_id,
                region_id=region_id,
                district_id=dist_id,
                name=str(row['name']),
                lgd_code=str(row.get('lgd_code', '')),
                geometry=geom
            ))
    session.commit()

    # 4. Panchayats
    panchayats_gdf = gpd.read_parquet(os.path.join(data_dir, 'panchayats.parquet'))
    for _, row in panchayats_gdf.iterrows():
        p_id = str(row['id'])
        if not session.query(Panchayat).filter_by(id=p_id).first():
            geom = WKTElement(row['geometry'].wkt, srid=4326) if row.get('geometry') is not None else None
            session.add(Panchayat(
                id=p_id,
                region_id=region_id,
                block_id=str(row['block_id']),
                name=str(row['name']),
                lgd_code=str(row.get('lgd_code', '')),
                geometry=geom,
                is_synthetic_boundary=bool(row.get('is_synthetic_boundary', True)),
                boundary_is_official=bool(row.get('boundary_is_official', False))
            ))
    session.commit()

    # 5. Grids
    grids_file = os.path.join(data_dir, 'grids.parquet')
    if os.path.exists(grids_file):
        grids_gdf = gpd.read_parquet(grids_file)
        if session.query(func.count(GridCell.id)).filter_by(region_id=region_id).scalar() == 0:
            grid_objs = []
            for _, row in grids_gdf.iterrows():
                geom = WKTElement(row['geometry'].wkt, srid=4326) if row.get('geometry') is not None else None
                cent_val = row['centroid']
                cent_wkt = cent_val.wkt if hasattr(cent_val, 'wkt') else str(cent_val)
                grid_objs.append(GridCell(
                    id=str(row['id']),
                    region_id=region_id,
                    block_id=str(row['block_id']),
                    geometry=geom,
                    centroid=WKTElement(cent_wkt, srid=4326)
                ))
            session.bulk_save_objects(grid_objs)
            session.commit()

    # 6. Environmental Features (All rows, preserving string classifications)
    features_df = pd.read_parquet(os.path.join(data_dir, 'environmental_features.parquet'))
    loc_refs = set(panchayats_gdf['id'])
    if os.path.exists(grids_file):
        loc_refs.update(set(grids_gdf['id']))

    # Check if features for these locations exist
    sample_ref = str(features_df['location_ref'].iloc[0])
    if not session.query(EnvironmentalFeature).filter_by(location_ref=sample_ref).first():
        feat_objs = []
        for _, row in features_df.iterrows():
            val_num = float(row['value_num']) if pd.notna(row['value_num']) else None
            val_str = str(row['value_str']) if pd.notna(row['value_str']) else None
            feat_objs.append(EnvironmentalFeature(
                location_ref=str(row['location_ref']),
                feature_name=str(row['feature_name']),
                value_num=val_num,
                value_str=val_str,
                value=val_num,
                valid_from=pd.to_datetime(row['valid_from']).date() if pd.notna(row.get('valid_from')) else None,
                valid_to=pd.to_datetime(row['valid_to']).date() if pd.notna(row.get('valid_to')) else None,
                is_synthetic=bool(row.get('is_synthetic', True))
            ))
        batch_size = 15000
        for i in range(0, len(feat_objs), batch_size):
            session.bulk_save_objects(feat_objs[i:i + batch_size])
            session.commit()

    # 7. Weather Observations & Forecasts
    obs_df = pd.read_parquet(os.path.join(data_dir, 'weather_observations.parquet'))
    if session.query(WeatherObservation).filter(WeatherObservation.location_ref.in_(list(panchayats_gdf['id'])[:5])).count() == 0:
        obs_objs = []
        for _, row in obs_df.iterrows():
            obs_objs.append(WeatherObservation(
                location_ref=str(row['location_ref']),
                timestamp=pd.to_datetime(row['timestamp']),
                variable=str(row['variable']),
                value=float(row['value']),
                source=str(row.get('source', 'synthetic')),
                is_synthetic=bool(row.get('is_synthetic', True)),
                data_source_tag=str(row.get('data_source_tag', 'OBSERVED'))
            ))
        batch_size = 15000
        for i in range(0, len(obs_objs), batch_size):
            session.bulk_save_objects(obs_objs[i:i + batch_size])
            session.commit()

    fcst_df = pd.read_parquet(os.path.join(data_dir, 'weather_forecasts.parquet'))
    if session.query(WeatherForecast).filter(WeatherForecast.block_id.in_(list(blocks_gdf['id'])[:3])).count() == 0:
        fcst_objs = []
        for _, row in fcst_df.iterrows():
            fcst_objs.append(WeatherForecast(
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
        for i in range(0, len(fcst_objs), batch_size):
            session.bulk_save_objects(fcst_objs[i:i + batch_size])
            session.commit()

    # Update or insert RegionLoadState
    if not load_state:
        session.add(RegionLoadState(region_id=region_id, data_hash=cur_hash, loaded_at=datetime.now(timezone.utc)))
    else:
        load_state.data_hash = cur_hash
        load_state.loaded_at = datetime.now(timezone.utc)
    session.commit()
    session.close()
    print(f"[{region_id}] Seeding finished successfully and recorded in region_load_state.")
    return True


def seed_all_regions(db_url: str = None, force: bool = False):
    url = db_url or os.getenv("DATABASE_URL", "postgresql+psycopg2://app:app@postgres:5432/weatherdb")
    if url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+psycopg2://")

    # Run alembic upgrade head first
    try:
        from alembic.config import Config
        from alembic import command
        alembic_ini = os.path.join(os.path.dirname(__file__), '..', 'backend', 'alembic.ini')
        if os.path.exists(alembic_ini):
            print("Applying Alembic migrations...")
            cfg = Config(alembic_ini)
            command.upgrade(cfg, "head")
    except Exception as e:
        print(f"Alembic auto-migration warning: {e}")

    regions = get_all_regions()
    for r in regions:
        seed_region_data(r.region_id, url, force=force)
