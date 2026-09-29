# 05 — System Architecture & Technology Stack

## 1. Modular architecture (components)

| Layer | Responsibility | Key modules |
|---|---|---|
| Data Sources | External feeds (Section 03) | IMD forecast, ERA5-Land/NASA POWER, DEM, LULC, NDVI/NDWI, soil, LGD, AWS obs |
| Data Ingestion | Scheduled pull/download, format normalisation | `ingestion/` scripts, cron/Airflow-lite scheduler |
| Data Storage | Durable, queryable storage | PostgreSQL/PostGIS (tabular+vector), Parquet/GeoParquet + object storage (bulk raster-derived + historical) |
| Geospatial Processing | Reprojection, spatial join, zonal statistics | GeoPandas, Rasterio, Shapely, rioxarray |
| Feature Engineering | Build the model-ready feature table | `ml/features/` |
| ML Training Pipeline | Train, validate, tune, export models | `ml/training/` |
| Model Registry/Storage | Versioned model artifacts + metadata | Local/objectstore `models/` dir + `ModelVersion` DB table |
| Baseline Module | Compute the mandatory Block Replication Baseline (block forecast copied to every panchayat), and the optional secondary IDW baseline across neighbouring blocks where applicable | `ml/models/baseline_block_replication.py`, `ml/models/baseline_idw_secondary.py` — always run and stored, so every ML prediction has a baseline to compare against |
| Inference Engine | Load ML model, score new feature vectors | `ml/inference/` served via FastAPI |
| Uncertainty Engine | Quantile/ensemble interval computation | Part of inference engine, distinct output fields |
| Advisory Engine | Rule-based mapping of predictions+crop context → advisory | `advisory/` — deliberately **separate module**, not inside the ML service |
| Backend APIs | REST contract for frontend/external consumers | FastAPI app (`backend/`) |
| Authentication | Only where required (write/train endpoints) | **Dev-only role check for the MVP** — a `role` column on `User` (admin/officer/public) compared against an allow-list per endpoint, no token issuance/verification; not a production auth system. A real JWT/session-based system is explicit phase-2 hardening, not built for the MVP |
| Database | Relational + spatial store | PostgreSQL + PostGIS extension |
| GIS/Map service | Serve boundaries/grids/prediction layers to the map | Backend GeoJSON endpoints + Leaflet/MapLibre client rendering (no separate heavyweight map server needed at pilot scale) |
| Frontend Dashboard | Visualisation & interaction | React + TypeScript SPA |
| Monitoring/Logging | Operational visibility | Structured logs + a simple metrics/health endpoint; heavier stacks (Prometheus/Grafana) deferred to "Future Stack" |

```
Frontend (React/Leaflet)  <--REST/JSON-->  Backend API (FastAPI)
                                                 |
                  +----------------+-------------+-------------+------------------------+
                  |                |             |             |                        |
           Baseline Module   Inference Engine  Uncertainty  Advisory Engine        Data/Query layer
           (block replication  (loads ML       Engine       (rule engine,          (PostGIS + Parquet)
            [+ optional IDW])   models)                      separate)                    |
                  |                |             |             |                          |
                  +--------+-------+             |             |                   Ingestion pipeline
                           |                      |             |                   (scheduled jobs, §03)
                    Model Registry ---------------+             |
                    (baselines AND ML models,                   |
                     both versioned artifacts)                  |
                           |                                     |
                    PANCHAYAT FORECAST (baseline + ML side by side) --> UNCERTAINTY --> ADVISORY
```

The Baseline Module and the Inference Engine run **in parallel** on the same feature input and
both write to the Model Registry / prediction tables — the point of the whole system is that a
panchayat-level record always carries both a baseline value and an ML value side by side, so the
improvement (or lack of it) is always inspectable, never asserted.

## 2. Why this differs from a naive "one big pipeline" design

The advisory engine is **structurally separated** from the ML inference engine (own module,
own tests, own versioned rule-set) because weather prediction and agronomic advice are
different responsibilities with different failure modes and different domain expertise behind
them (Rule 4/Section 12 of the brief). This also means the advisory rules can be updated by an
agricultural domain expert without touching or re-validating the ML model.

## 3. Technology decision matrix

| Choice | Alternative | Reason for selection | Advantages | Limitations |
|---|---|---|---|---|
| React (Vite/CRA) | Next.js | No SSR/SEO requirement for an internal dashboard; simpler build/deploy for a student team | Smaller learning curve, faster dev iteration | Next.js would offer easier routing/SSR if the app grows public-facing pages later |
| Leaflet | MapLibre GL | Leaflet has the lowest-friction learning curve and works well with vector/GeoJSON layers of pilot-district size | Simple API, huge plugin ecosystem, light weight (NFR-4 low-bandwidth) | MapLibre gives smoother vector-tile rendering at national scale — worth revisiting if the app scales to many districts |
| FastAPI | Node.js/Express | ML/GIS libraries (scikit-learn, GeoPandas, rasterio) are Python-native; using the same language backend-to-ML avoids a cross-language serving boundary | Native Pydantic validation, auto-generated OpenAPI docs, async support | Node.js may integrate more naturally if the team is JS-heavy, but then ML inference needs a separate service anyway |
| PostgreSQL + PostGIS | MongoDB | The core entities (Panchayat, GridCell, boundaries) are inherently geometric; PostGIS gives native spatial indexing, `ST_Within`/`ST_Intersects` joins, and spatial aggregation that a document store would require reimplementing in application code | Mature GIS spatial query support, ACID guarantees, one database for tabular+spatial | Slightly heavier ops than Mongo for a pure-document workload — not the case here since data is inherently relational+spatial |
| Scikit-learn / LightGBM | PyTorch | Selected model family (Section 04) is tabular tree ensembles; no need for a deep-learning framework at MVP stage | Simpler dependency footprint, CPU-friendly | PyTorch would be reintroduced only if/when CNN/ConvLSTM extensions are built |
| LightGBM (MVP default) | Random Forest (internal sanity check) / XGBoost (future phase-2 comparison) | Marginally better accuracy and native quantile-loss support (needed for uncertainty, Section 04 §3) at similar explainability and compute cost | Faster inference, built-in regularisation | RF is simpler to reason about for a first cut / sanity baseline — kept as an internal comparison point, not discarded; XGBoost is deliberately not built in parallel for the MVP (Section 04 §2) |
| GeoParquet/Parquet | CSV | Columnar, compressed, much faster for the bulk historical/derived-raster feature tables that don't need transactional writes | 5-10x smaller/faster than CSV at scale, keeps geometry when needed (GeoParquet) | Less human-readable for quick manual inspection — CSV export kept available for debugging |
| Docker + Docker Compose | Direct/bare-metal deployment | Reproducible environment across team laptops and the demo machine; avoids "works on my machine" during judging | One-command `docker compose up`, isolates Postgres/PostGIS version | Kubernetes is unnecessary operational overhead at pilot scale — deferred to "Future Stack" |

## 4. Final stack

**Core stack (build this):**
Frontend: React + TypeScript + Vite + Tailwind CSS + Leaflet + Recharts.
Backend: Python + FastAPI + Pydantic.
ML: NumPy, Pandas, scikit-learn, LightGBM (primary; XGBoost reserved for future phase-2 comparison), joblib model export.
Geospatial: GeoPandas, Shapely, Rasterio, rioxarray, GDAL (as needed by the above).
Database: PostgreSQL + PostGIS.
Storage: local filesystem/object storage for rasters and Parquet/GeoParquet historical tables.
DevOps: Git/GitHub, Docker, Docker Compose.

**Optional stack (only if time permits):**
MapLibre GL (if vector-tile performance becomes an issue at multi-district scale), ONNX export
(for cross-language inference portability), Playwright (frontend E2E tests), conformal
prediction library for uncertainty hardening.

**Future stack (explicitly deferred, not to be built now):**
PyTorch + CNN/U-Net/ConvLSTM for grid-to-grid downscaling once multi-district training data
exists; Kubernetes/Helm for multi-tenant cloud deployment; Kafka/streaming ingestion if IMD
ever exposes a push-based feed; Prometheus/Grafana for production-grade monitoring;
GNN framework (e.g., PyTorch Geometric) if panchayat-adjacency modelling is revisited.

## 5. Why PostGIS specifically over a plain relational DB

Panchayats, grid cells, and boundaries are geometries that must support "which panchayat
contains this point," "which panchayats are within this block," and "nearest water body"
queries. PostGIS provides these as indexed native SQL operations (`ST_Contains`,
`ST_DWithin`, GiST spatial indexes); doing the same in plain PostgreSQL/MySQL would mean
re-implementing spatial predicates in application code with no index support — infeasible at
even pilot-district row counts once grid cells are introduced (a 1 km grid over one district
can easily be several thousand cells).

## 6. §Auth — authentication & rate limiting (referenced from `02_REQUIREMENTS.md` NFR-6, `08_API_AND_DATABASE.md` §1)

The MVP deliberately does **not** build a real JWT/session auth system (out of scope, see NFR-6).
Two distinct, lightweight mechanisms cover the two auth-tagged endpoint groups:

- **`POST /prediction` — "API key (rate-limited)"**: a single static demo key, generated once at
  build time and written to `.env` as `DEMO_API_KEY` (also printed to stdout on first
  `docker compose up` so a judge/team can find it without reading source). Sent as an
  `X-API-Key` header. Rate limit: **60 requests/minute per key**, enforced in-process with
  `slowapi` (no Redis dependency needed at pilot scale — an in-memory limiter is sufficient for
  a single-instance demo deployment). Missing or invalid key → `401` with body
  `{"error": {"code": "invalid_api_key", "message": "..."}}`. Over the rate limit → `429` with a
  `Retry-After` header. There is no key-issuance workflow beyond the one build-time key — a real
  multi-tenant key system is explicitly phase-2 scope.
- **Admin routes — "dev-only role allow-list"**: a request header (e.g. `X-User-Role`) is
  compared against a hardcoded allow-list (`["admin", "ml_engineer"]`) read from an env var.
  This is **not** authentication (no identity verification), only a coarse capability gate to
  stop the public dashboard from accidentally exposing `POST /model/train`. Missing/disallowed
  role → `401`. Documented explicitly as not production-hardened (NFR-6).

## 7. Offline requirement vs. Leaflet basemap tiles (reconciles NFR-7)

Leaflet's default raster tile layer (OpenStreetMap) is fetched live over the internet and is the
**one explicitly permitted exception** to the "fully offline" requirement (NFR-7). This is
reconciled as follows, not left implicit:

- The frontend must **not** crash, blank-screen, or hang if tile requests fail. Vector layers
  (panchayat/block boundaries, prediction/uncertainty overlays served from `/map/layer`) are
  drawn as GeoJSON on top of the tile layer and must render correctly even if the tile layer
  itself never loads — i.e., the substantive content of the demo (predictions, drill-down,
  uncertainty) works with a plain gray/white background if the judging machine is air-gapped.
- This is a graceful-degradation requirement, not a "must render actual basemap imagery
  offline" requirement — bundling an offline tile set (MBTiles + a local tile server such as
  `tileserver-gl`, clipped to the Tumakuru pilot district bounding box) is listed as an
  **optional stack** item (§4) a team can add if time permits, not a Phase acceptance blocker.
- If offline basemap imagery is added later, it swaps in as an additional Leaflet tile source
  pointed at `http://localhost:<tileserver_port>/{z}/{x}/{y}.png` — no change to any other layer.
