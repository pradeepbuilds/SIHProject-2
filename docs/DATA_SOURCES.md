# KrishiMitra — Data Sources, Provenance & Licensing Register

> Every dataset, administrative boundary, climatological normal, and terrain parameter utilized in KrishiMitra is recorded in this register with its exact licensing terms, provenance status, attribution requirements, and operational usage mode.

---

## 1. Regional Provenance & Data Mode Matrix

| Region ID | State | District | District Boundary | Sub-Unit Boundaries | Terrain (DEM) | Weather / Climate | Climatology Normals Citation |
|---|---|---|---|---|---|---|---|
| `ka-tumakuru` | Karnataka | Tumakuru | **Real** (geoBoundaries ADM2) | **Illustrative** (Seeded Voronoi) | **Calibrated** (Topographic Lapse) | **Calibrated Synthetic** | NASA POWER & IMD Karnataka Agro-Met Normals |
| `mh-ratnagiri` | Maharashtra | Ratnagiri | **Real** (geoBoundaries ADM2) | **Illustrative** (Seeded Voronoi) | **Calibrated** (Konkan Escarpment) | **Calibrated Synthetic** | IMD Western Ghats Monsoonal Precipitation Climatology |
| `pb-ludhiana` | Punjab | Ludhiana | **Real** (geoBoundaries ADM2) | **Illustrative** (Seeded Voronoi) | **Calibrated** (Indo-Gangetic Plain) | **Calibrated Synthetic** | PAU Agrometeorology / IMD Punjab Climate Profile |
| `rj-jodhpur` | Rajasthan | Jodhpur | **Real** (geoBoundaries ADM2) | **Illustrative** (Seeded Voronoi) | **Calibrated** (Thar Semi-Arid) | **Calibrated Synthetic** | CAZRI Jodhpur Climatological Station Normals |

---

## 2. Component Datasets & Licensing Terms

### 2.1 Administrative District Boundaries
- **Source:** geoBoundaries Global Administrative Database (ADM2 Level) / Survey of India Open Data
- **URL:** [https://www.geoboundaries.org/](https://www.geoboundaries.org/)
- **Licence:** Creative Commons Attribution 4.0 International (CC BY 4.0)
- **Attribution Required:** *"Boundary data provided by geoBoundaries (Runfola et al., 2020), CC BY 4.0."*
- **Usage in KrishiMitra:** Cached locally in `regions/data/<region_id>/district.geojson`. Used as the clipping polygon for sub-district administrative partitions and bounding-box validation.
- **Classification:** **REAL**

### 2.2 Sub-District Units (Panchayats & Blocks)
- **Source:** Algorithmic Seeded Voronoi Tessellation
- **Licence:** Open Source / MIT (KrishiMitra internal generator)
- **Attribution:** *"Illustrative sub-district boundaries. District outline is official-source."*
- **Usage in KrishiMitra:** Generates realistic, non-overlapping polygonal administrative units inside the true district boundary polygon to simulate panchayat clusters. Labels are neutral ("Block 1", "Panchayat 12") without fabricated village names.
- **Classification:** **ILLUSTRATIVE**

### 2.3 Terrain Elevation & Topography
- **Source:** SRTM 90m Digital Elevation Database / Synthetic Orographic Generator
- **Licence:** Public Domain (NASA / USGS)
- **Attribution:** *"Topographic relief derived from NASA SRTM elevation data."*
- **Usage in KrishiMitra:** Provides panchayat-level elevation, slope, and aspect to calculate adiabatic lapse rate temperature adjustments (-6.5 °C/km) and windward orographic rainfall enhancement.
- **Classification:** **CALIBRATED**

### 2.4 Weather Observations & Numerical Weather Predictions (NWP)
- **Source:** Physics-shaped synthetic meteorological generator calibrated against monthly normals from NASA POWER and IMD Climatological Normals.
- **Licence:** Open Access NASA Open Data Policy / KrishiMitra Simulation Engine
- **Attribution:** *"Simulated meteorological fields shaped by NASA POWER agroclimatology normals."*
- **Usage in KrishiMitra:** Generates coarse (10-25 km block) and local panchayat-level weather time-series featuring realistic synoptic phenomena: convective monsoon downpours, dry spells, heatwaves, and winter cold snaps.
- **Classification:** **CALIBRATED SYNTHETIC** (Clearly badged in UI and documentation; never misrepresented as real AWS ground observations).

### 2.5 Map Basemap Tiles
- **Source:** OpenStreetMap contributors
- **Licence:** Open Database License (ODbL)
- **Attribution:** *"© OpenStreetMap contributors"*
- **Usage in KrishiMitra:** Optional visual backdrop. Softened with CSS filters to ensure choropleth legibility. KrishiMitra vector maps degrade gracefully when disconnected from the internet.
- **Classification:** **REAL**

---

## 3. Strict Honesty Invariant

In accordance with KrishiMitra Operating Rule 1.1:
1. Every row in the database and feature store carries `is_synthetic = true` and `data_source_tag = 'synthetic'` or `'synthetic_calibrated'`.
2. All analytics and accuracy claims in the dashboard and research papers carry the badge: `"Synthetic-world result — generator uses static terrain features as inputs; skill reflects performance in simulated physics, not live AWS station observations."`
3. We openly state all limitations to judging panels and stakeholders.
