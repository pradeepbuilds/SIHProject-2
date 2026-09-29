import os
import glob
import json
import yaml
from typing import Dict, Any, List, Optional
from shapely.geometry import shape, Point

REGIONS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'regions'))


class RegionConfig:
    def __init__(self, data: Dict[str, Any]):
        self.raw_data = data
        self.region_id = data['region_id']
        self.id_prefix = data.get('id_prefix', f"PNC-{self.region_id[:2].upper()}")
        self.state = data['state']
        self.district = data['district']
        self.agro_climatic_zone = data.get('agro_climatic_zone', 'Agricultural Zone')
        self.languages = data.get('languages', ['en', 'hi'])
        self.main_crops = data.get('main_crops', ['ragi', 'paddy'])
        self.horizon_days = data.get('horizon_days', {'min': 1, 'max': 5})
        self.data_mode = data.get('data_mode', {
            'boundaries_district': 'real',
            'boundaries_sub_units': 'illustrative',
            'terrain': 'synthetic',
            'weather': 'synthetic_calibrated'
        })
        self.boundary = data.get('boundary', {})
        self.climatology = data.get('climatology', {})
        self.generator = data.get('generator', {})
        self.alert_thresholds = data.get('alert_thresholds', {
            'heavy_rain_mm': 50,
            'heat_c': 38,
            'cold_c': 6,
            'dry_spell_days': 5
        })

        self.district_geojson_path = os.path.join(
            os.path.dirname(__file__), '..', self.boundary.get('district_geojson', f'regions/data/{self.region_id}/district.geojson')
        )
        self.district_geometry = None
        self.bbox = self._compute_bbox()

    def _compute_bbox(self) -> Dict[str, float]:
        if os.path.exists(self.district_geojson_path):
            try:
                with open(self.district_geojson_path, 'r', encoding='utf-8') as f:
                    geo = json.load(f)
                    geom_data = geo['features'][0]['geometry'] if 'features' in geo and geo['features'] else geo
                    self.district_geometry = shape(geom_data)
                    minx, miny, maxx, maxy = self.district_geometry.bounds
                    return {
                        'min_lon': round(minx, 4),
                        'min_lat': round(miny, 4),
                        'max_lon': round(maxx, 4),
                        'max_lat': round(maxy, 4)
                    }
            except Exception as e:
                pass
        return {'min_lon': 70.0, 'min_lat': 10.0, 'max_lon': 80.0, 'max_lat': 35.0}

    def contains_point(self, lat: float, lon: float) -> bool:
        if (self.bbox['min_lat'] <= lat <= self.bbox['max_lat'] and
                self.bbox['min_lon'] <= lon <= self.bbox['max_lon']):
            if self.district_geometry:
                try:
                    return self.district_geometry.contains(Point(lon, lat))
                except Exception:
                    return True
            return True
        return False

    def to_dict(self) -> Dict[str, Any]:
        return {
            'region_id': self.region_id,
            'id_prefix': self.id_prefix,
            'state': self.state,
            'district': self.district,
            'agro_climatic_zone': self.agro_climatic_zone,
            'languages': self.languages,
            'main_crops': self.main_crops,
            'horizon_days': self.horizon_days,
            'data_mode': self.data_mode,
            'bbox': self.bbox,
            'alert_thresholds': self.alert_thresholds,
            'attribution': self.boundary.get('attribution', 'Open Data')
        }


_region_configs: Dict[str, RegionConfig] = {}


def load_all_region_configs() -> Dict[str, RegionConfig]:
    global _region_configs
    configs = {}
    yaml_files = glob.glob(os.path.join(REGIONS_DIR, '*.yaml'))
    for f in yaml_files:
        try:
            with open(f, 'r', encoding='utf-8') as stream:
                data = yaml.safe_load(stream)
                if data and 'region_id' in data:
                    cfg = RegionConfig(data)
                    configs[cfg.region_id] = cfg
        except Exception as e:
            print(f"Error loading region yaml {f}: {e}")
    _region_configs = configs
    return _region_configs


def get_region_config(region_id: str) -> Optional[RegionConfig]:
    if not _region_configs:
        load_all_region_configs()
    return _region_configs.get(region_id)


def get_all_regions() -> List[RegionConfig]:
    if not _region_configs:
        load_all_region_configs()
    return list(_region_configs.values())


def find_region_by_coordinates(lat: float, lon: float) -> Optional[RegionConfig]:
    regions = get_all_regions()
    for reg in regions:
        if reg.contains_point(lat, lon):
            return reg
    return None
