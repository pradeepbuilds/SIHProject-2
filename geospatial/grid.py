import numpy as np
import geopandas as gpd
from shapely.geometry import box

def generate_grid_for_polygon(polygon, cell_size=0.009):
    """
    Generate a uniform grid over a given polygon.
    cell_size = 0.009 roughly equates to 1km at equator.
    """
    minx, miny, maxx, maxy = polygon.bounds
    x_grid = np.arange(minx, maxx, cell_size)
    y_grid = np.arange(miny, maxy, cell_size)
    
    cells = []
    for x in x_grid:
        for y in y_grid:
            g_poly = box(x, y, x+cell_size, y+cell_size)
            g_inter = g_poly.intersection(polygon)
            if not g_inter.is_empty:
                cells.append(g_inter)
    
    return cells

def aggregate_to_panchayat(grid_values, grid_geometries, panchayat_geometry):
    """
    Area-weighted aggregation from grid cells to a panchayat boundary.
    (For inference/reporting).
    """
    total_area = 0.0
    weighted_sum = 0.0
    
    for val, g_geom in zip(grid_values, grid_geometries):
        if val is None or np.isnan(val):
            continue
        inter = g_geom.intersection(panchayat_geometry)
        if not inter.is_empty:
            area = inter.area
            weighted_sum += val * area
            total_area += area
            
    if total_area > 0:
        return weighted_sum / total_area
    return None
