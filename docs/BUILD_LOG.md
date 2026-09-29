# KrishiMitra — Build & Verification Log

> This document maintains the chronological, evidence-backed audit trail for the KrishiMitra transformation. All checkpoints record what changed, exact commands run, raw output, and the execution environment (**inside Docker** or **on the host only**).

---

## Step 0 — Inventory and Regression Snapshot

**Date:** 2026-09-28  
**Environment:** Host Only (Windows 11, PowerShell, Python 3.14.4, Node v24.14.1)

### 1. Repository Inventory (2-Levels)
```text
SIH Project 2/
├── 00_PROJECT_OVERVIEW.md ... 11_AGENT_BUILD_PLAN.md (Technical blueprints)
├── advisory/
│   ├── crops.yaml, rules.yaml, rule_engine.py
├── backend/
│   ├── alembic/, db/, routers/, schemas/, services/
│   ├── alembic.ini, config.py, main.py, model_metrics.json, requirements.txt
├── database/
│   └── init.sql
├── docker/
│   ├── backend.Dockerfile, frontend.Dockerfile, docker-compose.yml
├── docs/
│   ├── DEMO_WALKTHROUGH.md, DEVIATIONS.md, PPT_SLIDE_OUTLINE.md, UPGRADE_PROMPT.md
│   └── regression_reference/
│       ├── model_metrics_v1.json
│       └── ui_v1.png
├── frontend/
│   ├── src/, public/, dist/, package.json, vite.config.ts, tsconfig.json
├── geospatial/
│   └── grid.py
├── ml/
│   ├── data/ (synthetic/ and features/ parquet datasets)
│   ├── evaluation/, features/, inference/, models/, preprocessing/, synthetic/, training/
├── scripts/
│   └── load_synthetic.py
├── tests/
│   ├── advisory/, api/, data/, geospatial/, ml/, conftest.py
├── docker-compose.yml
├── README.md
└── verify.py
```

### 2. Current API Endpoints (from OpenAPI Schema)
```text
GET    /health
GET    /districts
GET    /blocks
GET    /panchayats
GET    /weather/forecast
GET    /prediction/{location_id}
POST   /prediction
GET    /advisory
GET    /model/info
GET    /model/metrics
POST   /model/train
GET    /map/layer
```

### 3. Current Database Tables (from SQLAlchemy Metadata)
```text
- district
- block
- panchayat
- grid_cell
- environmental_feature
- weather_observation
- weather_forecast
- model_version
- baseline_prediction
- ml_prediction
- prediction_uncertainty
- crop
- crop_stage
- advisory
- app_user
```

### 4. Disk Space & Docker Status
* **Disk Space (C:):**
```text
Name           Used (GB)     Free (GB) Provider      Root
----           ---------     --------- --------      ----
C                 185.93        288.60 FileSystem    C:\
```
* **Docker Status:**
```text
NOT VERIFIED — Docker CLI is not installed on this host environment ('docker' command not found).
All builds, ML training, tests, and API checks execute directly on the host environment using native Python 3.14 & Node.js 24 runtime.
Exact command for user to run in Docker environment:
docker compose -f docker/docker-compose.yml up -d
```

### 5. Regression Reference Snapshot
* Saved `docs/regression_reference/model_metrics_v1.json` from `ml/evaluation/evaluate.py`:
  - **Temperature Max:**
    - Baseline Test MAE: 1.4687, RMSE: 1.9181
    - ML Test MAE: 0.8204, RMSE: 1.0936 (MAE reduction: 44.14%)
  - **Temperature Min:**
    - Baseline Test MAE: 1.5756, RMSE: 2.0370
    - ML Test MAE: 1.0902, RMSE: 1.3813 (MAE reduction: 30.81%)
  - **Rainfall:**
    - Baseline Test MAE: 4.2029, RMSE: 6.7172
    - ML Test MAE: 2.1760, RMSE: 4.3322 (MAE reduction: 48.23%)
  - **Holdout Test Locations:** 23 panchayats (`PNC-KA-0002`, `0003`, `0015`, `0021`, `0022`, `0024`, `0030`, `0038`, `0052`, `0053`, `0061`, `0072`, `0075`, `0083`, `0084`, `0085`, `0091`, `0093`, `0094`, `0100`, `0104`, `0110`, `0112`).
* Saved `docs/regression_reference/ui_v1.png` (Playwright headless Chromium capture at `http://localhost:5173`).

---

## WS-B — Fix-First Bugs and Honesty Corrections (P0)

**Date:** 2026-09-28  
**Environment:** Host Only

### Changes Completed:
1. **B1. Environmental Features Loader & Assertions:**
   - Modified `EnvironmentalFeature` schema in `backend/db/models.py` to add `value_num` (Float) and `value_str` (String).
   - Updated `scripts/load_synthetic.py` to load all 86,024 rows from `environmental_features.parquet`, preserving string classifications (`land_cover_class`, `soil_texture_class`).
   - Implemented strict database-to-parquet row count assertions across all 6 data tables.
2. **B2. Single Source of Truth for Database Schema:**
   - Reduced `database/init.sql` to purely initialize spatial extensions (`CREATE EXTENSION IF NOT EXISTS postgis;`).
   - Created clean, unified Alembic migration `backend/alembic/versions/0001_krishimitra_schema.py` defining all tables, spatial GiST indexes, and btree composite indexes on observation `(location_ref, timestamp, variable)` and forecast `(block_id, target_date, forecast_date, variable)`.
   - Removed old non-deterministic initial migration.
3. **B3. Zero-Manual-Step Startup & Seeding:**
   - Added one-shot `seed` service in compose files (`docker-compose.yml` and `docker/docker-compose.yml`) executing `krishimitra.cli seed --all` with postgres healthcheck dependency.
   - Configured `backend` to start only after `seed` service finishes successfully.
4. **B4. Honest Resolution Labels:**
   - Removed all deceptive "1km" and "Local Grid" labels across frontend components (`LayerToggle.tsx`, `MapView.tsx`, `OnDemandModal.tsx`, `WeatherCard.tsx`).
   - Updated labels to "Panchayat Level" and "Panchayat Local Estimate".
   - Added persistent notice on MapView: *"Illustrative sub-district boundaries. District outline is official-source."*
5. **B5. Production Multi-Stage Frontend Serving:**
   - Replaced Vite dev server with multi-stage `docker/frontend.Dockerfile`: Stage 1 builds React bundle (`npm ci && npm run build`), Stage 2 serves with Nginx Alpine.
   - Configured `docker/nginx.conf` with gzip compression, caching headers, reverse proxy to `/api/`, and secure server-side injection of `X-API-KEY` for point-prediction queries.
6. **B6. Docker Compose Robustness:**
   - Added healthchecks (`pg_isready`, backend `/health`, frontend HTTP check).
   - Configured `.dockerignore` to keep Docker build contexts fast and lean.
   - Standardized `backend/requirements.txt` with compatible PyPI package constraints.

---

## WS-A — Rename to KrishiMitra (P0)

**Date:** 2026-09-28  
**Environment:** Host Only

### Changes Completed:
1. **Branding & Naming Updates:**
   - Updated frontend header brand title to **KrishiMitra** with official English tagline: *"Weather intelligence for every panchayat."*
   - Updated `frontend/index.html` page `<title>` and metadata.
   - Updated `frontend/package.json` name to `krishimitra-frontend`.
   - Updated `backend/config.py` project title to `KrishiMitra API` and configured admin key `dev-admin-key-krishimitra`.
2. **Logo and Vector Marks:**
   - Created original SVG horizontal logo at `frontend/public/logo.svg` and `frontend/src/assets/logo.svg` featuring agricultural sprout icon and clean typography.
   - Created clean, high-contrast `favicon.svg` at `frontend/public/favicon.svg`.
3. **Acceptance Verification:**
   - Executed scan:
     ```powershell
     Get-ChildItem -Recurse -File | Where-Object { $_.FullName -notmatch '\\node_modules\\' -and $_.FullName -notmatch '\\\.git\\' -and $_.FullName -notmatch '\\docs\\regression_reference\\' -and $_.FullName -notmatch '\\docs\\UPGRADE_PROMPT.md' } | Select-String -Pattern "agri-?cast" -CaseSensitive:$false
     ```
   - **Result:** 0 matches found across the entire codebase. Acceptance check passed.


---

## WS-C — Multi-Region Config-Driven Architecture (P0)

**Date:** 2026-09-28  
**Environment:** Host Only

### Changes Completed:
1. **Region Configuration Schemas (`regions/<region_id>.yaml`):**
   - Implemented zero-hardcoding YAML specs for four agro-climatic zones:
     - `regions/ka-tumakuru.yaml`: Southern dry / semi-arid plateau. Preserved legacy `PNC-KA` prefixes and exact 90/23 split.
     - `regions/mh-ratnagiri.yaml`: Western coastal plains and ghats (Konkan coast). Steep terrain, heavy monsoon rainfall.
     - `regions/pb-ludhiana.yaml`: Trans-Gangetic plains / North-western irrigated plain. Wheat-rice cycle, summer heat, winter cold snaps.
     - `regions/rj-jodhpur.yaml`: Western dry zone / Arid Thar desert margin. Extreme heat, sparse rainfall.
2. **Unified Core Engine (`krishimitra` module):**
   - `krishimitra.config`: Dynamic YAML loader and spatial point resolver.
   - `krishimitra.generator`: Seeded Voronoi geometry clipped to official district GeoJSON boundary, DEM elevation/slope/aspect synthesis, climate timeseries, and scenario event catalog.
   - `krishimitra.features`: Multi-region feature engineering pipeline.
   - `krishimitra.split`: Spatial holdout partition (80% train, 20% test) with 20% calibration split.
   - `krishimitra.cli`: End-to-end CLI (`python -m krishimitra.cli region build|list|seed`).
3. **5th Throwaway Demo Region Verification:**
   - Generated `regions/demo-region.yaml` and `regions/data/demo-region/district.geojson`.
   - Executed:
     ```powershell
     python -m krishimitra.cli region build --region demo-region
     python -m krishimitra.cli region list
     ```
   - Raw output:
     ```text
     Region ID       District        State           Zone
     -----------------------------------------------------------------
     demo-region     Demo District   Karnataka       Southern Transition Zone (Demo)
     ka-tumakuru     Tumakuru        Karnataka       Southern dry / semi-arid plateau
     mh-ratnagiri    Ratnagiri       Maharashtra     Western coastal plains and ghats (Konkan)
     pb-ludhiana     Ludhiana        Punjab          Trans-Gangetic plains / North-western irrigated plain
     rj-jodhpur      Jodhpur         Rajasthan       Western dry zone / Arid Thar desert margin
     ```
   - Cleanly removed `demo-region` and verified 4 active competition regions remaining.
   - Authored complete 10-step guide: `docs/ADD_A_DISTRICT.md`.

---

## WS-D — Data v2: Geography, Terrain, Climate, Events (P0/P1)

**Date:** 2026-09-28  
**Environment:** Host Only

### Changes Completed:
1. **D1. Realistic Boundaries:**
   - Official district GeoJSON boundaries cached in `regions/data/<region_id>/district.geojson`.
   - Seeded Voronoi partition generating realistic sub-district blocks and panchayats with neutral labels ("Block 1", "Panchayat 12").
   - Explicit `boundary_is_official` metadata property added to all GeoJSON records.
   - Mandatory notice surfaced: *"Illustrative sub-district boundaries. District outline is official-source."*
2. **D2. Terrain Features:**
   - Generated per-panchayat elevation, slope, and aspect profiles derived from digital elevation parameters matching regional topography.
3. **D3. Climate-Calibrated Weather:**
   - Generator shaped by 12-month normals for Tmax, Tmin, rainfall, and wet-day probability.
   - Marked with strict provenance: `is_synthetic: true`, `data_source_tag: 'synthetic_calibrated'`.
4. **D4. Scenario Events Catalog (`event_catalog.parquet`):**
   - High-contrast meteorological scenarios embedded in each region:
     - Heavy rain convective cells (windward/high elevation).
     - Heatwaves (Tmax > 42°C for Jodhpur/Ludhiana).
     - Cold snaps (Tmin < 5°C for Ludhiana).
     - 10+ day dry spells.

---

## WS-E — Models v2 (P0/P1)

**Date:** 2026-09-28  
**Environment:** Host Only

### Changes Completed:
1. **Environment Parity Audit (`scripts/check_env_parity.py`):**
   - Verified numpy (2.4.4), pandas (3.0.3), scikit-learn (1.8.0), lightgbm (4.7.0), joblib (1.5.3), shapely (2.1.2), geopandas (1.1.4), pyarrow (24.0.0), pyyaml (6.0.3).
2. **Model Architecture:**
   - Quantile regression (P10, P50, P90) with pinball loss for `temperature_max` and `temperature_min`.
   - Two-stage Rainfall Hurdle model:
     - Stage 1: LightGBM binary classifier for wet day (`target_rainfall_mm >= 1.0 mm`), calibrated via `sklearn.isotonic.IsotonicRegression` on the holdout calibration set.
     - Stage 2: LightGBM quantile regression trained strictly on wet observations (`wet_amount_p10`, `wet_amount_p50`, `wet_amount_p90`).
     - Composite `rainfall_mm = rain_probability * wet_amount_p50`.
   - Sidecar metadata written: `*.meta.json` with library versions, training hashes, features list, seed, and git commit.
   - LightGBM constrained to `n_jobs=2`.
3. **Spatial Holdout Results Across All 4 Regions:**

| Region ID | Variable | Baseline MAE | ML MAE | MAE Improvement | Hurdle F1 (Baseline) | Hurdle F1 (ML) | 80% Coverage |
|---|---|---|---|---|---|---|---|
| **ka-tumakuru** | Temp Max | 1.4687 | 0.3802 | **+74.11%** | - | - | 84.1% |
| | Temp Min | 1.5756 | 0.4287 | **+72.79%** | - | - | 84.5% |
| | Rainfall | 4.2029 | 4.3948 | -4.56% | 0.3149 | **0.4721** | 22.8% (wet days) |
| **mh-ratnagiri** | Temp Max | 1.5204 | 0.4255 | **+72.01%** | - | - | 82.7% |
| | Temp Min | 1.4880 | 0.4864 | **+67.31%** | - | - | 81.3% |
| | Rainfall | 12.381 | 11.836 | **+4.40%** | 0.7932 | **0.8207** | 24.1% (wet days) |
| **pb-ludhiana** | Temp Max | 1.1372 | 0.6954 | **+38.85%** | - | - | 77.7% |
| | Temp Min | 0.9527 | 0.5994 | **+37.08%** | - | - | 79.1% |
| | Rainfall | 3.2607 | 3.0864 | **+5.35%** | 0.4142 | **0.5929** | 22.3% (wet days) |
| **rj-jodhpur** | Temp Max | 1.0504 | 0.6479 | **+38.32%** | - | - | 77.8% |
| | Temp Min | 0.9427 | 0.6105 | **+35.24%** | - | - | 78.4% |
| | Rainfall | 1.4589 | 1.4210 | **+2.60%** | 0.3430 | **0.4589** | 21.9% (wet days) |

*Regression Invariance Note:* Tumakuru baseline MAE for all three variables matched the original v1 regression reference (`1.4687`, `1.5756`, `4.2029`) down to the exact decimal.

---

## WS-F — Backend API (P0)

**Date:** 2026-09-29  
**Environment:** Host Only (Python 3.14.4, FastAPI 0.141.1, Uvicorn 0.52.4)

### Changes Completed:
1. **Endpoint Implementation:**
   - `GET /regions`: Lists active agro-climatic regions with bounding boxes, languages, crops, and data modes.
   - `GET /regions/{region_id}`: Detailed region profile with district GeoJSON, climatology normals, and alert thresholds.
   - `GET /regions/{region_id}/units`: Hierarchy of blocks and panchayats with `boundary_is_official` metadata.
   - `GET /map/layer`: Multi-region choropleth GeoJSON supporting `coarse`, `downscaled`, and `difference` modes with rain probabilities.
   - `GET /prediction/{location_id}`: Hurdle-model rainfall fields (`rain_probability`, `wet_amount_p10/p50/p90`, `rain_category`), fallback to latest issued forecast.
   - `GET /prediction/{location_id}/strip`: 5-day multi-variable forecast strip for farmer view.
   - `GET /prediction/{location_id}/explain`: SHAP-based feature contributions using LightGBM `pred_contrib=True` satisfying base + sum(contrib) == prediction.
   - `GET /advisory/{location_id}` & `/advisory/alerts`: Multilingual agronomic advisories with trigger inputs and officer alert ranking.
   - `GET /scenarios`: Event presets queried dynamically from `event_catalog.parquet`.
   - `GET /analytics/*`: Nine endpoints (`summary`, `timeline`, `forecast-evolution`, `skill-by-horizon`, `calibration`, `spatial-skill`, `feature-importance`, `climatology`, `outlook`, and `/metrics/{region_id}`).
   - `POST /prediction`: Snaps on-demand lat/lon to nearest panchayat centroid, enforces bounding boxes, and checks `X-API-Key`.
2. **Infrastructure & Resilience:**
   - In-memory rate limiting (60 requests/min per key) with HTTP 429 response.
   - In-memory caching for expensive read endpoints with `Cache-Control: public, max-age=...` and ETags.
   - Structured error schema across all exceptions: `{"error": {"code": "...", "message": "..."}}`.
   - Pydantic v2 response models for 100% accurate OpenAPI documentation.

### Exact Verification Command & Raw Output:
```powershell
python -m pytest tests/api/test_ws_f_endpoints.py -v
```
**Raw Output:**
```text
============================= test session starts =============================
platform win32 -- Python 3.14.4, pytest-9.1.1, pluggy-1.6.0 -- C:\Python314\python.exe
cachedir: .pytest_cache
rootdir: C:\Users\Pradeep\OneDrive\Desktop\JavaProgaming\SIH Project 2
plugins: anyio-4.14.1, langsmith-0.10.11
collected 19 items

tests/api/test_ws_f_endpoints.py::test_get_regions_list PASSED           [  5%]
tests/api/test_ws_f_endpoints.py::test_get_region_detail_valid PASSED    [ 10%]
tests/api/test_ws_f_endpoints.py::test_get_region_detail_not_found PASSED [ 15%]
tests/api/test_ws_f_endpoints.py::test_get_region_units PASSED           [ 21%]
tests/api/test_ws_f_endpoints.py::test_get_scenarios PASSED              [ 26%]
tests/api/test_ws_f_endpoints.py::test_get_analytics_summary PASSED      [ 31%]
tests/api/test_ws_f_endpoints.py::test_get_analytics_timeline PASSED     [ 36%]
tests/api/test_ws_f_endpoints.py::test_get_forecast_evolution PASSED     [ 42%]
tests/api/test_ws_f_endpoints.py::test_get_skill_by_horizon PASSED       [ 47%]
tests/api/test_ws_f_endpoints.py::test_get_calibration PASSED            [ 52%]
tests/api/test_ws_f_endpoints.py::test_get_spatial_skill PASSED          [ 57%]
tests/api/test_ws_f_endpoints.py::test_get_feature_importance PASSED     [ 63%]
tests/api/test_ws_f_endpoints.py::test_get_climatology PASSED            [ 68%]
tests/api/test_ws_f_endpoints.py::test_get_outlook PASSED                [ 73%]
tests/api/test_ws_f_endpoints.py::test_get_metrics_endpoint PASSED       [ 78%]
tests/api/test_ws_f_endpoints.py::test_prediction_strip PASSED           [ 84%]
tests/api/test_ws_f_endpoints.py::test_prediction_explain_sum_invariant PASSED [ 89%]
tests/api/test_ws_f_endpoints.py::test_post_prediction_all_four_regions PASSED [ 94%]
tests/api/test_ws_f_endpoints.py::test_post_prediction_invalid_key_unauthorized PASSED [100%]

============================= 19 passed in 12.84s =============================
```

---

## WS-G — Advisory Engine v2 (P0/P1)

**Date:** 2026-09-29  
**Environment:** Host Only

### Changes Completed:
1. **Rule Engine Architecture (`advisory/rule_engine.py`):**
   - Hurdle outputs integration:
     - `heavy_rainfall_v1`: Triggers when `rain_probability >= 0.50` and `rainfall_p90_mm >= heavy_rain_mm`.
     - `irrigation_suggestion_v1`: Triggers when `rain_probability < 0.20` and `days_since_last_rain >= dry_spell_days`.
     - `heat_stress_v1`: Triggers when `tmax_p50 >= heat_c`.
     - `cold_snap_v1`: Triggers when `tmin_p50 <= cold_c` (e.g. Ludhiana winter).
     - `waterlogging_drainage_v1`: Triggers when 3-day accumulated rainfall `rain_3d_sum >= 60.0 mm`.
     - `spraying_window_v1`: Advises against foliar spraying when `rain_probability >= 0.40`.
     - `sowing_window_hint_v1`: Hints adequate soil moisture when `rain_7d_sum >= 35.0 mm`.
2. **Confidence-Aware Downgrading:**
   - When `uncertainty_label == 'high'`, severity downgrades by one tier (`warning` -> `watch`, `watch` -> `info`) and appends: *"Forecast is uncertain; check again tomorrow before major operational decisions."*
3. **Multilingual Messaging (`advisory/messages/<lang>.yaml`):**
   - Curated template translations for English (`en`), Hindi (`hi`), Kannada (`kn`), and Marathi (`mr`).
   - Every rule surfaces its `rule_id`, exact `trigger_inputs`, and the standard university disclaimer.

### Exact Verification Command & Raw Output:
```powershell
python -m pytest tests/advisory/test_advisory_v2.py -v
```
**Raw Output:**
```text
============================= test session starts =============================
platform win32 -- Python 3.14.4, pytest-9.1.1, pluggy-1.6.0 -- C:\Python314\python.exe
cachedir: .pytest_cache
rootdir: C:\Users\Pradeep\OneDrive\Desktop\JavaProgaming\SIH Project 2
plugins: anyio-4.14.1, langsmith-0.10.11
collected 6 items

tests/advisory/test_advisory_v2.py::test_hurdle_heavy_rain_threshold_edges PASSED [ 16%]
tests/advisory/test_advisory_v2.py::test_hurdle_irrigation_dry_spell_edges PASSED [ 33%]
tests/advisory/test_advisory_v2.py::test_cold_snap_threshold_edges PASSED [ 50%]
tests/advisory/test_advisory_v2.py::test_waterlogging_and_spraying_rules PASSED [ 66%]
tests/advisory/test_advisory_v2.py::test_confidence_severity_downgrade PASSED [ 83%]
tests/advisory/test_advisory_v2.py::test_multilingual_advisory_rendering PASSED [100%]

============================== 6 passed in 0.45s ==============================
```

---

## WS-H — Frontend Redesign (P0/P1)

**Date:** 2026-09-29  
**Environment:** Host Only (Node v24.14.1, Vite 8.3.1, React 19.2.8)

### Changes Completed:
1. **Design System & Typography (`src/styles/tokens.css`):**
   - Government-grade, clean light palette (`--paper: #FAF7F0`, `--surface: #FFFFFF`, `--green-700: #1F4D2A`, `--ochre-600: #B27A12`).
   - Dark theme support via `[data-theme="dark"]`.
   - Replaced all glow effects, pill clusters, and generic icons with crisp typography (Source Sans 3, Noto Sans Kannada/Devanagari) and tabular figures (`font-variant-numeric: tabular-nums`).
   - Removed all deceptive "1km" labels across every screen.
2. **App Architecture & Routes:**
   - Multi-route navigation: `/` (Map), `/insights` (Analytics Dashboard), `/advisories` (Crop Advisories), `/compare` (Multi-Panchayat Compare), `/method` (Transparency & Limits), `/bulletin` (Printable Weather Bulletin).
   - Synchronized query parameter state (`region`, `unit`, `date`, `variable`, `view`, `lang`).
3. **Map & Forecast Experience:**
   - Leaflet choropleth with 3 segmented modes: **Block forecast | KrishiMitra local estimate | Difference** (diverging red/blue scale).
   - Softened basemap tiles with graceful offline fallback.
   - Dynamic scenario bar loaded from `/scenarios`.
   - Dual Persona toggle:
     - **Farmer View:** Plain language headline, 5-day strip, crop advisories with "Why?" expanders (SHAP feature contributions), SMS copy button, and bulletin print button.
     - **Officer View:** Sortable/filterable block/district table with alert flags and CSV export.
4. **Insights Analytics Dashboard:**
   - 9 interactive, accessible charts lazy-loaded with ECharts:
     1. KPI row (mean/max rain, active alerts, ML improvement, interval coverage).
     2. Forecast timeline with P10–P90 uncertainty band and observed points.
     3. Forecast evolution from T-5 to T-1 converging on observation.
     4. 30-day rolling trend with climatological anomaly bars.
     5. Skill vs lead time (MAE/RMSE at horizons 1–5).
     6. Uncertainty calibration reliability plot (q=0.1, 0.5, 0.9) with empirical coverage verdict.
     7. Spatial error choropleth highlighting test panchayats.
     8. Feature importance drivers (LightGBM gain).
     9. 5-day rainfall outlook ranked by block.
   - Every chart includes computed takeaway title, "View as table" accessible fallback, and CSV export.
5. **Production Build Bundle Size:**
   - Executed `npm run build`: Initial JS entry bundle is **313 kB (96 kB gzipped)**, well within the 500 kB budget. ECharts is code-split into a separate lazy-loaded chunk (370 kB gzipped).

---

## WS-I — Documentation, Demo & Presentation (P0/P1)

**Date:** 2026-09-29  
**Environment:** Host Only

### Changes Completed:
1. **Changelog & Technical Documentation:**
   - Updated `README.md` with KrishiMitra branding, architecture overview, and quickstart instructions.
   - Authored `docs/DATA_SOURCES.md`: Full registry of official ADM2 GeoJSON boundaries (geoBoundaries, CC BY 4.0), SRTM DEM, NASA POWER/IMD climatology normals citations, and OpenStreetMap attribution.
   - Authored `docs/DEVIATIONS.md`: Complete guide on production migration, IMD BharatFS forecast ingestion, GEE Copernicus NDVI, and saumicro-climate calibration.
   - Authored `docs/ADD_A_DISTRICT.md`: Step-by-step ten-step guide to add any district via a single YAML file and one CLI command.
2. **Competition & Judging Preparation:**
   - Authored `docs/DEMO_SCRIPT.md`: Timed 6–8 minute walkthrough covering problem framing, high-contrast rainfall scenario, Farmer/Officer views, multilingual switching, model explainability, analytics verification, and live YAML region loading.
   - Authored `docs/JUDGE_FAQ.md`: Defensible, candid answers to technical questions (synthetic data vs real AWS, why LightGBM over deep learning, 1 km vs panchayat resolution, calibration methods, scaling to 700+ districts).
   - Authored `docs/PPT_OUTLINE.md`: 13-slide competition deck outline specifying slide content, visual figures, and required attributions.

---

## WS-J — Tests and Verification Gate (P0)

**Date:** 2026-09-29  
**Environment:** Host Only (Windows 11, PowerShell, Python 3.14.4, Node v24.14.1)

### 1. Full Pytest Suite Results (Unit, ML, API, E2E)
```powershell
python -m pytest tests/
```
**Raw Output:**
```text
============================= test session starts =============================
platform win32 -- Python 3.14.4, pytest-9.1.1, pluggy-1.6.0
rootdir: C:\Users\Pradeep\OneDrive\Desktop\JavaProgaming\SIH Project 2
plugins: anyio-4.14.1, langsmith-0.10.11
collected 67 items

tests\advisory\test_advisory_v2.py ......                                [  8%]
tests\advisory\test_rule_engine.py .....                                 [ 16%]
tests\api\test_endpoints.py ..............                               [ 37%]
tests\api\test_ws_f_endpoints.py ...................                     [ 65%]
tests\data\test_loaders_and_config.py ....                               [ 71%]
tests\data\test_synthetic_integrity.py ...                               [ 76%]
tests\e2e\test_playwright_e2e.py ....                                    [ 82%]
tests\geospatial\test_geospatial.py ....                                 [ 88%]
tests\ml\test_evaluation.py ....                                         [ 94%]
tests\ml\test_ml_v2.py ....                                              [100%]

============================= 67 passed in 53.55s =============================
```

### 2. Multi-Region Model Loader & Version Parity Log
```powershell
python -c "from ml.inference.serve import load_models; load_models()"
```
**Raw Output:**
```text
2026-09-29 08:33:34,984 [INFO] Initializing KrishiMitra multi-region ML models...
2026-09-29 08:33:48,273 [INFO] Loaded temperature_max model for region 'ka-tumakuru' (env parity: OK)
2026-09-29 08:33:48,302 [INFO] Loaded temperature_min model for region 'ka-tumakuru' (env parity: OK)
2026-09-29 08:33:48,334 [INFO] Loaded rainfall model for region 'ka-tumakuru' (env parity: OK)
2026-09-29 08:33:48,360 [INFO] Loaded temperature_max model for region 'mh-ratnagiri' (env parity: OK)
2026-09-29 08:33:48,386 [INFO] Loaded temperature_min model for region 'mh-ratnagiri' (env parity: OK)
2026-09-29 08:33:48,413 [INFO] Loaded rainfall model for region 'mh-ratnagiri' (env parity: OK)
2026-09-29 08:33:48,483 [INFO] Loaded temperature_max model for region 'pb-ludhiana' (env parity: OK)
2026-09-29 08:33:48,508 [INFO] Loaded temperature_min model for region 'pb-ludhiana' (env parity: OK)
2026-09-29 08:33:48,538 [INFO] Loaded rainfall model for region 'pb-ludhiana' (env parity: OK)
2026-09-29 08:33:48,566 [INFO] Loaded temperature_max model for region 'rj-jodhpur' (env parity: OK)
2026-09-29 08:33:48,592 [INFO] Loaded temperature_min model for region 'rj-jodhpur' (env parity: OK)
2026-09-29 08:33:48,621 [INFO] Loaded rainfall model for region 'rj-jodhpur' (env parity: OK)
2026-09-29 08:33:48,622 [INFO] KrishiMitra model loader finished: 12 models active across 4 regions.
```

### 3. Captured Screenshots (`docs/screenshots/`):
- `map_farmer_desktop.png`: Farmer persona showing headline, 5-day strip, and explainability.
- `map_officer_desktop.png`: Officer persona showing tabular multi-panchayat overview and alert status.
- `insights_desktop.png`: Complete 9-chart analytics dashboard with KPI row.
- `advisories_desktop.png`: Detailed crop and stage advisories.
- `compare_desktop.png`: Multi-location small-multiples comparison tool.
- `method_desktop.png`: Full methodology, data provenance table, and limitation disclosures.
- `bulletin_desktop.png`: High-contrast printable farmer bulletin for field distribution.
- `map_farmer_kannada.png` & `map_farmer_marathi.png`: Localized Indic language interfaces.
- `map_farmer_mobile.png`: Responsive 360px viewport view.

### 4. Docker Environment Status Check
```text
NOT VERIFIED — Docker CLI is not installed on this host machine ('docker' command not recognized).
All builds, ML pipelines, tests, and headless Playwright runs were validated directly on the host using native runtimes.
Exact commands for user to run inside Docker:
docker compose -f docker/docker-compose.yml down -v
docker compose -f docker/docker-compose.yml build --no-cache
docker compose -f docker/docker-compose.yml up -d
docker compose -f docker/docker-compose.yml ps
docker compose -f docker/docker-compose.yml logs seed --tail 50
docker compose -f docker/docker-compose.yml logs backend --tail 50
docker stats --no-stream
```

---

## What is Real / What is Synthetic / What is NOT Verified

### 1. Data Provenance by Region
| Region | Boundary Outline | Sub-District Units | Topography / Elevation | Weather / Forecasts | Attributions & Citations |
|---|---|---|---|---|---|
| **ka-tumakuru** | **REAL** | Illustrative (Voronoi) | Calibrated Synthetic | Calibrated Synthetic | geoBoundaries ADM2, NASA POWER / IMD Karnataka Normals |
| **mh-ratnagiri** | **REAL** | Illustrative (Voronoi) | Calibrated Synthetic | Calibrated Synthetic | geoBoundaries ADM2, IMD Western Ghats Precipitation Profile |
| **pb-ludhiana** | **REAL** | Illustrative (Voronoi) | Calibrated Synthetic | Calibrated Synthetic | geoBoundaries ADM2, PAU Agrometeorology / IMD Punjab Profile |
| **rj-jodhpur** | **REAL** | Illustrative (Voronoi) | Calibrated Synthetic | Calibrated Synthetic | geoBoundaries ADM2, CAZRI Jodhpur Climatology Normals |

### 2. Operational Caveat Invariant
- **Synthetic-World Result:** All ML skill metrics, hurdle improvements, and uncertainty calibration numbers reflect model performance within our physics-shaped synthetic environment where static topographic rasters act as predictors. These numbers must not be claimed as real-world accuracy against physical AWS weather stations.
- **Sub-District Polygons:** Sub-district panchayat and block boundaries are generated via seeded Voronoi partitions clipped to the official district boundary, as open cadastral boundaries are unavailable.
- **Advisory Guardrail:** Advisory thresholds are illustrative templates. Live agricultural operations require local validation with Krishi Vigyan Kendras (KVKs).

### 3. Items Marked NOT VERIFIED
- **Docker Compose Container Execution:** NOT VERIFIED on host because Docker CLI is not installed on this specific machine. Docker configuration files, multi-stage Dockerfiles, Nginx Alpine proxies, and seed scripts were constructed strictly to specification and validated structurally. The user can execute the exact compose commands listed above in any environment with Docker Desktop installed.

