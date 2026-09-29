# 10 — Testing, Deployment, Demo, PPT, USPs, Limitations

## 1. Testing strategy

| Type | Tooling | Example cases |
|---|---|---|
| Unit | Pytest (backend/ML), Jest (frontend) | Feature-engineering functions produce expected columns; advisory rule evaluates correctly for a given threshold |
| Integration | Pytest + test DB | Ingestion → feature store → inference round-trip on a small fixture dataset |
| API | FastAPI `TestClient` | `/prediction/{id}` returns 404 for unknown id, 200 with correct schema otherwise |
| ML | Custom fixtures | Model rejects out-of-range inputs; quantile outputs are monotonic (p10 ≤ p50 ≤ p90) |
| Data validation | Great-Expectations-style checks or custom | Rainfall ≥ 0; latitude/longitude within pilot district bounds; no duplicate (location, timestamp) rows |
| GIS | Pytest + GeoPandas | Spatial join assigns every grid cell to exactly one block |
| UI | Manual + optional Playwright | Drill-down navigation, layer toggle, uncertainty badge renders |
| Performance | Basic load test (locust/k6, optional) | `/map/layer` responds within an acceptable time for the pilot district's grid-cell count |
| Model drift | Scheduled comparison job | Recent prediction error vs. new ground truth flagged if beyond a documented threshold |
| Spatial generalisation | Part of ML evaluation (Section 07) | Held-out-location metrics reported every training run |

## 2. Security

- Public GET endpoints (locations, forecast, prediction, advisory, model info/metrics) require
  no authentication — this is public-interest weather/advisory information.
- `POST /prediction` (on-demand scoring) requires a static demo `X-API-Key` header and is
  rate-limited to 60 requests/minute per key. Admin/training endpoints (`POST /model/train`,
  location/dataset management) require a separate **dev-only role check** (`X-User-Role`
  compared against a hardcoded allow-list) instead of an API key. Neither mechanism is a real
  JWT/session auth system — both are placeholder gates, not production security. Full concrete
  spec (key issuance, rate-limit enforcement, error codes) is in `05_SYSTEM_ARCHITECTURE.md`
  §6; real token-based auth is explicit phase-2 hardening.
- Input validation via Pydantic schemas on every endpoint; no raw SQL string interpolation
  (parameterised queries only).
- Secrets (DB credentials, any external API keys) via environment variables / `.env`, never
  committed.
- Structured logging of requests/errors; no PII is collected in the MVP (no farmer account
  system), which simplifies privacy/auditability requirements considerably.
- Authentication complexity is deliberately **not** introduced for the majority of the system,
  per project rule 28 ("do not introduce unless required").

## 3. Deployment

| Option | Description |
|---|---|
| Local development | `uvicorn` + `vite dev` + local Postgres/PostGIS install |
| Docker development | `docker compose up` — frontend, backend (LightGBM inference runs in-process here, no separate ml-inference container), postgres/postgis |
| Production (future) | Containers behind a reverse proxy (e.g., Nginx/Traefik); managed PostGIS (e.g., a cloud Postgres with the PostGIS extension); object storage for rasters/models. **Cloud provider not committed here** — evaluate cost/free-tier terms at the time of that decision rather than asserting a provider is free/production-ready now (Rule: do not claim without verification) |

Model versioning: every export writes `model_version`, `training_window`,
`feature_schema_hash`, and validation metrics into the `ModelVersion` table and alongside the
artifact file name, so a served prediction can always be traced to the exact model and data
window that produced it.

## 4. SIH demo script (5–10 minutes)

1. Select state → district (pilot district).
2. Select a block; show the **coarse IMD-style block forecast** (rainfall/temp/humidity),
   explicitly labeled `FORECAST`.
3. Select a panchayat within that block; show the **downscaled prediction**, labeled
   `ML_DOWNSCALED`, with its uncertainty interval visibly different from a neighbouring
   panchayat in the same block — this is the core "aha" moment proving the PS is actually
   solved (not just relabeled).
4. Toggle coarse-vs-downscaled map layers side by side.
5. Show the uncertainty layer / uncertainty badge and explain, in one sentence, what interval it
   represents.
6. Show local static features (elevation/NDVI/land cover) that explain *why* this panchayat
   differs from the block average (feature-importance view).
7. Generate an agro-advisory for a selected crop/stage, showing the advisory engine's
   `uncertainty_label`-linked message.
8. Show historical trend + forecast trend chart for the panchayat.
9. Show `/model/metrics` — baseline vs. ML, honestly, including any variable where ML did not
   clearly beat baseline.
10. Close by stating current scope (1 pilot district) and the scaling path.

## 5. PPT structure (12–15 slides)

| # | Slide | Key points | Visual |
|---|---|---|---|
| 1 | Title | Team, PS ID/title, org | Logo/title only |
| 2 | Problem | Block vs panchayat granularity gap | 1 diagram (block→panchayat) |
| 3 | Existing gap | IMD block forecast exists but stops at block level | Coverage stat callout |
| 4 | Proposed solution | One-line solution statement | Architecture teaser |
| 5 | How downscaling works | Coarse forecast + static features → ML → local value | Simple flow diagram |
| 6 | Data sources | Table of real datasets used (from `03`), **with required attribution lines shown on-slide** ("BHOOSAMPADA, NRSC (ISRO)" for Bhuvan/NRSC products, Copernicus attribution for ERA5-Land — per `03_DATASET_AND_DATA_PIPELINE.md`'s license column) | Table, not a wall of logos |
| 7 | AI/ML approach | Why quantile-LightGBM over deep learning for MVP | Comparison table (trimmed) |
| 8 | System architecture | Full component diagram | `09_DIAGRAMS.md` §1 |
| 9 | Workflow | End-to-end data→prediction→advisory flow | `09_DIAGRAMS.md` §2 |
| 10 | Dashboard | Screenshot(s) | Real screenshots only |
| 11 | Agro-advisory | 2-3 example advisories with `uncertainty_label` | Example cards |
| 12 | Innovation/USP | From Section 6 below | Bullet list |
| 13 | Validation/results | Baseline vs ML metrics — **only after Phase 6 actually runs** | Bar chart |
| 14 | Scalability & roadmap | Pilot → multi-district path | Phase timeline |
| 15 | Impact / future scope | Section 8 below | Bullet list |

Do not overcrowd: each slide should carry **one** diagram/chart and no more than ~5 bullet
points; detailed tables (like the dataset table) belong in the appendix/backup slides, not the
main narrative.

## 6. USPs (only claims the implementation can demonstrate)

IMD's own Panchayat Mausam Seva already delivers a named, per-panchayat forecast product
nationally (launched 24 Oct 2024, ~2.6 lakh panchayats — see `01_PROBLEM_ANALYSIS.md` §I2), so
"forecasts at panchayat level" by itself is **not** a defensible USP and is not claimed as one.
The differentiation is in *how* the panchayat-level value is produced and exposed:

| USP | Mechanism | User benefit | Demonstration | Measurement |
|---|---|---|---|---|
| Terrain/land-cover-aware statistical downscaling | Tree-ensemble model conditioned on coarse forecast + static panchayat-level features (elevation, NDVI, soil, distance to water) | A locally-corrected value, not just the block/PMS value copied or interpolated | Live map toggle vs. Block Replication Baseline | Spatial-holdout MAE improvement over baseline |
| Uncertainty-aware predictions | Quantile regression intervals (`uncertainty_label`/`uncertainty_interval`) | User knows how much to trust a given prediction — never a fabricated accuracy % | Uncertainty badge in UI | Interval coverage on holdout set |
| Explainable feature contribution | Tree feature importance / SHAP | Builds trust vs. black-box AI claims | "Why this differs from the block" panel | Consistency of top features across runs |
| Open, documented API | REST endpoints (`08_API_AND_DATABASE.md`) returning point + interval + provenance per panchayat | Third parties (agri-tech apps, researchers, other departments) can integrate directly, unlike a closed dissemination-only product | Live API call in demo | Endpoint contract documented and stable |
| Weather-to-advisory pipeline | Separate rule engine consuming predictions + crop context | Directly actionable guidance, not just numbers | Advisory panel with `uncertainty_label`-linked suppression | # advisory types implemented & correctly triggered in test cases |
| Data-provenance transparency | `data_source_tag` (OBSERVED/FORECAST/BASELINE/ML_DOWNSCALED) plus an independent `is_synthetic` flag on every value | User/jury can always tell observation vs forecast vs baseline vs ML output, and whether it's demo data | Visible badge on every map layer/number | 100% of served values carry both fields |
| Scalable geospatial architecture | Grid-first spatial unit, panchayat aggregation where available | Works even where panchayat boundaries are missing (a real, verified data gap) | Add a second block/district live in demo | Time/steps to onboard a new block |

## 7. Limitations (never hidden)

- Downscaled predictions are only as good as the coarse forecast and static features feeding
  them; systematic IMD/NWP forecast error is not something this system can correct beyond
  learned local bias.
- Ground-observation density (~1,019 IMD stations found nationally) is sparse relative to the
  number of panchayats, which limits validation confidence, especially outside the pilot
  district.
- Panchayat polygon boundaries are not uniformly available nationwide (Section 03, §7.5); the
  system falls back to a grid representation where they are missing.
- Extreme/rare events (cloudbursts, gusts, hail) are not reliably learnable from limited
  historical samples and are explicitly excluded from ML downscaling (Section 01, §H) —
  users are directed to IMD's own nowcast/warning services for these.
- Satellite-derived features (NDVI/NDWI) are affected by cloud cover and have an effective
  refresh cadence of roughly one to two weeks, not daily.
- Advisory recommendations require agronomic domain validation before real-world use; the
  system is a decision-support tool, not an autonomous decision-maker.
- Regional recalibration is expected to be needed when scaling to new agro-climatic zones —
  a model trained on one district's terrain/climate relationships will not automatically
  transfer perfectly to a very different region.

## 8. Future extensions

More districts/states; more weather variables; crop-specific advisory rule sets; near-real-time
satellite feature ingestion where latency allows; IoT/low-cost weather-station integration to
densify ground truth; native mobile app; multilingual and voice-based advisory delivery;
continual/periodic learning as more validation data accrues; conformal-prediction-based
uncertainty calibration; CNN/U-Net or GNN models once multi-district training volume justifies
them; extreme-event—specific modelling as a separate, appropriately-cautious workstream.

## 9. Verification status summary (repeated from README for completeness)

**Verified (cited, see `03_DATASET_AND_DATA_PIPELINE.md` §12):** Bharat Forecast System (BFS)
launch, resolution (~6 km), and provider (IITM/MoES/IMD); ERA5-Land and NASA POWER
resolution/access/license; Bhuvan/NRSC LULC and SRTM DEM product tiers and access friction;
Sentinel-2 access via Google Earth Engine; LGD's role and the fragmented state of
panchayat-boundary GIS data nationally.

**Not yet verified — requires action before build begins** (full list: `03_DATASET_AND_DATA_PIPELINE.md`
§13 "TODO before build"):
- Official BharatFS/IMD data-access mechanism (API, registration, or data-supply request) for
  hackathon/third-party use — see §2 of `03_DATASET_AND_DATA_PIPELINE.md`.
- Whether SIH will supply an official dataset link for PS 26074.
- Panchayat-boundary availability for the specific pilot district ultimately chosen.
- IMD AWS/rain-gauge data-supply process for the chosen pilot district (needed for genuine
  validation, not just a plausible-looking demo).

**What should be implemented first:** Phase 2 (confirm data access for one real district) —
everything else in this blueprint is contingent on that being resolved concretely, per Rule 11
("do not start coding until documentation and architecture are consistent" — and consistency
here explicitly includes not assuming data that hasn't been confirmed).
