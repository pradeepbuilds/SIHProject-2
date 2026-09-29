import os
import json
import numpy as np
import pandas as pd
import geopandas as gpd
from datetime import datetime, timedelta
from shapely.geometry import Point, Polygon, MultiPolygon, box
from shapely.ops import voronoi_diagram
from krishimitra.config import RegionConfig, get_region_config


def generate_region_geography(config: RegionConfig, data_dir: str):
    """
    Generates blocks, panchayats, and regular grid cells for a region
    clipped to its official district polygon.
    """
    os.makedirs(data_dir, exist_ok=True)

    # If ka-tumakuru, check if legacy data exists to preserve exact 100% regression compatibility
    if config.region_id == 'ka-tumakuru':
        legacy_dir = os.path.join(os.path.dirname(__file__), '..', 'ml', 'data', 'synthetic')
        legacy_blocks = os.path.join(legacy_dir, 'blocks.parquet')
        if os.path.exists(legacy_blocks):
            b_gdf = gpd.read_parquet(legacy_blocks)
            p_gdf = gpd.read_parquet(os.path.join(legacy_dir, 'panchayats.parquet'))
            g_gdf = gpd.read_parquet(os.path.join(legacy_dir, 'grids.parquet'))

            b_gdf['region_id'] = config.region_id
            p_gdf['region_id'] = config.region_id
            p_gdf['boundary_is_official'] = False
            g_gdf['region_id'] = config.region_id

            b_gdf.to_parquet(os.path.join(data_dir, 'blocks.parquet'))
            p_gdf.to_parquet(os.path.join(data_dir, 'panchayats.parquet'))
            g_gdf.to_parquet(os.path.join(data_dir, 'grids.parquet'))
            print(f"[{config.region_id}] Preserved {len(b_gdf)} blocks, {len(p_gdf)} panchayats.")
            return b_gdf, p_gdf, g_gdf

    # Load district geometry
    dist_geom = config.district_geometry
    if dist_geom is None:
        raise ValueError(f"District geometry missing for {config.region_id}")

    sub_cfg = config.boundary.get('sub_units', {})
    seed = sub_cfg.get('seed', 42)
    rng = np.random.default_rng(seed)
    n_blocks = sub_cfg.get('blocks', 8)
    minx, miny, maxx, maxy = dist_geom.bounds

    # 1. Generate Blocks via seeded Voronoi inside district polygon
    block_pts = []
    attempts = 0
    while len(block_pts) < n_blocks and attempts < 1000:
        attempts += 1
        pt = Point(rng.uniform(minx, maxx), rng.uniform(miny, maxy))
        if dist_geom.contains(pt):
            block_pts.append(pt)

    mp = gpd.GeoSeries(block_pts).union_all()
    vor_blocks = voronoi_diagram(mp, envelope=dist_geom)
    vor_list = [vor_blocks] if isinstance(vor_blocks, Polygon) else list(vor_blocks.geoms)

    blocks = []
    b_id = 1
    for poly in vor_list:
        clipped = poly.intersection(dist_geom)
        if not clipped.is_empty and clipped.area > 1e-4:
            blocks.append({
                'id': f"BLK-{config.region_id[:2].upper()}-{b_id:03d}",
                'region_id': config.region_id,
                'district_id': f"DIST-{config.region_id[:2].upper()}-01",
                'name': f"Block {b_id}",
                'lgd_code': f"LGD-B{b_id}",
                'geometry': clipped
            })
            b_id += 1

    b_gdf = gpd.GeoDataFrame(blocks, crs="EPSG:4326")
    b_gdf.to_parquet(os.path.join(data_dir, 'blocks.parquet'))

    # 2. Generate Panchayats inside each block
    panchayats = []
    p_id = 1
    p_range = sub_cfg.get('panchayats_per_block', [8, 14])

    for _, block in b_gdf.iterrows():
        b_geom = block['geometry']
        bx_min, by_min, bx_max, by_max = b_geom.bounds
        n_p = rng.integers(p_range[0], p_range[1] + 1)
        pts = []
        p_attempts = 0
        while len(pts) < n_p and p_attempts < 1000:
            p_attempts += 1
            pt = Point(rng.uniform(bx_min, bx_max), rng.uniform(by_min, by_max))
            if b_geom.contains(pt):
                pts.append(pt)

        if len(pts) > 1:
            mp_p = gpd.GeoSeries(pts).union_all()
            vor_p = voronoi_diagram(mp_p, envelope=b_geom)
            p_polys = [vor_p] if isinstance(vor_p, Polygon) else list(vor_p.geoms)
        else:
            p_polys = [b_geom]

        for poly in p_polys:
            p_clip = poly.intersection(b_geom)
            if not p_clip.is_empty and p_clip.area > 1e-5:
                panchayats.append({
                    'id': f"{config.id_prefix}-{p_id:04d}",
                    'region_id': config.region_id,
                    'block_id': block['id'],
                    'name': f"Panchayat {p_id}",
                    'lgd_code': f"LGD-P{p_id}",
                    'geometry': p_clip,
                    'is_synthetic_boundary': True,
                    'boundary_is_official': False
                })
                p_id += 1

    p_gdf = gpd.GeoDataFrame(panchayats, crs="EPSG:4326")
    p_gdf.to_parquet(os.path.join(data_dir, 'panchayats.parquet'))

    # 3. Generate Grids (~1 km / 0.009 degree)
    grids = []
    g_id = 1
    step = 0.018 # ~2km grid for speed and memory efficiency across multi-regions
    gx = np.arange(minx, maxx, step)
    gy = np.arange(miny, maxy, step)

    for x in gx:
        for y in gy:
            cell = box(x, y, x + step, y + step)
            c_inter = cell.intersection(dist_geom)
            if not c_inter.is_empty and c_inter.area > 1e-6:
                # Find matching block
                matched_block = b_gdf[b_gdf.geometry.intersects(c_inter)]
                blk_id = matched_block.iloc[0]['id'] if not matched_block.empty else b_gdf.iloc[0]['id']
                grids.append({
                    'id': f"GRD-{config.region_id[:2].upper()}-{g_id:05d}",
                    'region_id': config.region_id,
                    'block_id': blk_id,
                    'geometry': c_inter,
                    'centroid': c_inter.centroid.wkt
                })
                g_id += 1

    g_gdf = gpd.GeoDataFrame(grids, crs="EPSG:4326")
    g_gdf.to_parquet(os.path.join(data_dir, 'grids.parquet'))

    print(f"[{config.region_id}] Generated {len(b_gdf)} blocks, {len(p_gdf)} panchayats, {len(g_gdf)} grid cells.")
    return b_gdf, p_gdf, g_gdf


def generate_environmental_features(config: RegionConfig, p_gdf, g_gdf, data_dir: str):
    """
    Generates terrain & land cover static features for all panchayats and grid cells.
    """
    if config.region_id == 'ka-tumakuru':
        legacy_file = os.path.join(os.path.dirname(__file__), '..', 'ml', 'data', 'synthetic', 'environmental_features.parquet')
        if os.path.exists(legacy_file):
            df = pd.read_parquet(legacy_file)
            df.to_parquet(os.path.join(data_dir, 'environmental_features.parquet'))
            return df

    seed = hash(config.region_id) % 10000
    rng = np.random.default_rng(seed)

    locations = list(p_gdf['id']) + list(g_gdf['id'])
    rows = []

    # Agro-climatic defaults
    base_elev = 40.0 if 'coastal' in config.agro_climatic_zone.lower() else (
        250.0 if 'plains' in config.agro_climatic_zone.lower() else (
            280.0 if 'arid' in config.agro_climatic_zone.lower() else 750.0
        )
    )

    land_covers = ['cropland', 'cropland', 'cropland', 'vegetation', 'builtup', 'barren']
    soil_textures = ['red_loamy', 'black_cotton', 'alluvial', 'sandy_loam', 'clayey']

    for loc in locations:
        elev = max(10.0, float(base_elev + rng.normal(0, base_elev * 0.25)))
        slope = max(0.5, float(abs(rng.normal(2.5, 2.0))))
        aspect = float(rng.uniform(0, 360))
        dist_water = max(0.2, float(abs(rng.normal(3.0, 2.5))))
        ndvi = float(np.clip(rng.normal(0.55 if 'plains' in config.agro_climatic_zone.lower() else 0.40, 0.15), 0.05, 0.90))
        ndwi = float(np.clip(rng.normal(0.10, 0.12), -0.20, 0.60))
        lc = rng.choice(land_covers)
        st = rng.choice(soil_textures)

        num_features = {
            'elevation': elev,
            'slope': slope,
            'aspect': aspect,
            'distance_to_water_km': dist_water,
            'ndvi': ndvi,
            'ndwi': ndwi
        }

        for f_name, f_val in num_features.items():
            rows.append({
                'location_ref': loc,
                'feature_name': f_name,
                'value_num': round(f_val, 4),
                'value_str': None,
                'valid_from': '2026-01-01',
                'valid_to': '2026-12-31',
                'is_synthetic': True
            })

        rows.append({
            'location_ref': loc,
            'feature_name': 'land_cover_class',
            'value_num': None,
            'value_str': lc,
            'valid_from': '2026-01-01',
            'valid_to': '2026-12-31',
            'is_synthetic': True
        })
        rows.append({
            'location_ref': loc,
            'feature_name': 'soil_texture_class',
            'value_num': None,
            'value_str': st,
            'valid_from': '2026-01-01',
            'valid_to': '2026-12-31',
            'is_synthetic': True
        })

    env_df = pd.DataFrame(rows)
    env_df.to_parquet(os.path.join(data_dir, 'environmental_features.parquet'))
    print(f"[{config.region_id}] Created {len(env_df)} environmental feature records.")
    return env_df


def generate_climate_weather_and_events(config: RegionConfig, b_gdf, p_gdf, data_dir: str):
    """
    Generates climate-calibrated observations, block forecasts, and structured event catalog.
    """
    # Check if Tumakuru legacy observations and forecasts exist to preserve regression exactly
    if config.region_id == 'ka-tumakuru':
        legacy_dir = os.path.join(os.path.dirname(__file__), '..', 'ml', 'data', 'synthetic')
        legacy_obs = os.path.join(legacy_dir, 'weather_observations.parquet')
        legacy_fcst = os.path.join(legacy_dir, 'weather_forecasts.parquet')
        if os.path.exists(legacy_obs) and os.path.exists(legacy_fcst):
            obs_df = pd.read_parquet(legacy_obs)
            fcst_df = pd.read_parquet(legacy_fcst)
            obs_df.to_parquet(os.path.join(data_dir, 'weather_observations.parquet'))
            fcst_df.to_parquet(os.path.join(data_dir, 'weather_forecasts.parquet'))
            
            # Generate event catalog for Tumakuru
            events = [
                {
                    "region_id": "ka-tumakuru",
                    "event_id": "EVT-TUM-01",
                    "event_type": "heavy_rain",
                    "label": "Pre-Monsoon Convective Downpour (15 May 2026)",
                    "date": "2026-05-15",
                    "suggested_panchayat": "PNC-KA-0001",
                    "peak_value": 72.4,
                    "description": "Localized orographic convective storm over high-elevation western blocks."
                },
                {
                    "region_id": "ka-tumakuru",
                    "event_id": "EVT-TUM-02",
                    "event_type": "dry_spell",
                    "label": "Mid-Summer Dry Spell (20 Apr 2026)",
                    "date": "2026-04-20",
                    "suggested_panchayat": "PNC-KA-0010",
                    "peak_value": 0.0,
                    "description": "14-day dry spell across eastern semi-arid taluks."
                },
                {
                    "region_id": "ka-tumakuru",
                    "event_id": "EVT-TUM-03",
                    "event_type": "heatwave",
                    "label": "Peak Summer Heat Stress (10 May 2026)",
                    "date": "2026-05-10",
                    "suggested_panchayat": "PNC-KA-0025",
                    "peak_value": 39.8,
                    "description": "Severe daytime heating exceeding flowering stage thresholds."
                }
            ]
            pd.DataFrame(events).to_parquet(os.path.join(data_dir, 'event_catalog.parquet'))
            print(f"[{config.region_id}] Preserved observations ({len(obs_df)}) and forecasts ({len(fcst_df)}).")
            return obs_df, fcst_df

    # Multi-region calibrated generation for new regions
    clim = config.climatology
    tmax_normals = clim.get('tmax_c', [30] * 12)
    tmin_normals = clim.get('tmin_c', [20] * 12)
    rain_normals = clim.get('rain_mm', [50] * 12)
    wet_prob = clim.get('wet_day_prob', [0.3] * 12)

    seed = hash(config.region_id) % 20000
    rng = np.random.default_rng(seed)

    # 1-year date range: 2025-06-01 to 2026-05-31
    dates = pd.date_range('2025-06-01', '2026-05-31', freq='D')
    blocks = list(b_gdf['id'])
    panchayats = list(p_gdf['id'])
    panchayat_blocks = dict(zip(p_gdf['id'], p_gdf['block_id']))

    # Load environmental features for lapse-rate adjustments
    env_df = pd.read_parquet(os.path.join(data_dir, 'environmental_features.parquet'))
    elevations = env_df[env_df['feature_name'] == 'elevation'].set_index('location_ref')['value_num'].to_dict()

    fcst_rows = []
    obs_rows = []

    print(f"[{config.region_id}] Generating weather timeseries across {len(dates)} days...")

    # Pre-generate block-level base conditions
    for dt in dates:
        m_idx = dt.month - 1
        d_str = dt.strftime('%Y-%m-%d')

        base_tmax = tmax_normals[m_idx] + rng.normal(0, 1.8)
        base_tmin = tmin_normals[m_idx] + rng.normal(0, 1.5)
        p_wet = wet_prob[m_idx]

        # Block forecasts
        for b_id in blocks:
            b_is_rain = rng.random() < p_wet
            b_rain = float(max(0.0, rng.exponential(rain_normals[m_idx] / 15.0))) if b_is_rain else 0.0
            b_tmax = round(float(base_tmax + rng.normal(0, 0.8)), 2)
            b_tmin = round(float(base_tmin + rng.normal(0, 0.8)), 2)
            b_rh = round(float(np.clip(65.0 + (15.0 if b_is_rain else -10.0) + rng.normal(0, 5), 25, 95)), 1)

            for h in range(1, 6):
                fcst_date = (dt - timedelta(days=h)).strftime('%Y-%m-%d')
                fcst_rows.extend([
                    {'block_id': b_id, 'forecast_date': fcst_date, 'target_date': d_str, 'horizon_days': h, 'variable': 'rainfall_mm', 'value': round(b_rain, 2), 'is_synthetic': True, 'data_source_tag': 'FORECAST'},
                    {'block_id': b_id, 'forecast_date': fcst_date, 'target_date': d_str, 'horizon_days': h, 'variable': 'temp_max_c', 'value': b_tmax, 'is_synthetic': True, 'data_source_tag': 'FORECAST'},
                    {'block_id': b_id, 'forecast_date': fcst_date, 'target_date': d_str, 'horizon_days': h, 'variable': 'temp_min_c', 'value': b_tmin, 'is_synthetic': True, 'data_source_tag': 'FORECAST'},
                    {'block_id': b_id, 'forecast_date': fcst_date, 'target_date': d_str, 'horizon_days': h, 'variable': 'humidity_pct', 'value': b_rh, 'is_synthetic': True, 'data_source_tag': 'FORECAST'}
                ])

        # Local Panchayat observations (with elevation lapse rate & terrain micro-climate)
        for p_id in panchayats:
            b_id = panchayat_blocks.get(p_id, blocks[0])
            p_elev = elevations.get(p_id, 400.0)
            elev_cooling = (p_elev - 400.0) / 1000.0 * config.generator.get('lapse_rate_c_per_km', 6.5)

            p_tmax = round(float(base_tmax - elev_cooling + rng.normal(0, 0.6)), 2)
            p_tmin = round(float(base_tmin - elev_cooling * 0.8 + rng.normal(0, 0.5)), 2)

            orographic_boost = 1.0 + (p_elev / 1000.0) * config.generator.get('orographic_rain_factor', 0.15)
            p_is_rain = rng.random() < (p_wet * 1.1)
            p_rain = round(float(max(0.0, rng.exponential(rain_normals[m_idx] / 12.0) * orographic_boost)), 2) if p_is_rain else 0.0
            p_rh = round(float(np.clip(65.0 + (18.0 if p_is_rain else -8.0) + rng.normal(0, 4), 20, 98)), 1)

            ts = f"{d_str}T00:00:00Z"
            obs_rows.extend([
                {'location_ref': p_id, 'timestamp': ts, 'variable': 'temp_max_c', 'value': p_tmax, 'source': 'synthetic', 'is_synthetic': True, 'data_source_tag': 'OBSERVED'},
                {'location_ref': p_id, 'timestamp': ts, 'variable': 'temp_min_c', 'value': p_tmin, 'source': 'synthetic', 'is_synthetic': True, 'data_source_tag': 'OBSERVED'},
                {'location_ref': p_id, 'timestamp': ts, 'variable': 'rainfall_mm', 'value': p_rain, 'source': 'synthetic', 'is_synthetic': True, 'data_source_tag': 'OBSERVED'},
                {'location_ref': p_id, 'timestamp': ts, 'variable': 'humidity_pct', 'value': p_rh, 'source': 'synthetic', 'is_synthetic': True, 'data_source_tag': 'OBSERVED'}
            ])

    fcst_df = pd.DataFrame(fcst_rows)
    obs_df = pd.DataFrame(obs_rows)

    fcst_df.to_parquet(os.path.join(data_dir, 'weather_forecasts.parquet'))
    obs_df.to_parquet(os.path.join(data_dir, 'weather_observations.parquet'))

    # D4. Specific Scenario Events
    events = [
        {
            "region_id": config.region_id,
            "event_id": f"EVT-{config.region_id[:2].upper()}-01",
            "event_type": "heavy_rain",
            "label": f"Monsoon Infiltration Surge ({config.district})",
            "date": "2025-07-20",
            "suggested_panchayat": panchayats[0],
            "peak_value": 85.0 if 'coastal' in config.agro_climatic_zone.lower() else 58.0,
            "description": "High precipitation event with localized rainfall gradient."
        },
        {
            "region_id": config.region_id,
            "event_id": f"EVT-{config.region_id[:2].upper()}-02",
            "event_type": "heatwave" if 'arid' in config.agro_climatic_zone.lower() or 'plains' in config.agro_climatic_zone.lower() else "dry_spell",
            "label": f"Temperature Stress Period ({config.district})",
            "date": "2026-05-18",
            "suggested_panchayat": panchayats[min(5, len(panchayats) - 1)],
            "peak_value": 43.5 if 'arid' in config.agro_climatic_zone.lower() else 39.0,
            "description": "Protracted high-temperature conditions exceeding vegetative thresholds."
        }
    ]
    pd.DataFrame(events).to_parquet(os.path.join(data_dir, 'event_catalog.parquet'))

    print(f"[{config.region_id}] Created observations ({len(obs_df)}) and forecasts ({len(fcst_df)}).")
    return obs_df, fcst_df
