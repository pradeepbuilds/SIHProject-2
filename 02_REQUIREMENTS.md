# 02 — Requirements

## 1. Functional requirements

| ID | Requirement |
|---|---|
| FR-1 | Ingest Block-level coarse weather forecast data (rainfall, temp max/min, humidity, wind) on a daily cadence |
| FR-2 | Ingest/refresh static high-resolution geospatial features (DEM, land cover, NDVI/NDWI, soil, water bodies) on a periodic (not daily) cadence appropriate to their real update frequency |
| FR-3 | Store historical observed weather for validation/training wherever available |
| FR-4 | Generate panchayat-level (or grid-cell) downscaled predictions from block forecasts + static features |
| FR-5 | Attach an `uncertainty_label`/`uncertainty_interval` to every downscaled prediction (never a fabricated confidence %) |
| FR-6 | Apply a rule-based advisory engine to downscaled predictions + crop/soil context |
| FR-7 | Expose REST APIs for locations, forecasts, predictions, advisories, model info/metrics |
| FR-8 | Provide a map-based dashboard: district → block → panchayat drill-down, variable selector, time slider, coarse-vs-downscaled comparison, uncertainty layer, advisory panel |
| FR-9 | Tag every displayed/served data point with `data_source_tag` (OBSERVED / FORECAST / BASELINE / ML_DOWNSCALED) and an independent `is_synthetic` flag |
| FR-10 | Support onboarding additional districts without code changes (config/data-driven scaling) |

## 2. Non-functional requirements

| ID | Requirement | Notes |
|---|---|---|
| NFR-1 | Explainability | Prefer models whose feature contribution can be inspected (tree-based feature importance / SHAP) over opaque deep nets, given the SIH prototype timeline and jury explainability expectations |
| NFR-2 | Reproducibility | Every model version records training data window, feature schema, and validation metrics |
| NFR-3 | Scalability | Architecture must scale from 1 pilot district to multi-district/state by adding data, not redesigning services |
| NFR-4 | Low-bandwidth usability | Dashboard must remain usable on constrained rural connectivity (lightweight map tiles, pagination, no unnecessary large payloads) |
| NFR-5 | Data honesty | No interpolated/predicted value is ever labeled as an observation |
| NFR-6 | Security | Public read endpoints need no auth; write/train endpoints require a role check. For the MVP this is a **dev-only role check** (a header/user-record role compared against an allow-list — not a real auth system), explicitly not production-hardened; a real JWT/session-based auth system is out of scope for the MVP and documented as phase-2 hardening. See `05_SYSTEM_ARCHITECTURE.md` §Auth and `08_API_AND_DATABASE.md` §1 |
| NFR-7 | Availability of demo | System must run fully offline/local for the SIH demo (no dependency on live internet APIs being reachable during judging). **One explicit, documented exception:** Leaflet basemap tile imagery (raster tiles from OpenStreetMap) requires internet on first paint — see `05_SYSTEM_ARCHITECTURE.md` §7 and `11_AGENT_BUILD_PLAN.md` Rule 4 for the required graceful-degradation behaviour when tiles are unreachable. No other component may depend on a live network call. |
| NFR-8 | Minimum judging-machine spec | `docker compose up` must be documented as requiring **≥8 GB RAM and 4 CPU cores** (Postgres+PostGIS, FastAPI with LightGBM loaded in-process, and a Vite dev server running concurrently). Below this, containers may OOM or start slowly; this must be stated in the README so a constrained judging laptop is a known risk, not a surprise. |

## 3. Constraints

- Timeline: SIH hackathon build cycle (weeks, not months) → MVP scope only (Section 00 §2–3).
- Team: assumed a typical SIH student team (mixed web + ML + GIS skill, no dedicated DevOps/MLOps engineer) → favours managed/simple infra (Docker Compose, not Kubernetes).
- Data: only **verified, accessible** datasets are used (Section 03); anything not verifiable by the time of building is explicitly logged as a TODO, never silently assumed.
- Compute: no assumption of GPU availability → default model choice must run acceptably on CPU.

## 4. Out-of-scope for the prototype (explicitly)

- Individual farm-plot-level prediction (no public plot-boundary dataset at scale).
- Real-time/sub-hourly forecast updates.
- Multilingual/voice advisory delivery (documented as a future extension in `10_...md`).
- Full national coverage.

## 5. Actors

See `06_WORKFLOW_AND_USE_CASES.md` for the full actor/use-case model.
