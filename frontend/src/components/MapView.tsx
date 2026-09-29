import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ZoomIn, ZoomOut, Maximize2, Layers, AlertCircle, RefreshCw, Info } from 'lucide-react';
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
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  const [tileError, setTileError] = useState<boolean>(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [showDistrictOutline, setShowDistrictOutline] = useState<boolean>(true);

  const t = getTranslation(lang);

  // Initialize Map safely
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // If map already initialized on this container, clean it up first
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    try {
      const map = L.map(mapContainerRef.current, {
        center: [13.34, 77.10],
        zoom: 9,
        minZoom: 5,
        maxZoom: 16,
        zoomControl: false, // Custom control bar used
        attributionControl: false
      });

      // Softened OSM Tile layer
      const tiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        className: 'km-soft-tiles'
      });

      tiles.on('tileerror', () => {
        setTileError(true);
      });

      tiles.addTo(map);
      tileLayerRef.current = tiles;

      // Click coordinate listener
      map.on('click', (e: L.LeafletMouseEvent) => {
        onMapClickCoords(e.latlng.lat, e.latlng.lng);
      });

      mapInstanceRef.current = map;

      // Invalidate size on initial mount
      setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      }, 150);
    } catch (err: any) {
      console.error('Failed to initialize Leaflet Map:', err);
      setMapError('Unable to initialize map viewport');
    }

    // Resize observer for responsive layout changes
    const resizeObserver = new ResizeObserver(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    });

    if (mapContainerRef.current) {
      resizeObserver.observe(mapContainerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Fit bounds helper
  const fitDistrictBounds = useCallback(() => {
    const map = mapInstanceRef.current;
    if (!map || !regionDetail?.bbox) return;

    try {
      const bbox = regionDetail.bbox;
      const southWest = L.latLng(bbox.min_lat, bbox.min_lon);
      const northEast = L.latLng(bbox.max_lat, bbox.max_lon);
      map.fitBounds(L.latLngBounds(southWest, northEast), {
        padding: [24, 24],
        maxZoom: 11,
        animate: true
      });
      map.invalidateSize();
    } catch (e) {
      console.error('Error fitting bounds:', e);
    }
  }, [regionDetail?.bbox]);

  // Fit bounds when region changes
  useEffect(() => {
    fitDistrictBounds();
  }, [regionDetail?.region_id, fitDistrictBounds]);

  // Render District Official Outline
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (districtOutlineLayerRef.current) {
      map.removeLayer(districtOutlineLayerRef.current);
      districtOutlineLayerRef.current = null;
    }

    if (showDistrictOutline && regionDetail?.district_geojson) {
      try {
        const distLayer = L.geoJSON(regionDetail.district_geojson, {
          style: {
            color: '#154121',
            weight: 3.5,
            fillOpacity: 0.0,
            dashArray: '4, 4',
            lineCap: 'round',
            lineJoin: 'round'
          },
          interactive: false
        });
        distLayer.addTo(map);
        districtOutlineLayerRef.current = distLayer;
      } catch (err) {
        console.warn('Could not render district GeoJSON boundary:', err);
      }
    }
  }, [regionDetail, showDistrictOutline]);

  // Update GeoJSON Panchayat Choropleth Layer
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (geoJsonLayerRef.current) {
      map.removeLayer(geoJsonLayerRef.current);
      geoJsonLayerRef.current = null;
    }

    if (!geoJsonData || !geoJsonData.features || geoJsonData.features.length === 0) {
      return;
    }

    const unit = variable.includes('rain') ? 'mm' : '°C';

    try {
      const geoLayer = L.geoJSON(geoJsonData as any, {
        filter: (feature: any) => {
          // Robust geometry validation
          return !!(feature && feature.geometry && feature.geometry.coordinates && feature.geometry.coordinates.length > 0);
        },
        style: (feature: any) => {
          const props = feature?.properties || {};
          let val = props.value ?? 0;
          if (mode === 'coarse') val = props.coarse_value ?? val;
          else if (mode === 'difference') val = props.diff_value ?? (props.downscaled_value != null && props.coarse_value != null ? (props.downscaled_value - props.coarse_value) : 0);

          const isSelected = props.id === selectedPanchayatId;

          return {
            fillColor: getColorForValue(val, variable, mode),
            weight: isSelected ? 4.0 : 1.2,
            opacity: 1,
            color: isSelected ? '#FBBF24' : '#4B5563', // Amber highlight for selected
            dashArray: isSelected ? '' : '2',
            fillOpacity: isSelected ? 0.92 : 0.82,
            className: isSelected ? 'km-panchayat-selected' : ''
          };
        },
        onEachFeature: (feature: any, layer: L.Layer) => {
          const props = feature?.properties || {};
          const downscaledVal = props.downscaled_value ?? props.value ?? 'N/A';
          const coarseVal = props.coarse_value ?? 'N/A';
          const diffVal = props.diff_value ?? (props.downscaled_value != null && props.coarse_value != null ? (props.downscaled_value - props.coarse_value) : 0);
          const rainProb = props.rain_probability != null ? `${Math.round(props.rain_probability * 100)}%` : 'N/A';
          const unc = props.uncertainty_label || 'medium';

          const formattedDiff = typeof diffVal === 'number' ? (diffVal > 0 ? `+${diffVal.toFixed(1)}` : `${diffVal.toFixed(1)}`) : diffVal;

          let displayVal = `${downscaledVal} ${unit}`;
          if (mode === 'coarse') displayVal = `${coarseVal} ${unit}`;
          else if (mode === 'difference') displayVal = `${formattedDiff} ${unit}`;

          // Rich Accessible HTML Tooltip
          layer.bindTooltip(
            `
            <div class="km-map-tooltip">
              <div class="km-tooltip-header">
                <strong class="km-tooltip-title">${props.name || props.id}</strong>
                <span class="km-tooltip-badge">${props.id}</span>
              </div>
              <div class="km-tooltip-body">
                <div class="km-tooltip-row">
                  <span class="km-tooltip-label">${mode === 'difference' ? 'Difference (ML - Block)' : mode === 'coarse' ? 'Block Forecast' : 'KrishiMitra Estimate'}:</span>
                  <strong class="km-tooltip-value ${mode === 'difference' ? (Number(diffVal) >= 0 ? 'km-val-pos' : 'km-val-neg') : ''}">${displayVal}</strong>
                </div>
                ${mode !== 'difference' ? `
                  <div class="km-tooltip-subrow">
                    <span>Block: ${coarseVal} ${unit}</span>
                    <span>Local ML: ${downscaledVal} ${unit}</span>
                  </div>
                ` : ''}
                ${variable.includes('rain') ? `
                  <div class="km-tooltip-row">
                    <span class="km-tooltip-label">Rain Probability:</span>
                    <strong class="km-tooltip-value">${rainProb}</strong>
                  </div>
                ` : ''}
                <div class="km-tooltip-row km-tooltip-footer">
                  <span class="km-tooltip-label">Interval Uncertainty:</span>
                  <span class="km-unc-pill km-unc-${unc}">${unc.toUpperCase()}</span>
                </div>
              </div>
            </div>
            `,
            { sticky: true, className: 'km-leaflet-tooltip' }
          );

          layer.on({
            click: () => {
              if (props.id) {
                onSelectPanchayat(props.id);
              }
            },
            mouseover: (e: any) => {
              const l = e.target;
              if (props.id !== selectedPanchayatId) {
                l.setStyle({
                  weight: 2.5,
                  color: '#1F2937',
                  fillOpacity: 0.95
                });
              }
            },
            mouseout: (e: any) => {
              const l = e.target;
              if (props.id !== selectedPanchayatId) {
                geoLayer.resetStyle(l);
              }
            }
          });
        }
      });

      geoLayer.addTo(map);
      geoJsonLayerRef.current = geoLayer;

      // Bring selected feature to front if exists
      geoLayer.eachLayer((l: any) => {
        if (l.feature?.properties?.id === selectedPanchayatId && typeof l.bringToFront === 'function') {
          l.bringToFront();
        }
      });
    } catch (err: any) {
      console.error('Failed to render GeoJSON Layer:', err);
    }
  }, [geoJsonData, mode, variable, selectedPanchayatId]);

  const handleZoomIn = () => mapInstanceRef.current?.zoomIn();
  const handleZoomOut = () => mapInstanceRef.current?.zoomOut();

  const legendStops = getLegendStops(variable, mode);

  return (
    <div className="km-map-wrapper" role="region" aria-label="Interactive Weather Map">
      {/* Loading Overlay */}
      {loading && (
        <div className="km-map-loading" aria-live="polite">
          <div className="km-spinner" />
          <span>Loading downscaled spatial predictions...</span>
        </div>
      )}

      {/* Error state */}
      {mapError && (
        <div className="km-map-error-banner" role="alert">
          <AlertCircle size={18} />
          <span>{mapError}</span>
          <button type="button" className="km-btn km-btn-xs km-btn-outline" onClick={fitDistrictBounds}>
            <RefreshCw size={12} /> Retry
          </button>
        </div>
      )}

      {/* Offline tile degradation notice */}
      {tileError && (
        <div className="km-map-tile-warning" role="status">
          <Info size={14} />
          <span>Offline mode: Rendering vector boundaries with local cache.</span>
        </div>
      )}

      {/* Map Interactive Custom Controls */}
      <div className="km-map-control-overlay">
        <div className="km-map-btn-group" role="group" aria-label="Map Zoom & Navigation Controls">
          <button
            type="button"
            className="km-map-tool-btn"
            onClick={handleZoomIn}
            title="Zoom In"
            aria-label="Zoom In"
          >
            <ZoomIn size={18} />
          </button>
          <button
            type="button"
            className="km-map-tool-btn"
            onClick={handleZoomOut}
            title="Zoom Out"
            aria-label="Zoom Out"
          >
            <ZoomOut size={18} />
          </button>
          <button
            type="button"
            className="km-map-tool-btn"
            onClick={fitDistrictBounds}
            title="Fit to District Boundaries"
            aria-label="Fit to District Boundaries"
          >
            <Maximize2 size={18} />
          </button>
          <button
            type="button"
            className={`km-map-tool-btn ${showDistrictOutline ? 'active' : ''}`}
            onClick={() => setShowDistrictOutline(!showDistrictOutline)}
            title="Toggle Official District Outline"
            aria-label="Toggle Official District Outline"
          >
            <Layers size={18} />
          </button>
        </div>
      </div>

      {/* Persistent Boundary & Provenance Notice */}
      <div className="km-map-notice">
        <span>{t.illustrative_boundaries_notice}</span>
      </div>

      {/* Main Map Canvas */}
      <div
        ref={mapContainerRef}
        className="km-map-canvas"
        id="map-viewport"
        style={{ width: '100%', height: '100%', minHeight: '520px' }}
      />

      {/* No Data Overlay if empty */}
      {!loading && (!geoJsonData || !geoJsonData.features || geoJsonData.features.length === 0) && (
        <div className="km-map-empty-state">
          <AlertCircle size={28} className="km-text-warn" />
          <p>No spatial forecast layer available for this date.</p>
          <button type="button" className="km-btn km-btn-sm km-btn-outline" onClick={fitDistrictBounds}>
            Reset View
          </button>
        </div>
      )}

      {/* Dynamic Accessible Legend */}
      <div className="km-map-legend" role="region" aria-label="Map color scale legend">
        <div className="km-legend-title">
          {mode === 'difference' ? 'Difference (ML − Block)' : mode === 'coarse' ? 'Block Forecast' : 'KrishiMitra Local Estimate'}
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
          District boundary: {regionDetail?.boundary?.source || 'Open Data'} ({regionDetail?.boundary?.license || 'ODbL'}) | © OpenStreetMap
        </span>
      </div>
    </div>
  );
};
