# 11 — Agent Build Plan (start here to build)

> **Purpose of this file:** Documents 00–10 are the reasoned blueprint (why each decision was
> made). This file is the **execution plan** — every open question in 00–10 is resolved here
> into one concrete default so a coding agent can build end-to-end without stopping to ask the
> user anything. Where the blueprint said "confirm with X before build," this file instead says
> "assume Y, behind an interface that swaps to X later." That is a deliberate, stated
> engineering choice (Rule: never fabricate a *dataset*; a clearly-labeled *synthetic* dataset
> behind a real interface is not fabrication — it is a documented stand-in, see §2).

## 0. Non-negotiable rules for the agent

1. Build phases **in order** (§5). Do not skip to the dashboard before the data layer exists.
2. Every value the UI/API shows must carry two independent fields: `data_source_tag` ∈
   {`OBSERVED`, `FORECAST`, `BASELINE`, `ML_DOWNSCALED`} and `is_synthetic` (boolean). These are
   never combined into one field or inferred from each other — a value's provenance
   (`data_source_tag`) and whether it came from the synthetic generator (`is_synthetic`) are
   separate questions with separate answers (§6 DDL). **If a value's provenance is genuinely
   unknown or ambiguous, the agent must not silently assign it a `data_source_tag`.** Instead,
   the record is flagged invalid/unknown (e.g. a `provenance_status = 'unresolved'` marker and a
   logged error) and surfaced for explicit resolution — never guessed, and never defaulted to
   `ML_DOWNSCALED` or any other tag.
3. **No accuracy numbers in any UI, doc, or slide until Phase 6 actually runs.** Metrics
   fields exist in the schema before Phase 6 but display as `null` / "not yet evaluated" —
   never a manually entered or illustrative number presented as if it were a real result.
4. The whole stack must run with **one command** (`docker compose up`) and **zero external
   network calls**, with exactly **one documented exception: Leaflet basemap tile imagery**,
   which is fetched live from OpenStreetMap and requires internet on first paint (see
   `05_SYSTEM_ARCHITECTURE.md` §7). Synthetic data ships in the repo (§2), so every other part
   of the demo — predictions, drill-down, uncertainty, advisories — works fully offline/on a
   judging machine with no internet; the map must still render its vector layers (boundaries,
   prediction overlays) on a blank background if tiles fail to load, rather than crashing or
   blank-screening the whole dashboard.
5. If a step in this plan turns out to be impossible with the tools available, the agent
   implements the closest working equivalent, states the substitution in `docs/DEVIATIONS.md`
   (create this file the first time it's needed), and continues — it does not stop and wait.

## 1. Decisions that resolve every "TODO before build" from docs 00–10

| Open question in 00–10 | Resolved decision for this build |
|---|---|
| Which pilot district? | **Tumakuru district, Karnataka** (Bhuvan Panchayat product has confirmed Karnataka coverage per `03`, §7.5). If a coding agent later finds actual boundary files are unavailable even for Tumakuru, fall back to a **synthetic block/panchayat layer** (§2.3) for the same district name — the pipeline code is identical either way. |
| BharatFS/IMD block-forecast API access unconfirmed | Build against a `CoarseForecastProvider` interface (§3.1) with two implementations: `SyntheticForecastProvider` (default, ships with the repo) and `IMDForecastProvider` (stub with `NotImplementedError` and a docstring listing what's needed — endpoint, auth — so it's a one-file swap later; see `03`, §7.1 and §2 for exactly what's unverified). |
| Panchayat-polygon availability unconfirmed nationally | Ship a **synthetic panchayat polygon layer** for the pilot district (§2.3): a Voronoi/grid-based partition of the block into N synthetic panchayats with plausible names. Clearly labeled `is_synthetic_boundary: true` in the `Panchayat` table. Real boundaries are a drop-in replacement (same schema). |
| AWS/rain-gauge ground truth access unconfirmed | Ship a **synthetic ground-observation generator** (§2.4) that produces physically-plausible station data (elevation-adjusted temperature, spatially-correlated rainfall) for training/evaluation, clearly tagged `is_synthetic: true` in `WeatherObservation`. |
| Real-time IMD API / Bhuvan MOU / GEE account, etc. | Not required to build or demo the prototype. All static features (§2.2) are generated synthetically but structurally identical to the real product schemas in `03`, so swapping in real DEM/LULC/NDVI rasters later requires no code change, only a data-loader config change. |
| "Which model beats baseline" | Not decided in advance — Phase 5/6 actually trains and reports both, honestly, per `04`. |

**Explicit labeling requirement:** every synthetic-data code path must set a boolean
`is_synthetic` (or `is_synthetic_boundary`) flag on the record and the API must expose it. The
dashboard shows a persistent banner: *"Demo running on synthetic data — see docs/DEVIATIONS.md
for what to replace before production."* This satisfies Rule 1 (no fabricated dataset
presented as real) while still producing a fully working, demoable system.

## 2. Synthetic data generator (`ml/synthetic/`) — build this first, right after Phase 0

This is what makes the prototype actually run without any external account, API key, or
network access. It replaces Section 03's live sources with **structurally identical, clearly
labeled fake data**, generated once and committed to `ml/data/synthetic/` (small pilot-district
volumes only, a few MB).

### 2.1 Administrative hierarchy
- 1 district ("Tumakuru"), containing **10 synthetic blocks**, each containing **8–15
  synthetic panchayats** (random within that range, seeded RNG for reproducibility).
- Each panchayat gets a synthetic centroid (lat/long) placed within its block's bounding box
  and a synthetic polygon (Voronoi cell of block, clipped to block boundary using Shapely).
- Block boundary itself: a simple synthetic polygon grid (e.g., a 4×3 arrangement of
  irregular quadrilaterals covering a ~4,000 km² area) — not a real GIS file, explicitly
  labeled as such in a `README` inside `ml/data/synthetic/`.

### 2.2 Static features (per panchayat / grid cell)
Generate with a fixed random seed so results are reproducible:
- `elevation`: base elevation (e.g., 700 m for the district) + smooth spatial noise (Perlin/
  simplex noise via `noise` or a simple Gaussian-process-like smoothing over the grid) so
  neighbouring cells are correlated, not IID noise.
- `slope`, `aspect`: derived from the synthetic elevation surface (finite-difference gradient).
- `land_cover_class`: sampled from {`forest`, `cropland`, `built-up`, `barren`, `water`} with
  spatially clustered assignment (not per-cell independent — use a simple region-growing or
  Gaussian-blur-then-threshold approach so patches are contiguous).
- `ndvi`, `ndwi`: correlated with `land_cover_class` (e.g., forest → NDVI ~0.6–0.8, built-up →
  ~0.1–0.2) plus small seasonal sinusoidal variation by month.
- `soil_texture_class`: sampled from {`sandy`, `loam`, `clay`, `silt`} similarly clustered.
- `distance_to_water_km`: computed from a small number of synthetic water-body point/line
  features placed on the map, via actual GIS distance calculation (this part uses real
  Shapely/GeoPandas logic — only the *input* water bodies are synthetic).

### 2.3 Panchayat/grid-cell spatial layer
- Build the **1 km regular grid** (per `07`, §2) by real GeoPandas grid generation clipped to
  the synthetic block polygons — this is real code, operating on synthetic boundary input, and
  is exactly the code that will run unchanged on real boundary input later.

### 2.4 Historical weather (for training + evaluation)
- Generate **2 synthetic years of daily station-like observations** per panchayat:
  `temperature_max/min` as a seasonal sinusoid (Northern-hemisphere monsoon-climate shape)
  adjusted by `-6.5 °C/km × elevation_km` (real lapse-rate physics) plus autocorrelated daily
  noise; `rainfall` as a monsoon-season-weighted stochastic process (near-zero outside
  Jun–Sep, gamma-distributed positive values with spatial correlation across nearby cells
  during monsoon) further modulated by NDVI/land-cover (forested/high-NDVI cells get a small
  positive rainfall bias, reflecting real orographic/vegetation-feedback literature;
  documented as a modelling *assumption*, not a claimed real effect); `humidity` correlated
  with rainfall recency and distance-to-water.
- Generate a **coarse "block forecast"** by spatially averaging the synthetic panchayat-level
  truth up to block level, **then perturbing** with (a) a systematic block-level bias term and
  (b) forecast-horizon-dependent noise (larger error at +5 days than +1 day) — this
  reproduces the actual statistical property the whole project exists to correct: the coarse
  value is a smoothed, biased, noisier version of local truth, not local truth itself.
  **The supported horizon for the shipped synthetic/demo path is hardcoded to 1–5 days
  inclusive** (`horizon_days ∈ [1, 5]`) — this is what `08_API_AND_DATABASE.md`'s "`date` must be
  within the model's supported horizon (422 otherwise)" resolves to concretely. BharatFS/IMD's
  real published horizon is unconfirmed (`03` §7.1) and remains an explicit phase-2 TBD; it does
  not block this demo since the synthetic generator, training data, and API validation all agree
  on 1–5 days.
- All of this is written by a deterministic, seeded script (`ml/synthetic/generate.py`) so
  re-running it reproduces the same demo dataset; this script **is** the "dataset" — commit
  its output, not just the script, so the repo runs without a generation step.

### 2.5 What this achieves, and what it does not license
- The ML pipeline (Phases 4–6) has real signal to learn: local temperature genuinely depends
  on elevation/NDVI/land-cover in a way the block average doesn't capture, by construction. This
  means an ML model has a genuine, physically-grounded opportunity to beat the **Block
  Replication Baseline** (§0-equivalent in `04_ML_DOWNSCALING_APPROACH.md`) on this synthetic
  data — it does **not** mean the generator is designed to guarantee that outcome regardless of
  model quality.
- Evaluation on synthetic data must still be run and reported **honestly** (per
  `04_ML_DOWNSCALING_APPROACH.md` §6 and the project's core rule against fabricated results). If
  the ML model does not beat the Block Replication Baseline on synthetic data, the correct
  response is to **investigate**, in this order: (1) the model/features (is the feature table
  actually wired up correctly, is the model undertrained), (2) the evaluation split (is spatial
  leakage or a bug inflating the baseline), and only then (3) whether the generator's
  signal-to-noise ratio is unrealistically low. The generator must **not** be iteratively
  tweaked "until the model wins" — that would silently manufacture the very engineering acceptance
  criterion (§2.6 below) it is supposed to test honestly.
- Every other phase (API, dashboard, advisory engine, tests) operates on this data through the
  exact same interfaces real data would use.

### 2.6 Synthetic data acceptance criteria — three distinct categories

Keep these separate; do not let success on one substitute for another:

| Category | What it checks | Example checks |
|---|---|---|
| **Engineering acceptance** | The software pipeline runs end-to-end | Synthetic data generated successfully; database populated with 0 orphaned FKs; model trains without error; API responds with the documented schema; dashboard renders |
| **Scientific acceptance (synthetic only)** | The model recovers a *known* synthetic spatial signal | Model beats the Block Replication Baseline on the synthetic spatial holdout for temperature (rainfall following once temperature is validated, per §5); error metrics computed and reported, whichever way they land |
| **Real-world acceptance** | Whether the approach actually works in reality | **Can only be established with real observations** (Phase 2 real-data track — see `10_TESTING_DEPLOYMENT_AND_PPT.md` §9). Passing engineering + scientific(synthetic) acceptance is a necessary precondition for attempting this, never a substitute for it. |

The SIH demo needs engineering acceptance (always) and scientific(synthetic) acceptance
(expected, and investigated per §2.5 if it doesn't hold) — it explicitly does **not** claim
real-world acceptance, and every demo/PPT slide referencing model performance must make clear
which of these three it is reporting.

## 3. Interfaces the agent must define before writing pipeline code

### 3.1 `CoarseForecastProvider` (Python `Protocol`/ABC)
```python
class CoarseForecastProvider(ABC):
    @abstractmethod
    def get_block_forecast(self, block_id: str, issue_date: date, horizon_days: int) -> list[ForecastRecord]:
        ...
```
- `SyntheticForecastProvider`: reads from `ml/data/synthetic/block_forecasts.parquet`.
- `IMDForecastProvider`: stub raising `NotImplementedError("Requires verified BharatFS/IMD
  data-access credentials — access mechanism not yet confirmed, see
  03_DATASET_AND_DATA_PIPELINE.md §7.1 and §2")`.
- Selected via an environment variable `FORECAST_PROVIDER=synthetic|bharatfs` (default `synthetic`).

### 3.2 `StaticFeatureProvider`, `GroundObservationProvider`
Same pattern: one synthetic implementation that ships and works, one real stub that documents
what's needed. Both selected via env vars with `synthetic` as the default so `docker compose
up` works with no configuration.

`StaticFeatureProvider`'s real implementation (`GEEFeatureProvider`, `FEATURE_PROVIDER=gee`) is
a stub, same pattern as `IMDForecastProvider`, but with its auth/quota specifics named explicitly
rather than left generic, since GEE is the concrete real-data path for DEM/Sentinel-2/LULC (`03`
§7.3–7.4):
```python
class GEEFeatureProvider(StaticFeatureProvider):
    """Requires a Google Earth Engine service-account JSON key (NOT interactive user OAuth —
    a service account is required for unattended backend use). Path is read from the
    GOOGLE_APPLICATION_CREDENTIALS env var and the key is initialized once via
    ee.Initialize(credentials) at provider construction, not per-request.

    Quota: Earth Engine's free/Community tier allows 150 EECU-hours/month (see
    03_DATASET_AND_DATA_PIPELINE.md). If a call raises ee.EEException matching a quota/rate-limit
    error, this provider must NOT crash the pipeline run: it logs a structured warning
    (`gee_quota_exhausted`, with the feature/date that failed), returns the last successfully
    cached value for that location/feature if one exists in `ml/data/cache/gee/`, and otherwise
    falls back to the synthetic value for that feature — never silently returns a null/zero that
    looks like a valid reading. This fallback is itself tagged (is_synthetic=true or
    'stale_cache') so it is never confused with a fresh real observation.
    """
    raise NotImplementedError("Requires a GEE service-account key — see docstring above and "
                               "03_DATASET_AND_DATA_PIPELINE.md §7.3-7.4")
```

### 3.3 `POST /prediction` input validation (arbitrary lat/long)

Unlike `GET /prediction/{location_id}` (which is keyed to a known panchayat/grid cell and 404s
on an unknown one), `POST /prediction` accepts a free-form `{lat, lon}` — this must not be able
to silently return a confident-looking prediction for a point nowhere near Tumakuru. Concrete
rule the agent implements:

1. Reject early with `400 {"error": {"code": "outside_pilot_area", "message": "...", "pilot_bbox": [...]}}`
   if `(lat, lon)` falls outside `PILOT_DISTRICT_BBOX` (env var, §7 above) — a cheap bounding-box
   check before touching the model or DB.
2. If inside the bbox but not exactly on a `GridCell` centroid, **snap to the nearest `GridCell`
   via `ST_Distance`/`ST_ClosestPoint`** (PostGIS) and run inference for that cell — the response
   must include the snapped `grid_cell_id` and its centroid distance in meters so the client can
   show "showing nearest available cell, Xm away" rather than implying pinpoint precision.
3. The model is never run on a location outside the training district's spatial extent — there
   is no interpolation/extrapolation path for out-of-bbox points, by design.

## 4. Exact directory tree (agent creates this verbatim; matches `07_TECHNICAL_IMPLEMENTATION.md` §6 with the synthetic module added)

```
weather-downscaling/
├── frontend/                       # React + TS + Vite + Tailwind + Leaflet + Recharts
├── backend/                        # FastAPI app
│   ├── main.py
│   ├── routers/                    # locations.py, forecast.py, prediction.py, advisory.py, model.py, map_layer.py
│   ├── schemas/                    # Pydantic models mirroring 08_API_AND_DATABASE.md
│   ├── services/
│   └── db/                         # SQLAlchemy models + Alembic migrations
├── ml/
│   ├── synthetic/generate.py       # §2 generator — run once at image build time, output committed
│   ├── data/synthetic/             # committed generator output (parquet/GeoParquet, a few MB)
│   ├── preprocessing/
│   ├── features/
│   ├── models/                     # baseline_block_replication.py, baseline_idw_secondary.py (optional),
│   │                                # temperature.py (build first), rainfall.py (build second), humidity.py (optional)
│   ├── training/train.py           # spatial split, quantile LightGBM, temperature before rainfall, exports to models/
│   ├── evaluation/evaluate.py      # MAE/RMSE/bias/R vs Block Replication Baseline (+ optional IDW secondary), writes model_metrics.json
│   └── inference/serve.py          # loaded by backend at startup
├── geospatial/                     # grid generation, spatial join helpers (real code, §2.3)
├── advisory/                       # rule_engine.py, rules.yaml (>=3 rule types, see 06 §Advisory)
├── database/                       # init.sql (DDL from §6 below), migrations/
├── tests/                          # pytest: unit, integration, API (TestClient), GIS
├── docker/
│   ├── docker-compose.yml          # §7 below
│   ├── backend.Dockerfile           # includes ml/ deps (LightGBM etc.) — inference runs in-process, no ml.Dockerfile
│   └── frontend.Dockerfile
├── docs/                           # this documentation set + DEVIATIONS.md (created if needed)
└── README.md
```

## 5. Build phases — file-level deliverables and pass/fail acceptance check per phase

| Phase | Deliverable files | Acceptance check (must be automatable, not "looks right") |
|---|---|---|
| 0 | `docker/docker-compose.yml`, `database/init.sql` (empty schema) | `docker compose up` starts postgres+postgis, backend, frontend containers without error; `GET /health` → 200 |
| 1 | `ml/synthetic/generate.py` + committed output in `ml/data/synthetic/` | Running the script twice with the same seed produces byte-identical output; row counts match §2 ranges |
| 2 | `database/init.sql` fully populated per §6 DDL; `backend/db/models.py` | `alembic upgrade head` succeeds; loading synthetic data into the DB via a one-off `scripts/load_synthetic.py` completes with 0 orphaned foreign keys |
| 3 | `geospatial/grid.py`, `ml/features/build_features.py` | Feature table row count == grid-cell count × date range; no nulls in required columns; spatial-join success rate == 100% on synthetic data (logged) |
| 4 | `ml/models/baseline_block_replication.py` (mandatory), `ml/models/baseline_idw_secondary.py` (optional, only if neighbouring-block values exist), `ml/evaluation/evaluate.py` (baseline run) | `model_metrics.json` contains Block Replication Baseline MAE/RMSE per variable, non-null |
| 5a | `ml/training/train.py` — **temperature model first**, exported `models/temperature*.joblib`, quantile outputs | Temperature spatial-holdout MAE/RMSE reported against the Block Replication Baseline and recorded in `model_metrics.json`, whichever way the comparison lands; if ML does not beat baseline, root-cause per §2.5 before proceeding to 5b |
| 5b | `ml/training/train.py` — **rainfall model second**, exported `models/rainfall*.joblib` | Rainfall spatial-holdout metrics (MAE/RMSE + rain-occurrence precision/recall/F1) reported against the Block Replication Baseline, only started once 5a is complete |
| 5c | Optional: humidity/wind models, same pipeline | Same reporting pattern, only if 5a and 5b are both complete and time remains |
| 6 | `ml/evaluation/evaluate.py` full report, `model_metrics.json` complete | Every metric documented in `07_TECHNICAL_IMPLEMENTATION.md` §4 is present in the JSON for temperature and rainfall (humidity/wind only if built) |
| 7 | `backend/routers/*.py` implementing every endpoint in §8 below | `pytest tests/api/` passes; every endpoint in `08_API_AND_DATABASE.md` §1 responds with the documented schema shape |
| 8 | `frontend/src/` — map, drill-down, layer toggle, uncertainty badge | `docker compose up`, open `localhost:5173`, District→Block→Panchayat drill-down works, coarse-vs-downscaled toggle changes the map layer |
| 9 | `advisory/rule_engine.py`, `advisory/rules.yaml` | At least 3 advisory types fire correctly against fixture inputs in `tests/advisory/` |
| 10 | full `docker-compose.yml` wiring all services | `docker compose up` (fresh clone, no manual steps) serves a working dashboard end-to-end |
| 11 | `tests/` full suite | `pytest` green; `npm test` (if frontend tests exist) green |
| 12 | `docs/DEVIATIONS.md`, demo walkthrough matches `10_TESTING_DEPLOYMENT_AND_PPT.md` §4 | Manual run-through of the 10-step demo script succeeds end-to-end |

## 6. Database DDL (concrete — implements the ER model in `08_API_AND_DATABASE.md` §2)

```sql
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE district (
    id            TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    state         TEXT NOT NULL,
    lgd_code      TEXT
);

CREATE TABLE block (
    id            TEXT PRIMARY KEY,
    district_id   TEXT NOT NULL REFERENCES district(id),
    name          TEXT NOT NULL,
    lgd_code      TEXT,
    geometry      GEOMETRY(Polygon, 4326)
);

CREATE TABLE panchayat (
    id                   TEXT PRIMARY KEY,
    block_id             TEXT NOT NULL REFERENCES block(id),
    name                 TEXT NOT NULL,
    lgd_code             TEXT,
    geometry             GEOMETRY(Polygon, 4326),  -- nullable
    is_synthetic_boundary BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE grid_cell (
    id            TEXT PRIMARY KEY,
    block_id      TEXT NOT NULL REFERENCES block(id),
    geometry      GEOMETRY(Polygon, 4326) NOT NULL,
    centroid      GEOMETRY(Point, 4326) NOT NULL
);

CREATE TABLE environmental_feature (
    id            SERIAL PRIMARY KEY,
    location_ref  TEXT NOT NULL,        -- panchayat.id or grid_cell.id
    feature_name  TEXT NOT NULL,
    value         DOUBLE PRECISION,
    valid_from    DATE,
    valid_to      DATE,
    is_synthetic  BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE weather_observation (
    id            SERIAL PRIMARY KEY,
    location_ref  TEXT NOT NULL,
    timestamp     TIMESTAMPTZ NOT NULL,
    variable      TEXT NOT NULL,
    value         DOUBLE PRECISION NOT NULL,
    source        TEXT NOT NULL,
    is_synthetic  BOOLEAN NOT NULL DEFAULT TRUE,   -- independent of data_source_tag: records whether this value came from the synthetic generator
    data_source_tag TEXT NOT NULL DEFAULT 'OBSERVED'
                  CHECK (data_source_tag IN ('OBSERVED', 'FORECAST', 'BASELINE', 'ML_DOWNSCALED'))
);

CREATE TABLE weather_forecast (
    id            SERIAL PRIMARY KEY,
    block_id      TEXT NOT NULL REFERENCES block(id),
    forecast_date DATE NOT NULL,
    target_date   DATE NOT NULL,
    horizon_days  INT NOT NULL,            -- lead time = target_date - forecast_date; first-class feature, not just metadata
    variable      TEXT NOT NULL,
    value         DOUBLE PRECISION NOT NULL,
    is_synthetic  BOOLEAN NOT NULL DEFAULT TRUE,
    data_source_tag TEXT NOT NULL DEFAULT 'FORECAST'
                  CHECK (data_source_tag IN ('OBSERVED', 'FORECAST', 'BASELINE', 'ML_DOWNSCALED'))
);

CREATE TABLE model_version (
    id                   TEXT PRIMARY KEY,
    variable             TEXT NOT NULL,
    model_type           TEXT NOT NULL CHECK (model_type IN
                             ('baseline_block_replication', 'baseline_idw_secondary',
                              'ml_lightgbm', 'ml_xgboost', 'ml_random_forest')),
    -- 'ml_lightgbm' is the only MVP model type the agent builds; 'ml_xgboost' and
    -- 'ml_random_forest' are reserved enum values for the phase-2/internal-sanity-check
    -- comparisons in 04_ML_DOWNSCALING_APPROACH.md §2, not parallel MVP deliverables
    training_window      TEXT NOT NULL,
    feature_schema_hash  TEXT NOT NULL,
    validation_metrics   JSONB,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE baseline_prediction (
    id               SERIAL PRIMARY KEY,
    location_ref     TEXT NOT NULL,
    forecast_date    DATE NOT NULL,
    target_date      DATE NOT NULL,
    horizon_days     INT NOT NULL,
    variable         TEXT NOT NULL,
    value            DOUBLE PRECISION NOT NULL,
    model_version_id TEXT NOT NULL REFERENCES model_version(id),  -- model_type = baseline_block_replication or baseline_idw_secondary
    is_synthetic     BOOLEAN NOT NULL DEFAULT TRUE,
    data_source_tag  TEXT NOT NULL DEFAULT 'BASELINE'             -- a baseline is a derived value but it is NOT a model prediction —
                     CHECK (data_source_tag = 'BASELINE')          -- never ML_DOWNSCALED; conflating the two would overstate what ML did
);

CREATE TABLE ml_prediction (
    id               SERIAL PRIMARY KEY,
    location_ref     TEXT NOT NULL,
    forecast_date    DATE NOT NULL,
    target_date      DATE NOT NULL,
    horizon_days     INT NOT NULL,
    variable         TEXT NOT NULL,
    value            DOUBLE PRECISION NOT NULL,
    model_version_id TEXT NOT NULL REFERENCES model_version(id),
    is_synthetic     BOOLEAN NOT NULL DEFAULT TRUE,
    data_source_tag  TEXT NOT NULL DEFAULT 'ML_DOWNSCALED'
                     CHECK (data_source_tag = 'ML_DOWNSCALED')
);

CREATE TABLE prediction_uncertainty (
    prediction_id     INT PRIMARY KEY REFERENCES ml_prediction(id),
    p10               DOUBLE PRECISION,
    p50               DOUBLE PRECISION,
    p90               DOUBLE PRECISION,
    uncertainty_label TEXT   -- "high"/"medium"/"low" derived from interval width; never a fabricated confidence %
);

CREATE TABLE crop (
    id    TEXT PRIMARY KEY,
    name  TEXT NOT NULL
);

CREATE TABLE crop_stage (
    id                  TEXT PRIMARY KEY,
    crop_id             TEXT NOT NULL REFERENCES crop(id),
    stage_name          TEXT NOT NULL,
    sensitive_thresholds JSONB
);

CREATE TABLE advisory (
    id               SERIAL PRIMARY KEY,
    location_ref     TEXT NOT NULL,
    crop_id          TEXT REFERENCES crop(id),
    crop_stage_id    TEXT REFERENCES crop_stage(id),
    rule_id          TEXT NOT NULL,
    message          TEXT NOT NULL,
    uncertainty_label TEXT,
    prediction_id    INT REFERENCES ml_prediction(id),
    issued_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE app_user (
    id    SERIAL PRIMARY KEY,
    role  TEXT NOT NULL CHECK (role IN ('admin', 'officer', 'public'))
);

CREATE INDEX idx_block_geom ON block USING GIST (geometry);
CREATE INDEX idx_panchayat_geom ON panchayat USING GIST (geometry);
CREATE INDEX idx_gridcell_geom ON grid_cell USING GIST (geometry);
CREATE INDEX idx_gridcell_centroid ON grid_cell USING GIST (centroid);
```

## 7. `docker-compose.yml` skeleton (agent fills in build contexts/env)

```yaml
services:
  postgres:
    image: postgis/postgis:16-3.4
    environment:
      POSTGRES_DB: weatherdb
      POSTGRES_USER: app
      POSTGRES_PASSWORD: app
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./database/init.sql:/docker-entrypoint-initdb.d/init.sql
    ports: ["5432:5432"]

  backend:
    build: { context: ., dockerfile: docker/backend.Dockerfile }
    environment:
      DATABASE_URL: postgresql://app:app@postgres:5432/weatherdb
      FORECAST_PROVIDER: synthetic
      FEATURE_PROVIDER: synthetic
      OBSERVATION_PROVIDER: synthetic
      # Real (non-synthetic) FEATURE_PROVIDER=gee auth — see §3.2/§7.5: path to a GEE
      # service-account JSON key, mounted read-only; unused while FEATURE_PROVIDER=synthetic.
      GOOGLE_APPLICATION_CREDENTIALS: /run/secrets/gee_service_account.json
      DEMO_API_KEY: ${DEMO_API_KEY:-changeme-demo-key}   # POST /prediction auth, see 05 §6
      PREDICTION_RATE_LIMIT: "60/minute"
      ADMIN_ROLE_ALLOWLIST: "admin,ml_engineer"
      PILOT_DISTRICT_BBOX: "76.85,13.10,77.30,13.55"    # Tumakuru approx bbox (minLon,minLat,maxLon,maxLat), see §3.3
    depends_on: [postgres]
    ports: ["8000:8000"]
    volumes: ["./ml/models:/app/ml/models"]
    deploy:
      resources:
        limits: { cpus: "2.0", memory: 3g }   # keeps LightGBM+FastAPI within the 8GB floor (§7.5)
    # LightGBM models load in-process inside this container (joblib load at startup /
    # lazy load on first request). No separate ml-inference microservice for the MVP —
    # a single Python process keeps deployment simple and avoids an inter-container
    # network hop for every prediction request.

  frontend:
    build: { context: ., dockerfile: docker/frontend.Dockerfile }
    environment:
      VITE_API_BASE_URL: http://localhost:8000
    ports: ["5173:5173"]
    depends_on: [backend]
    deploy:
      resources:
        limits: { cpus: "1.0", memory: 1g }

volumes:
  pgdata:
```

### 7.5 Hardware floor for the judging machine

Documented minimum (also stated in `02_REQUIREMENTS.md` NFR-8 and the README): **≥8 GB RAM,
4 CPU cores, ~5 GB free disk**. This covers Postgres+PostGIS, FastAPI with LightGBM loaded
in-process, and the Vite dev server running concurrently under `docker compose up`. The
per-service `deploy.resources.limits` above are soft guardrails (Compose enforces them without
requiring Swarm mode on modern Docker) so a resource-starved host fails predictably (OOM-killed
container, visible in `docker compose logs`) rather than hanging silently — the README's
troubleshooting section must call this out explicitly as the first thing to check if
`docker compose up` looks "stuck."

## 8. API endpoints — exact contract (superset of `08_API_AND_DATABASE.md` §1, with example payloads for every route so the agent doesn't have to guess shapes)

```
GET  /health
  -> 200 {"status": "ok"}

GET  /districts
  -> 200 [{"id": "DIST-KA-TUM", "name": "Tumakuru", "state": "Karnataka"}]

GET  /blocks?district_id=DIST-KA-TUM
  -> 200 [{"id": "BLK-KA-001", "district_id": "DIST-KA-TUM", "name": "Block 1"}]

GET  /panchayats?block_id=BLK-KA-001
  -> 200 [{"id": "PNC-KA-0001", "block_id": "BLK-KA-001", "name": "Panchayat A",
           "is_synthetic_boundary": true}]

GET  /weather/forecast?block_id=BLK-KA-001&date=2026-09-27
  -> 200 {"block_id": "BLK-KA-001", "date": "2026-09-27",
          "rainfall_mm": 15.0, "temp_max_c": 31.2, "temp_min_c": 22.1,
          "humidity_pct": 68, "data_source_tag": "FORECAST", "is_synthetic": true}

GET  /prediction/PNC-KA-0001?date=2026-09-27&variable=rainfall
  -> 200 (see full example already in 08_API_AND_DATABASE.md §1 — reuse verbatim)

POST /prediction   {"latitude": 13.34, "longitude": 77.10, "date": "2026-09-27", "variable": "rainfall"}
  -> 200 (same shape as GET /prediction/{id}, computed on demand) | 401 if no API key

GET  /advisory?location_id=PNC-KA-0001&crop=ragi&stage=flowering
  -> 200 [{"rule_id": "heavy_rainfall_v1", "message": "...", "uncertainty_label": "medium",
           "issued_at": "2026-09-27T06:00:00Z"}]

GET  /model/info
  -> 200 {"active_versions": {"rainfall": "v0.1.0-lgbm", "temperature": "v0.1.0-lgbm",
          "humidity": "v0.1.0-lgbm"}, "training_window": "2024-06-01/2026-06-01"}

GET  /model/metrics
  -> Before a variable's Phase 5 sub-step has actually been run, its entry is:
     {"temperature_max": {"status": "not_yet_evaluated", "baseline": null, "ml": null},
      "rainfall": {"status": "not_yet_evaluated", "baseline": null, "ml": null}}
  -> After Phase 5a/5b actually train and evaluate a variable, its entry becomes (illustrative
     schema only — every number below is a placeholder for a real computed value, never a
     number to copy into code, docs, or a slide):
     {"temperature_max": {
        "status": "evaluated",
        "baseline_block_replication": {"mae": "<computed>", "rmse": "<computed>", "bias": "<computed>", "r2": "<computed>"},
        "ml": {"mae": "<computed>", "rmse": "<computed>", "bias": "<computed>", "r2": "<computed>"}},
      "rainfall": {
        "status": "evaluated",
        "baseline_block_replication": {"mae": "<computed>", "rmse": "<computed>"},
        "ml": {"mae": "<computed>", "rmse": "<computed>"},
        "rain_occurrence": {"precision": "<computed>", "recall": "<computed>", "f1": "<computed>"}}}
  -> temperature is expected to be evaluated before rainfall (Phase 5a before 5b, §5)

GET  /map/layer?variable=rainfall&date=2026-09-27&level=panchayat
  -> 200 GeoJSON FeatureCollection, each feature.properties containing value + data_source_tag + is_synthetic

POST /model/train   (auth required)
  -> 202 {"job_id": "train-2026-09-27-001", "status": "queued"}
```

## 9. Advisory rules — concrete YAML the agent implements directly (satisfies `06` Use Case + `10` §6 USP row)

`uncertainty_label` is ordered `low` (narrow interval, most trustworthy) < `medium` <
`high` (wide interval, least trustworthy) — see the binding direction convention in
`04_ML_DOWNSCALING_APPROACH.md` §3. `max_uncertainty_label` below is the **worst
(widest-interval) label the rule will still fire cleanly on**; anything wider is downgraded,
never anything narrower.

```yaml
# advisory/rules.yaml
- id: heavy_rainfall_v1
  trigger: "rainfall_mm >= 50 AND horizon_days <= 1"
  max_uncertainty_label: medium
  message: "Heavy rainfall (>=50mm) expected within 24h. Consider delaying irrigation; check drainage for low-lying fields."
- id: irrigation_suggestion_v1
  trigger: "rainfall_mm < 2 AND days_since_last_rain >= 5"
  max_uncertainty_label: high
  message: "Low rainfall and dry spell detected. Consider scheduling irrigation if soil moisture is low."
- id: heat_stress_v1
  trigger: "temp_max_c >= crop_stage.sensitive_thresholds.heat_max_c AND crop_stage.stage_name == 'flowering'"
  max_uncertainty_label: medium
  message: "Forecast max temperature exceeds the heat-stress threshold for this crop's flowering stage."
suppression_rule: "If uncertainty_label == 'high' (widest interval, least trustworthy), prefix message with '[Informational only — wide forecast uncertainty] ' instead of suppressing outright. Never apply this prefix or any downgrade to uncertainty_label == 'low', which is the most trustworthy case."
```

## 10. What "done" means for the SIH demo

The agent knows the build is complete when **all** of these are true simultaneously, on a
machine with **≥8 GB RAM / 4 CPU cores** (§7.5, `02_REQUIREMENTS.md` NFR-8), Docker, no other
setup, and no internet access **except** for Leaflet basemap tiles (§0 Rule 4 — every other
check below must pass with tiles blocked/unreachable):
1. `git clone && docker compose up` — no manual steps — serves the dashboard at `localhost:5173`.
2. The 10-step demo script in `10_TESTING_DEPLOYMENT_AND_PPT.md` §4 can be performed start to
   finish against the running stack.
3. `pytest` and any frontend tests pass.
4. `/model/metrics` returns real (synthetic-data-derived, honestly computed) numbers, not
   placeholders.
5. A visible, honest "synthetic data" banner is present in the UI, and `docs/DEVIATIONS.md`
   lists exactly what a team would need to do (API keys, MOUs, GEE account — all named in
   `03_DATASET_AND_DATA_PIPELINE.md`) to point this same codebase at real data post-hackathon.
