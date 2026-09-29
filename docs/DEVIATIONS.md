# Production Migration & Deviations Guide

This document specifies the exact technical requirements, data agreements, and architectural switches necessary to migrate the SIH 26074 Weather Downscaling pipeline from the offline synthetic development testbed to live real-world operations.

---

## 1. Data Provider Architectural Switch

The codebase is built with pluggable data provider abstractions in `backend/services/data_provider.py` controlled by environment variables:

| Environment Variable | Synthetic Value (Current) | Production Target | Provider Mechanism |
|---|---|---|---|
| `FORECAST_PROVIDER` | `synthetic` | `imd_bharatfs` | Ingests 6 km / 12 km Bharat Forecast System NetCDF / GRIB2 grids |
| `FEATURE_PROVIDER` | `synthetic` | `gee_copernicus` | Extracts static terrain & dynamic NDVI rasters via Google Earth Engine API |
| `OBSERVATION_PROVIDER` | `synthetic` | `imd_aws` | Ingests ground-truth weather from IMD Automatic Weather Stations (AWS) |

---

## 2. External Services & Credentials Required for Production

To activate live real-world inference post-hackathon, the following credentials and data pipelines are needed:

### A. Bharat Forecast System (BFS) / IMD Numerical Predictions
- **Source:** Ministry of Earth Sciences (MoES) / IITM Pune / IMD.
- **Access Protocol:** MoES Open Data Portal or IMD SFTP server.
- **Format:** High-resolution GRIB2 / NetCDF daily atmospheric forecasts (Rainfall, Tmax, Tmin, RH, Wind).
- **Attribution Requirement:** *"Bharat Forecast System (BFS), Ministry of Earth Sciences, Government of India."*

### B. Terrain & Environmental Feature Rasters (Bhuvan & Copernicus)
- **Digital Elevation Model (DEM):** SRTM 30 m / CartoDEM 30 m from ISRO Bhuvan.
- **Land Use / Land Cover (LULC):** NRSC 50 m BHOOSAMPADA dataset.
- **Dynamic Vegetation (NDVI):** Sentinel-2 Surface Reflectance (10 m) processed via Google Earth Engine (requires GEE service account JSON key mounted at `/run/secrets/gee_service_account.json`).
- **Attribution Requirement:** *"BHOOSAMPADA, National Remote Sensing Centre (NRSC), ISRO."*

### C. Administrative Panchayat GIS Boundaries (LGD)
- **Fallback:** Where exact cadastral village polygons are missing, the pipeline utilizes the seeded Voronoi partition clipped to the official district boundary, or optionally the spatial grid representation (`geospatial/grid.py`) with current inference evaluated at the panchayat administrative level (no 1 km resolution is claimed).

---

## 3. Real-World Limitations & Guardrails

1. **Extreme Weather Nowcasting:**
   - Mesoscale downscaling models are designed for 24–168 hour forecasts. Flash floods, cloudbursts, and convective storms require Doppler weather radar nowcasting, which is linked directly to IMD's Damini / Mausam radar portals.
2. **Satellite Cadence:**
   - Optical Sentinel-2 NDVI updates occur every 5–10 days depending on orbital swath and cloud cover.
3. **Agronomic Calibration:**
   - Agro-advisories should be vetted in collaboration with State Agricultural Universities (SAUs) and Krishi Vigyan Kendras (KVKs) for regional micro-climate calibration.
