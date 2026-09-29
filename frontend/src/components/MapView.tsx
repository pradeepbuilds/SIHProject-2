import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { GeoJSONFeatureCollection, RegionDetail } from '../types/api';
import { getColorForValue, getLegendStops } from '../utils/colorScale';
import { getTranslation, type SupportedLanguage } from '../i18n';

interface MapViewProps {
  geoJsonData: GeoJSONFeatureCollection | null;
  regionDetail: RegionDetail | null;
  mode: 'coarse' | 'downscaled' | 'difference';
  variable: string;
  selectedPanchayatId: string;
  onSelectPanchayat: (id: string) => void;
  onMapClickCoords: (lat: number, lon: number) => void;
  loading: boolean;
  lang: SupportedLanguage;
}

export const MapView: React.FC<MapViewProps> = ({
  geoJsonData,
  regionDetail,
  mode,
  variable,
  selectedPanchayatId,
  onSelectPanchayat,
  onMapClickCoords,
  loading,
  lang
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const geoJsonLayerRef = useRef<L.GeoJSON | null>(null);
  const districtOutlineLayerRef = useRef<L.GeoJSON | null>(null);
  const t = getTranslation(lang);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [13.34, 77.10],
      zoom: 9,
      minZoom: 6,
      maxZoom: 15,
      attributionControl: false
    });

    // Softened OSM Tile layer
    const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      className: 'km-soft-tiles'
    });
    tileLayer.addTo(map);

    // Fallback: If tiles fail to load (offline), map still renders vectors cleanly
    tileLayer.on('tileerror', () => {
      // Degrades gracefully on offline network
    });

    // Map Click Listener
    map.on('click', (e: L.LeafletMouseEvent) => {
      onMapClickCoords(e.latlng.lat, e.latlng.lng);
    });

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Fit bounds when region changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !regionDetail?.bbox) return;

    const bbox = regionDetail.bbox;
    const southWest = L.latLng(bbox.min_lat, bbox.min_lon);
    const northEast = L.latLng(bbox.max_lat, bbox.max_lon);
    map.fitBounds(L.latLngBounds(southWest, northEast), { padding: [20, 20] });
  }, [regionDetail?.region_id]);

  // Render District Official Outline
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (districtOutlineLayerRef.current) {
      map.removeLayer(districtOutlineLayerRef.current);
      districtOutlineLayerRef.current = null;
    }

    if (regionDetail?.district_geojson) {
      const distLayer = L.geoJSON(regionDetail.district_geojson, {
        style: {
          color: '#1F4D2A',
          weight: 2.5,
          fillOpacity: 0.0,
          dashArray: ''
        },
        interactive: false
      });
      distLayer.addTo(map);
      districtOutlineLayerRef.current = distLayer;
    }
  }, [regionDetail]);

  // Update GeoJSON Panchayat Choropleth
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !geoJsonData) return;

    if (geoJsonLayerRef.current) {
      map.removeLayer(geoJsonLayerRef.current);
    }

    const unit = variable.includes('rain') ? 'mm' : '°C';

    const geoLayer = L.geoJSON(geoJsonData as any, {
      style: (feature: any) => {
        const props = feature?.properties || {};
        let val = props.value ?? 0;
        if (mode === 'coarse') val = props.coarse_value ?? val;
        else if (mode === 'difference') val = props.diff_value ?? 0;

        const isSelected = props.id === selectedPanchayatId;

        return {
          fillColor: getColorForValue(val, variable, mode),
          weight: isSelected ? 3.5 : 1.0,
          opacity: 1,
          color: isSelected ? '#1F2A22' : '#8C9990',
          dashArray: isSelected ? '' : '1',
          fillOpacity: 0.82
        };
      },
      onEachFeature: (feature: any, layer: L.Layer) => {
        const props = feature?.properties || {};
        const downscaledVal = props.downscaled_value ?? props.value ?? 'N/A';
        const coarseVal = props.coarse_value ?? 'N/A';
        const diffVal = props.diff_value ?? '0.0';
        const rainProb = props.rain_probability ? `${Math.round(props.rain_probability * 100)}%` : 'N/A';
        const unc = props.uncertainty_label || 'medium';

        let displayVal = `${downscaledVal} ${unit}`;
        if (mode === 'coarse') displayVal = `${coarseVal} ${unit}`;
        else if (mode === 'difference') displayVal = `${diffVal > 0 ? '+' : ''}${diffVal} ${unit}`;

        layer.bindTooltip(
          `
          <div class="km-map-tooltip">
            <div class="km-tooltip-title">${props.name || props.id}</div>
            <div class="km-tooltip-row">
              <span>${mode === 'difference' ? 'Difference' : 'Forecast'}:</span>
              <strong>${displayVal}</strong>
            </div>
            ${variable.includes('rain') ? `<div class="km-tooltip-row"><span>Rain Probability:</span> <strong>${rainProb}</strong></div>` : ''}
            <div class="km-tooltip-row"><span>Uncertainty:</span> <span class="km-tooltip-unc km-unc-${unc}">${unc}</span></div>
          </div>
          `,
          { sticky: true, className: 'km-leaflet-tooltip' }
        );

        layer.on({
          click: () => {
            if (props.id) {
              onSelectPanchayat(props.id);
            }
          }
        });
      }
    });

    geoLayer.addTo(map);
    geoJsonLayerRef.current = geoLayer;
  }, [geoJsonData, mode, variable, selectedPanchayatId]);

  const legendStops = getLegendStops(variable, mode);

  return (
    <div className="km-map-wrapper">
      {/* Loading Overlay */}
      {loading && (
        <div className="km-map-loading">
          <div className="km-spinner" />
          <span>Updating choropleth layers...</span>
        </div>
      )}

      {/* Persistent Boundary & Provenance Notice */}
      <div className="km-map-notice">
        <span>{t.illustrative_boundaries_notice}</span>
      </div>

      {/* Map Container */}
      <div ref={mapContainerRef} className="km-map-canvas" id="map-viewport" />

      {/* Dynamic Accessible Legend */}
      <div className="km-map-legend" role="region" aria-label="Map color scale legend">
        <div className="km-legend-title">
          {mode === 'difference' ? 'Difference vs Block' : mode === 'coarse' ? 'Block Forecast' : 'KrishiMitra Local'}
          <span className="km-legend-unit">({variable.includes('rain') ? 'mm' : '°C'})</span>
        </div>
        <div className="km-legend-gradient">
          {legendStops.map((stop, i) => (
            <div key={i} className="km-legend-step">
              <span className="km-legend-color" style={{ backgroundColor: stop.color }} />
              <span className="km-legend-label">{stop.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Attribution */}
      <div className="km-map-attribution">
        <span>
          District boundary: {regionDetail?.boundary?.source || 'Open Data'} ({regionDetail?.boundary?.license || 'ODbL'}) | © OpenStreetMap contributors
        </span>
      </div>
    </div>
  );
};
