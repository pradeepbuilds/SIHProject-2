# How to Add a New District to KrishiMitra (10-Step Guide)

KrishiMitra is architected so that any district in India can be added **using a single YAML configuration file** without writing any custom Python or TypeScript code.

---

## 10-Step Operational Workflow

### Step 1: Create the Region YAML
Create `regions/<region_id>.yaml` (e.g. `regions/ka-mandya.yaml`). Specify:
- `region_id`: e.g. `ka-mandya`
- `id_prefix`: e.g. `PNC-MY`
- `state`: e.g. `Karnataka`
- `district`: e.g. `Mandya`
- `agro_climatic_zone`: e.g. `Southern dry zone`
- `languages`: e.g. `[en, kn, hi]`
- `main_crops`: e.g. `[sugarcane, paddy, ragi]`
- `horizon_days`: `{min: 1, max: 5}`

### Step 2: Acquire Official District GeoJSON
Download or export the official district boundary polygon (e.g. geoBoundaries ADM2 or Survey of India open data) and place it at:
`regions/data/<region_id>/district.geojson`.

Record the source, licence, and attribution inside the `boundary` section of the YAML.

### Step 3: Configure Climatological Normals
Input the 12-month monthly normal values for maximum temperature, minimum temperature, rainfall, and wet-day probability into the `climatology` section (sourced from IMD / NASA POWER normals).

### Step 4: Configure Alert Thresholds
Define regional agricultural warning thresholds in `alert_thresholds`:
- `heavy_rain_mm`: e.g. `50`
- `heat_c`: e.g. `38`
- `cold_c`: e.g. `10`
- `dry_spell_days`: e.g. `5`

### Step 5: Run the End-to-End Build CLI
Execute the KrishiMitra multi-region build command:
```powershell
python -m krishimitra.cli region build --region <region_id>
```
This automatically runs:
1. Seeded Voronoi sub-unit boundary partitioning (blocks & panchayats) clipped to the official district boundary polygon.
2. Digital elevation model (DEM) terrain feature extraction (elevation, slope, aspect) and soil/landcover generation.
3. Climatology-shaped weather timeseries simulation and scenario catalog detection (heavy rain, heatwaves, dry spells).
4. Feature table construction (`training_features.parquet`).
5. Spatial holdout split (80% train, 20% test) with 20% calibration set.
6. Multi-target model training: LightGBM quantile regression (P10, P50, P90) for temperature, and a two-stage calibrated Hurdle model (Isotonic classifier + Quantile amounts) for rainfall.
7. Model artifact serialization with sidecar `*.meta.json` recording environment libraries and git commit.
8. Spatial holdout evaluation producing `metrics.json` and `test_predictions.parquet`.

### Step 6: Verify Environment Parity and Model Artifacts
Ensure dependencies match container targets:
```powershell
python scripts/check_env_parity.py
```
Check that model files and sidecars exist in `ml/models/<region_id>/`.

### Step 7: Inspect Evaluation Metrics
Open `ml/evaluation/<region_id>/metrics.json` and verify:
- Baseline vs ML MAE, RMSE, and bias.
- Calibration empirical coverage of the [P10, P90] interval.
- Rainfall Hurdle precision, recall, F1, and Brier score.

### Step 8: Verify Discovery in CLI
Run:
```powershell
python -m krishimitra.cli region list
```
The new district should appear with its status, boundary count, and trained models.

### Step 9: Seed the Database
Seed the new district into the PostGIS database:
```powershell
python -m krishimitra.cli region seed --region <region_id>
```
The region table, district boundaries, blocks, panchayats, and scenario catalog are populated idempotently.

### Step 10: Launch or Reload the Application
The backend dynamically reads `regions/<region_id>.yaml` and loads the models into memory at startup. The frontend region picker immediately populates the new state and district.

---

## Proof of Functionality: Throwaway Demo Region (`demo-region`)

During Workstream C, a 5th throwaway region `demo-region` was created, built via CLI, verified, and cleaned up:

```text
> python -m krishimitra.cli region build --region demo-region
============================================================
BUILDING REGION PIPELINE: demo-region (Demo District, Karnataka)
Zone: Southern Transition Zone (Demo)
============================================================
[Step 1/5] Generating Geography & Boundaries...
[demo-region] Generated 4 blocks, 26 panchayats, 276 grid cells.
[Step 2/5] Generating Terrain & Environmental Features...
[Step 3/5] Generating Climate Weather & Scenario Events...
[Step 4/5] Constructing Feature Table (training_features.parquet)...
[Step 5/5] Spatial Split, Training & Evaluation...
[demo-region] All models successfully trained and saved with sidecar metadata!
[demo-region] Evaluation complete! Metrics saved to ml/evaluation/demo-region/metrics.json
============================================================
REGION 'demo-region' BUILD COMPLETE!
============================================================
```

CLI verification confirmed discovery:
```text
> python -m krishimitra.cli region list
Regions:
  - ka-tumakuru: Tumakuru, Karnataka [Ready]
  - mh-ratnagiri: Ratnagiri, Maharashtra [Ready]
  - pb-ludhiana: Ludhiana, Punjab [Ready]
  - rj-jodhpur: Jodhpur, Rajasthan [Ready]
  - demo-region: Demo District, Karnataka [Ready]
```

The throwaway demo region was then cleanly removed, leaving the four official competition regions intact.
