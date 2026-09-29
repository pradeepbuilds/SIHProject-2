# Presentation Deck Outline (15 Slides)

**Problem Statement 26074:** Downscaling of Weather Forecast from Block Level to Panchayat Level  
**Organization:** Ministry of Earth Sciences (MoES) — India Meteorological Department (IMD)

---

### Slide 1: Title & Executive Summary
- **Title:** Hyper-Local Agromet Decision Support: Statistical Weather Downscaling from Block to Panchayat Level
- **Subtitle:** Physics-Guided, Terrain-Aware Quantile Tree Ensembles for Gram Panchayat Agriculture
- **Team Info:** SIH Team 26074 | Ministry of Earth Sciences (MoES) / IMD

### Slide 2: The Spatial Granularity Gap
- **Key Point:** NWP models and IMD block forecasts operate at ~10–25 km resolutions.
- **Problem:** Micro-climatic variation (hills, valleys, water bodies, crop canopies) within a 200 km² block causes severe local forecast errors for smallholder farmers.

### Slide 3: Existing Gap Analysis
- **Key Point:** Existing Panchayat Mausam Seva (PMS) replicates or linearly interpolates block-level values.
- **Core Differentiation:** Our pipeline performs statistical downscaling conditioned on micro-topography and land surface features rather than simple replication.

### Slide 4: Proposed Solution Architecture
- **Key Point:** End-to-end data pipeline combining coarse forecasts, static geospatial rasters (DEM, LULC, NDVI), in-process quantile ML inference, and a dynamic advisory rule engine.

### Slide 5: How Statistical Downscaling Works
- **Inputs:** Coarse block forecast ($T, R, RH, \text{lead time}$) + Static GIS features (Elevation, Slope, Aspect, NDVI, Soil).
- **Model:** Fast, interpretable Quantile LightGBM models producing $p_{10}, p_{50}, p_{90}$ probabilistic intervals.

### Slide 6: Authoritative Data Sources & Licenses
- **Datasets:**
  - Bharat Forecast System (BFS) / IMD NWP Forecasts (IITM / MoES).
  - SRTM Digital Elevation Model (ISRO Bhuvan / NASA).
  - NRSC BHOOSAMPADA LULC (ISRO).
  - Copernicus Sentinel-2 Multi-Spectral Imagery (ESA / GEE).

### Slide 7: AI/ML Strategy & Why Quantile LightGBM
- **Justification:** Superior tabular/spatial accuracy, sub-millisecond inference latency, zero GPU requirements, and direct quantile regression output without assuming Gaussian error distribution.

### Slide 8: End-to-End System Architecture
- **Components:** PostGIS spatial database, FastAPI async backend, in-process inference engine, and responsive React + Leaflet choropleth dashboard.

### Slide 9: Complete Data-to-Advisory Workflow
- **Workflow:** Grid rasterization $\rightarrow$ Spatial join $\rightarrow$ Quantile inference $\rightarrow$ Rule-based phenological advisory $\rightarrow$ Dissemination.

### Slide 10: Live Dashboard Demonstration
- **Screenshots:** Interactive choropleth map, district $\rightarrow$ block $\rightarrow$ panchayat drilldown, coarse vs. ML layer toggle, and on-demand GPS coordinate prediction.

### Slide 11: Agro-Advisory Engine & Uncertainty Linkage
- **Key Feature:** Crop stage sensitivity matrix (e.g. flowering heat tolerance) with automatic advisory caution prefix when forecast uncertainty is high.

### Slide 12: Unique Selling Propositions (USPs)
- 1. Terrain & land-cover aware corrections.
- 2. Honest uncertainty intervals (never fake accuracy percentages).
- 3. Interpretable feature attribution (SHAP values).
- 4. Open, documented REST API.
- 5. Full data provenance tagging (`data_source_tag`, `is_synthetic`).

### Slide 13: Empirical Validation & Benchmark Comparison
- **Results:** Spatial holdout validation demonstrating significant MAE and RMSE reductions over the Block Replication Baseline.

### Slide 14: Scalability & Implementation Roadmap
- **Roadmap:** Pilot district (Tumakuru) $\rightarrow$ Statewide scaling across Karnataka agro-climatic zones $\rightarrow$ National deployment.

### Slide 15: Impact, Policy Alignment & Conclusion
- **Impact:** Aligns directly with PM Fasal Bima Yojana, Weather-Based Crop Insurance (WBCIS), and climate-resilient agriculture initiatives.
