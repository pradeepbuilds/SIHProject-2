import os
import numpy as np
import pandas as pd
import geopandas as gpd
from shapely.geometry import Polygon, Point, box
from shapely.ops import voronoi_diagram

# Seed for reproducibility
np.random.seed(42)

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'data', 'synthetic')
os.makedirs(OUTPUT_DIR, exist_ok=True)

def generate_blocks():
    # 4x3 grid of blocks roughly representing 4000 km^2
    minx, miny, maxx, maxy = 76.5, 13.0, 77.5, 14.0 # roughly Tumakuru area
    
    blocks = []
    xs = np.linspace(minx, maxx, 4)
    ys = np.linspace(miny, maxy, 5)
    
    block_id_counter = 1
    for i in range(len(xs)-1):
        for j in range(len(ys)-1):
            if block_id_counter > 10:
                break
            poly = Polygon([
                (xs[i], ys[j]),
                (xs[i+1], ys[j]),
                (xs[i+1], ys[j+1]),
                (xs[i], ys[j+1])
            ])
            blocks.append({
                'id': f'BLK-KA-{block_id_counter:03d}',
                'district_id': 'DIST-KA-TUM',
                'name': f'Synthetic Block {block_id_counter}',
                'lgd_code': f'LGD-B{block_id_counter}',
                'geometry': poly
            })
            block_id_counter += 1
            
    gdf_blocks = gpd.GeoDataFrame(blocks, crs="EPSG:4326")
    gdf_blocks.to_parquet(os.path.join(OUTPUT_DIR, 'blocks.parquet'))
    return gdf_blocks

def generate_panchayats_and_grids(gdf_blocks):
    panchayats = []
    grids = []
    
    panchayat_id_counter = 1
    grid_id_counter = 1
    
    for _, block in gdf_blocks.iterrows():
        num_panchayats = np.random.randint(8, 16)
        
        # generate random points in block for voronoi
        minx, miny, maxx, maxy = block.geometry.bounds
        points = []
        while len(points) < num_panchayats:
            pt = Point(np.random.uniform(minx, maxx), np.random.uniform(miny, maxy))
            if block.geometry.contains(pt):
                points.append(pt)
                
        # create voronoi
        mp = gpd.GeoSeries(points).union_all()
        vor = voronoi_diagram(mp, envelope=block.geometry)
        
        # sometimes vor is a single polygon if num_panchayats=1 but we have >=8
        if isinstance(vor, Polygon):
            polys = [vor]
        else:
            polys = list(vor.geoms)
            
        for poly in polys:
            p_geom = poly.intersection(block.geometry)
            if not p_geom.is_empty:
                panchayats.append({
                    'id': f'PNC-KA-{panchayat_id_counter:04d}',
                    'block_id': block['id'],
                    'name': f'Panchayat {panchayat_id_counter}',
                    'lgd_code': f'LGD-P{panchayat_id_counter}',
                    'geometry': p_geom,
                    'is_synthetic_boundary': True
                })
                panchayat_id_counter += 1
                
        # Generate 1km grids (~0.009 degrees)
        step = 0.009
        x_grid = np.arange(minx, maxx, step)
        y_grid = np.arange(miny, maxy, step)
        
        for x in x_grid:
            for y in y_grid:
                g_poly = box(x, y, x+step, y+step)
                g_inter = g_poly.intersection(block.geometry)
                if not g_inter.is_empty:
                    grids.append({
                        'id': f'GRD-{grid_id_counter:05d}',
                        'block_id': block['id'],
                        'geometry': g_inter,
                        'centroid': g_inter.centroid.wkt
                    })
                    grid_id_counter += 1
                    
    gdf_panchayats = gpd.GeoDataFrame(panchayats, crs="EPSG:4326")
    gdf_grids = gpd.GeoDataFrame(grids, crs="EPSG:4326")
    
    gdf_panchayats.to_parquet(os.path.join(OUTPUT_DIR, 'panchayats.parquet'))
    gdf_grids.to_parquet(os.path.join(OUTPUT_DIR, 'grids.parquet'))
    
    return gdf_panchayats, gdf_grids

def generate_static_features(gdf_locations):
    features = []
    
    land_covers = ['forest', 'cropland', 'built-up', 'barren', 'water']
    soils = ['sandy', 'loam', 'clay', 'silt']
    
    for _, row in gdf_locations.iterrows():
        geom = row.geometry
        centroid = geom.centroid if isinstance(geom, Polygon) else geom
        
        # Spatial noise based on coordinates
        noise = np.sin(centroid.x * 50) + np.cos(centroid.y * 50)
        
        elevation = 700 + noise * 100
        slope = abs(noise * 15)
        aspect = (noise * 180) % 360
        
        lc_idx = int(abs(noise * len(land_covers))) % len(land_covers)
        lc = land_covers[lc_idx]
        
        soil_idx = int(abs(noise * len(soils))) % len(soils)
        soil = soils[soil_idx]
        
        if lc == 'forest':
            ndvi = 0.6 + np.random.uniform(0, 0.2)
            ndwi = 0.2
        elif lc == 'built-up':
            ndvi = 0.15 + np.random.uniform(0, 0.1)
            ndwi = 0.0
        elif lc == 'water':
            ndvi = 0.0
            ndwi = 0.8
        else:
            ndvi = 0.3 + np.random.uniform(0, 0.2)
            ndwi = 0.1
            
        dist_water = np.random.uniform(0, 10)
        if lc == 'water':
            dist_water = 0
            
        loc_ref = row['id']
        
        # Append features
        feature_dict = {
            'elevation': elevation,
            'slope': slope,
            'aspect': aspect,
            'land_cover_class': lc,
            'ndvi': ndvi,
            'ndwi': ndwi,
            'soil_texture_class': soil,
            'distance_to_water_km': dist_water
        }
        
        for k, v in feature_dict.items():
            features.append({
                'location_ref': loc_ref,
                'feature_name': k,
                'value_num': v if isinstance(v, (int, float)) else None,
                'value_str': v if isinstance(v, str) else None,
                'valid_from': '2024-01-01',
                'valid_to': '2027-01-01',
                'is_synthetic': True
            })
            
    df_features = pd.DataFrame(features)
    df_features.to_parquet(os.path.join(OUTPUT_DIR, 'environmental_features.parquet'))
    return df_features

def generate_weather(gdf_locations):
    dates = pd.date_range(start='2024-06-01', end='2026-06-01', freq='D')
    
    observations = []
    forecasts = []
    
    block_truths = {} # To aggregate block forecasts
    
    # Pre-calculate base temperatures per location based on elevation
    loc_base_temp = {}
    for _, row in gdf_locations.iterrows():
        noise = np.sin(row.geometry.centroid.x * 50) + np.cos(row.geometry.centroid.y * 50)
        elev = 700 + noise * 100
        loc_base_temp[row['id']] = 35 - (elev / 1000) * 6.5
    
    for d in dates:
        d_str = d.strftime('%Y-%m-%d')
        
        # Seasonal component (monsoon Jun-Sep is days 152 to 273 roughly)
        day_of_year = d.dayofyear
        season_sin = np.sin((day_of_year - 150) / 365.0 * 2 * np.pi)
        
        temp_daily_noise = np.random.normal(0, 2)
        is_monsoon = 152 <= day_of_year <= 273
        
        for _, row in gdf_locations.iterrows():
            loc_id = row['id']
            block_id = row['block_id']
            
            # Temp max
            tmax = loc_base_temp[loc_id] + season_sin * 5 + temp_daily_noise
            tmin = tmax - 10 - np.random.uniform(0, 3)
            
            # Rainfall
            if is_monsoon:
                rain_prob = 0.4
                if np.random.random() < rain_prob:
                    rain = np.random.gamma(2, 5) # average 10mm
                    # Forest/high NDVI gets slight boost
                    rain *= 1.1 
                else:
                    rain = 0.0
            else:
                rain_prob = 0.05
                if np.random.random() < rain_prob:
                    rain = np.random.gamma(1, 3)
                else:
                    rain = 0.0
                    
            humidity = 80 if rain > 0 else 50 + np.random.normal(0, 10)
            
            # Write observations
            for var, val in [('temp_max_c', tmax), ('temp_min_c', tmin), ('rainfall_mm', rain), ('humidity_pct', humidity)]:
                observations.append({
                    'location_ref': loc_id,
                    'timestamp': d_str,
                    'variable': var,
                    'value': val,
                    'source': 'Synthetic AWS',
                    'is_synthetic': True,
                    'data_source_tag': 'OBSERVED'
                })
                
            # Aggregate to block level for forecast
            if block_id not in block_truths:
                block_truths[block_id] = {}
            if d_str not in block_truths[block_id]:
                block_truths[block_id][d_str] = {'temp_max_c': [], 'temp_min_c': [], 'rainfall_mm': [], 'humidity_pct': []}
                
            block_truths[block_id][d_str]['temp_max_c'].append(tmax)
            block_truths[block_id][d_str]['temp_min_c'].append(tmin)
            block_truths[block_id][d_str]['rainfall_mm'].append(rain)
            block_truths[block_id][d_str]['humidity_pct'].append(humidity)
            
    # Generate Forecasts from aggregated truths
    for block_id, dates_dict in block_truths.items():
        # systematic block bias
        block_bias = {'temp_max_c': np.random.uniform(-1, 1), 'temp_min_c': np.random.uniform(-1, 1), 'rainfall_mm': np.random.uniform(0, 2), 'humidity_pct': np.random.uniform(-5, 5)}
        
        for d, vars_dict in dates_dict.items():
            target_d = pd.to_datetime(d)
            for horizon in [1, 2, 3, 4, 5]:
                forecast_d = target_d - pd.Timedelta(days=horizon)
                if forecast_d < pd.to_datetime('2024-06-01'):
                    continue
                    
                for var, vals in vars_dict.items():
                    true_mean = np.mean(vals)
                    # horizon noise increases with lead time
                    noise_scale = horizon * 0.5 if 'temp' in var else horizon * 2
                    forecast_val = true_mean + block_bias[var] + np.random.normal(0, noise_scale)
                    if forecast_val < 0 and var == 'rainfall_mm':
                        forecast_val = 0.0
                        
                    forecasts.append({
                        'block_id': block_id,
                        'forecast_date': forecast_d.strftime('%Y-%m-%d'),
                        'target_date': d,
                        'horizon_days': horizon,
                        'variable': var,
                        'value': forecast_val,
                        'is_synthetic': True,
                        'data_source_tag': 'FORECAST'
                    })
                    
    df_obs = pd.DataFrame(observations)
    df_fcst = pd.DataFrame(forecasts)
    
    df_obs.to_parquet(os.path.join(OUTPUT_DIR, 'weather_observations.parquet'))
    df_fcst.to_parquet(os.path.join(OUTPUT_DIR, 'weather_forecasts.parquet'))

if __name__ == '__main__':
    print("Generating synthetic blocks...")
    gdf_blocks = generate_blocks()
    
    print("Generating synthetic panchayats and grids...")
    gdf_panchayats, gdf_grids = generate_panchayats_and_grids(gdf_blocks)
    
    print("Generating static features...")
    # Generate features for both panchayats and grids
    generate_static_features(pd.concat([gdf_panchayats, gdf_grids], ignore_index=True))
    
    print("Generating weather observations and block forecasts...")
    # Observations primarily for panchayats (simulating stations at panchayats)
    generate_weather(gdf_panchayats)
    
    print(f"Synthetic data generated in {OUTPUT_DIR}")
