# KrishiMitra — Upgrade Build Prompt for the Coding Agent

> Paste this whole file to your agent as one message (or place it in the repo as `docs/UPGRADE_PROMPT.md` and tell the agent to follow it). It is written so the agent can work through it start to finish without asking questions, while leaving an evidence trail you can audit.

---

## 0. MISSION

The project (currently "AGRI-CAST 1KM") already works end to end: synthetic data generator → PostGIS → feature table → LightGBM downscaling (temperature max/min, rainfall) with P10/P50/P90 → advisory rules → FastAPI → React/Leaflet dashboard, all under `docker compose`.

Upgrade it into **KrishiMitra**, a competition-grade product that a judging panel will rank above teams with more states but shallower work. Judges reward: a real problem, a demo that works first time, technical depth we can defend, honest claims, scalability by design, and a UI that looks designed by people rather than generated.

**Our edge (build toward this, and do not fake anything):**
1. Config-driven multi-region architecture: any district is added with one YAML file. Ship four regions from different agro-climatic zones.
2. Honest, rigorous ML: spatial holdout, baseline-vs-ML on the same split, calibrated uncertainty, a rain hurdle model, per-prediction explanations.
3. A real analytics dashboard (trends, skill vs lead time, calibration, forecast evolution, spatial error).
4. Farmer view and Officer view, stage-aware crop advisories, multilingual, printable bulletin.
5. Clear provenance: every number and map layer says whether it is real, synthetic, or calibrated-synthetic.

You are not being asked to invent real observations. Never present synthetic output as real.

---

## 1. OPERATING RULES (read twice)

### 1.1 Evidence and honesty
- Keep a log at `docs/BUILD_LOG.md`. After each workstream, append a checkpoint: what changed, the exact commands run, and the raw command output (pasted, not summarized), and whether each check ran **inside Docker** or **on the host only**.
- Never write "verified" or "working" for something you did not run. If you could not run it, write `NOT VERIFIED — reason — exact command for the user to run`.
- Never fabricate metrics. All metrics come from scripts that write JSON, and the UI reads that JSON. Numbers from synthetic data are labelled "synthetic-world result" in the UI and docs.
- Keep every existing honesty rule: `is_synthetic` and `data_source_tag` on every row, spatial holdout split (never random rows), baseline comparison on the same test locations, `uncertainty_label` direction (low = narrow/trustworthy, high = wide/untrustworthy), advisory engine decoupled from the ML code.

### 1.2 Autonomy
- Work through all workstreams in the order in section 3 without stopping for approval. Stop and ask only if (a) a gate fails twice and you cannot fix it, or (b) a decision would change the scope described here.
- If a P1 or P2 item is blocked after two serious attempts, mark it `SKIPPED — reason` in the log and continue. P0 items may not be skipped.
- Priorities: **P0** must ship, **P1** should ship, **P2** stretch. Finish all P0 before starting any P1.

### 1.3 Known pitfalls from earlier phases (do not repeat them)
| Pitfall seen before | Rule now |
|---|---|
| Docker Desktop/WSL2 hung when LightGBM used all cores | Always `n_jobs=2` (config value `TRAIN_N_JOBS`). Never launch several heavy jobs at once. |
| Models trained on the host, served in the container with unverified library versions | Every saved model has a sidecar `*.meta.json` recording library versions. The backend compares versions at load and logs `ERROR` on major/minor mismatch. Add `scripts/check_env_parity.py` (compares host and container `pip freeze` for pandas, numpy, scikit-learn, lightgbm, joblib, shapely, geopandas) and run it before training. |
| Odd pin `pandas==3.0.6` | The container image build must succeed. Run `docker compose build --no-cache backend` and show that the pinned versions installed. If a pin does not exist on PyPI, choose real versions, retrain, and update pins. |
| Disk was nearly full (335 MB free) | Before starting, check free space (`Get-PSDrive C`). Need at least 8 GB free. Use `docker system df` and `docker builder prune` if needed. Store parquet with zstd, float32 where safe. |
| Docker "verification" was claimed while Docker was unreachable | Each gate states where it ran. The final gate must be a clean `docker compose down -v` then `docker compose up -d`. |
| `environmental_feature` DB rows (64,518) ≠ parquet (86,024) because string features were silently dropped | Fixed in WS-B. Loaders must assert row counts equal parquet counts and fail loudly otherwise. |
| UI labels said "1km" though models train per panchayat | Fixed in WS-B. Never claim 1 km resolution unless grid-level inference is actually implemented and shown. |

### 1.4 Environment assumptions
- Windows 11, PowerShell, Docker Desktop. Compose file: `docker/docker-compose.yml`. Container names look like `docker-backend-1`. Give PowerShell-safe commands; do not use bash-only syntax on the host.
- The judged machine may have **no internet**. Everything (fonts, JS libraries, chart libraries, region data, model files) must be bundled in the repo/images. The only permitted network dependency is **OpenStreetMap basemap tiles**, and the map must degrade gracefully without them (plain background, vector layers still render).
- Stack budget: whole stack runs on 8 GB RAM / 4 cores.

---

## 2. STEP 0 — INVENTORY AND REGRESSION SNAPSHOT (do this before changing anything)

1. Print the repo tree (2 levels) and list all current API routes (from `/openapi.json`) and DB tables.
2. Run the current pipeline end to end and save the current metrics to `docs/regression_reference/model_metrics_v1.json` (Tumakuru: baseline and ML for temp max, temp min, rainfall on the 23 held-out panchayats).
3. Take a screenshot of the current UI to `docs/regression_reference/ui_v1.png`.
4. Confirm free disk space and Docker health (`docker info`).
5. Write `docs/BUILD_LOG.md` with a "Step 0" checkpoint.

Regression rule: after the upgrade, Tumakuru's baseline metrics on the original 23 test panchayats must equal the v1 numbers to within rounding (the baseline is deterministic). ML metrics may change (models are retrained) but must be reported next to v1.

---

## 3. ORDER OF WORK

`Step 0 → WS-B (fix-first bugs) → WS-A (rename) → WS-C (multi-region config) → WS-D (data v2) → WS-E (models v2) → WS-F (API) → WS-G (advisory v2) → WS-H (frontend) → WS-I (docs and demo) → WS-J (tests and final gate)`

Write a checkpoint in `docs/BUILD_LOG.md` after each.
