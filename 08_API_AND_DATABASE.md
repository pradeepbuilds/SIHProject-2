# 08 — API Design & Database

## 1. REST API contract

| Endpoint | Method | Purpose | Auth |
|---|---|---|---|
| `/health` | GET | Liveness/readiness check | None |
| `/locations` | GET | List/search locations across levels | None |
| `/districts`, `/blocks`, `/panchayats` | GET | Hierarchical location lookups (support `?parent_id=`) | None |
| `/weather/forecast` | GET | Coarse (block-level) forecast passthrough, tagged `FORECAST` | None |
| `/prediction/{location_id}` | GET | Latest downscaled prediction + uncertainty interval/label + provenance tag, for a panchayat/grid cell | None |
| `POST /prediction` | POST | On-demand inference request (e.g., custom lat/long not pre-computed) | API key (rate-limited) |
| `/advisory` | GET | Advisory records for a location (`?crop=&stage=`) | None |
| `/model/info` | GET | Active model version, training window, feature schema | None |
| `/model/metrics` | GET | Latest evaluation metrics — Block Replication Baseline (and secondary IDW baseline where computed) vs ML, per variable | None |
| `/map/layer` | GET | GeoJSON layer for a given variable/date/level (for Leaflet) | None |
| Admin: location/dataset management, `POST /model/train` | POST/PUT | Data refresh, retraining trigger | **Dev-only role check** (admin/ML-engineer role compared against an allow-list — not a real JWT/session system; see `05_SYSTEM_ARCHITECTURE.md` §Auth) |

Note on `location_id`: every panchayat-scoped record and endpoint is keyed by a `location_id`
that resolves to a `Panchayat` (or, where no panchayat polygon exists yet, its `GridCell`
fallback — `03_DATASET_AND_DATA_PIPELINE.md` §7.5). This is the panchayat-first identifier
used consistently across the schema, the API, the diagrams, and the build plan (`07`, `09`,
`11`) — `location_id` is not a legacy/generic key, it *is* how "panchayat-first" is expressed at
the API layer, since a single identifier has to also cover the grid-cell fallback.

### Example: `GET /prediction/{location_id}`

Request: `GET /prediction/PNC-KA-1234?date=2026-09-27&variable=rainfall`

Response (illustrative schema, not fabricated data):
```json
{
  "location_id": "PNC-KA-1234",
  "variable": "rainfall_mm",
  "forecast_date": "2026-09-25",
  "target_date": "2026-09-27",
  "horizon_days": 2,
  "prediction": 18.4,
  "uncertainty_interval": {"p10": 6.2, "p50": 18.4, "p90": 34.1},
  "uncertainty_label": "medium",
  "data_source_tag": "ML_DOWNSCALED",
  "is_synthetic": true,
  "coarse_reference": {"block_id": "BLK-KA-045", "value": 15.0, "data_source_tag": "FORECAST", "is_synthetic": true},
  "baseline": {
    "method": "block_replication",
    "value": 15.0,
    "data_source_tag": "BASELINE",
    "diff_from_baseline": 3.4
  },
  "model_version": "v0.3.1-lgbm-rainfall"
}
```

Note: `uncertainty_label` ("high"/"medium"/"low") is derived from interval width relative to the
variable's typical range, using thresholds defined in `04_ML_DOWNSCALING_APPROACH.md` §3 — it is
never a calibrated probability, so the API and UI never render it as "confidence = X%". The
`baseline` block always carries the **Block Replication Baseline** value (`method:
"block_replication"`, i.e. the raw coarse block forecast for that variable/date) so the client
can render "how different is this panchayat's ML prediction from just using the block value"
without a second request; when a secondary IDW baseline was computed for that block (neighbouring
blocks available), it is added as an additional entry with `method: "idw_secondary"`.

Validation and Fallback Logic: `location_id` must resolve to a known panchayat/grid cell (404 otherwise); `date` (target date)
must be within the model's supported horizon — **hardcoded to 1–5 days for the shipped
synthetic/demo path** (422 otherwise; see `11_AGENT_BUILD_PLAN.md` §2.4). When requested by `date`, the backend implicitly queries the database 
for the most recently issued forecast (`forecast_date`) for that `target_date`, computing `horizon_days = target_date - forecast_date` 
to feed the ML model. Errors return a structured `{"error": {"code": ..., "message": ...}}` body.

`POST /prediction` additionally validates the request body's `{lat, lon}` against the pilot
district's bounding box **before** running inference: outside the box → `400
outside_pilot_area` with the valid bbox echoed back; inside the box but off-grid → snapped to
the nearest `GridCell` and the response carries the snapped cell id + distance. There is no
silent interpolation/extrapolation path for a point outside the training district — see
`11_AGENT_BUILD_PLAN.md` §3.3 for the full rule.

## 2. ER model (core entities)

| Entity | Key attributes | Notes |
|---|---|---|
| `District` | id, name, state, LGD code | |
| `Block` | id, district_id, name, LGD code | |
| `Panchayat` | id, block_id, name, LGD code, geometry (nullable — see `03` §7.5 gap) | |
| `GridCell` | id, block_id, geometry (1 km cell), centroid | Always populated even where Panchayat.geometry is null |
| `WeatherObservation` | id, location_ref, timestamp, variable, value, source, is_synthetic | `data_source_tag = OBSERVED` |
| `WeatherForecast` | id, block_id, forecast_date, target_date, horizon_days (lead time), variable, value, is_synthetic | `data_source_tag = FORECAST`; `horizon_days` is stored and exposed everywhere this record's value is used — training, evaluation, API response, dashboard — since forecast error characteristics change with lead time |
| `EnvironmentalFeature` | id, location_ref, feature_name, value, valid_from, valid_to, is_synthetic | Static/seasonal features (DEM, LULC, NDVI, soil) |
| `BaselinePrediction` | id, location_ref, target_date, variable, value, method (`block_replication` \| `idw_secondary`), is_synthetic | `data_source_tag = BASELINE` — the mandatory Block Replication Baseline (and optional secondary IDW baseline) value for every location/date/variable, stored explicitly so baseline-vs-ML comparison never has to be recomputed ad hoc. A baseline is a derived value but it is **not** a model prediction, so it is never tagged `ML_DOWNSCALED` |
| `MLPrediction` | id, location_ref, forecast_date, target_date, horizon_days, variable, value, model_version_id, is_synthetic | `data_source_tag = ML_DOWNSCALED` |
| `PredictionUncertainty` | prediction_id (FK), p10, p50, p90, uncertainty_label | 1:1 with `MLPrediction`; `uncertainty_label` is derived from interval width, never a fabricated confidence percentage (`04_ML_DOWNSCALING_APPROACH.md` §3) |
| `Advisory` | id, location_ref, crop_id, crop_stage_id, rule_id, message, uncertainty_label, issued_at | |
| `Crop` | id, name | |
| `CropStage` | id, crop_id, stage_name, sensitive_thresholds | |
| `ModelVersion` | id, variable, model_type (`baseline_block_replication` \| `baseline_idw_secondary` \| `ml_lightgbm` \| `ml_xgboost`), training_window, feature_schema_hash, validation_metrics, created_at | Baselines are recorded as `ModelVersion` rows too, so every `MLPrediction`/`BaselinePrediction` traces back to an explicit, versioned method — never an implicit default |
| `User` | id, role (admin/officer/public) | Only needed for authenticated endpoints |

### Relationships (textual, since diagram is in `09_DIAGRAMS.md`)

`District 1—N Block 1—N Panchayat`; `Block 1—N GridCell`; `Panchayat/GridCell 1—N
WeatherObservation`, `1—N MLPrediction`, `1—N BaselinePrediction`, `1—N EnvironmentalFeature`;
`Block 1—N WeatherForecast`; `MLPrediction 1—1 PredictionUncertainty`; `MLPrediction N—1
ModelVersion`; `BaselinePrediction N—1 ModelVersion` (the baseline is itself a versioned
"model"); `Advisory N—1 Panchayat/GridCell`, `N—1 Crop`, `N—1 CropStage`, `N—1 MLPrediction` (the
prediction that triggered it).

Tables intentionally **not** created for the MVP: per-farmer profile tables, payment/billing,
notification-delivery logs — none are required by the stated use cases (Rule: do not create
unnecessary tables).
