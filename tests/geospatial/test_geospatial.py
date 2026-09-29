import pytest
from shapely.geometry import Polygon, Point, mapping
from backend.services.data_provider import parse_geometry_to_dict
from backend.services.map_service import MapService


def test_parse_geometry_to_dict_polygon():
    poly = Polygon([(76.9, 13.2), (77.1, 13.2), (77.1, 13.4), (76.9, 13.4), (76.9, 13.2)])
    geom_dict = parse_geometry_to_dict(poly)
    assert geom_dict is not None
    assert geom_dict["type"] == "Polygon"
    assert len(geom_dict["coordinates"][0]) == 5


def test_parse_geometry_to_dict_wkt():
    wkt_str = "POLYGON ((76.9 13.2, 77.1 13.2, 77.1 13.4, 76.9 13.4, 76.9 13.2))"
    geom_dict = parse_geometry_to_dict(wkt_str)
    assert geom_dict is not None
    assert geom_dict["type"] == "Polygon"


def test_parse_geometry_to_dict_none():
    assert parse_geometry_to_dict(None) is None


def test_map_service_geojson_generation():
    map_service = MapService()
    # Test level: block
    geojson_block = map_service.get_map_layer(variable="rainfall", date_str="2026-09-28", level="block")
    assert geojson_block["type"] == "FeatureCollection"
    assert len(geojson_block["features"]) > 0
    assert "value" in geojson_block["features"][0]["properties"]
    assert "data_source_tag" in geojson_block["features"][0]["properties"]
    assert "is_synthetic" in geojson_block["features"][0]["properties"]

    # Test level: panchayat
    geojson_pnc = map_service.get_map_layer(variable="temperature", date_str="2026-09-28", level="panchayat")
    assert geojson_pnc["type"] == "FeatureCollection"
    assert len(geojson_pnc["features"]) > 0
