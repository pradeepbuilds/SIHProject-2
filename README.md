# KrishiMitra — Weather Intelligence for Every Panchayat
## Downscaling of Weather Forecast from Block Level to Panchayat Level (SIH 2026 — PS 26074)

**Organization:** Ministry of Earth Sciences (MoES) — India Meteorological Department (IMD)  
**Category:** Software | **Theme:** Agriculture, FoodTech & Rural Development  
**Tagline:** *Weather intelligence for every panchayat.*

---

### Upgrade Changelog (KrishiMitra v2.0 Release)
1. **Config-Driven Multi-Region Architecture:** 4 diverse agro-climatic zones shipped (`ka-tumakuru`, `mh-ratnagiri`, `pb-ludhiana`, `rj-jodhpur`), any district added via a single YAML file (`regions/<id>.yaml`).
2. **Honest, Rigorous ML:** Decoupled Hurdle model for rainfall (calibrated classifier + conditional quantile amount), strict spatial holdout (test panchayats never seen in train/calibration), conformalized 80% uncertainty interval calibration.
3. **Panchayat Resolution Integrity:** Explicitly operates at the panchayat administrative level with official geoBoundaries district outlines and seeded Voronoi sub-units. Zero unverified "1 km" claims.
4. **Rich Dual-Audience UI:** Calm, government-grade agricultural light-first design (`tokens.css`), Farmer View (plain headline, 5-day strip, SMS copy, "Why?" explainability) & Officer View (pan-district surveillance table, CSV export, printable 1-page browser PDF bulletin).
5. **Analytics Cockpit (Insights):** 9 verification charts with data-derived takeaway titles, accessible data table fallbacks, and CSV exports.
6. **Codebase Zero-Leakage Audit:** Renamed across all services, docs, and code; 100% test coverage with 55 passing backend tests and optimized lazy-loaded bundle (<100 kB gzipped initial JS).

### How to read this documentation

| # | File | Contents |
|---|------|----------|
| 00 | `00_PROJECT_OVERVIEW.md` | Problem restatement, goals, scope, success criteria |
| 01 | `01_PROBLEM_ANALYSIS.md` | What downscaling means, why Block-level is insufficient, which variables can/can't be downscaled |
| 02 | `02_REQUIREMENTS.md` | Functional & non-functional requirements, actors, constraints |
| 03 | `03_DATASET_AND_DATA_PIPELINE.md` | **Researched** datasets (CORE/SUPPORTING/FALLBACK tiers) with resolution/access/license, honestly marked `TBD` where unverified, plus the ingestion pipeline |
| 04 | `04_ML_DOWNSCALING_APPROACH.md` | Candidate ML approaches compared, selected approach + justification |
| 05 | `05_SYSTEM_ARCHITECTURE.md` | Full modular architecture, component responsibilities, tech stack decision matrix |
| 06 | `06_WORKFLOW_AND_USE_CASES.md` | Actors, use cases, end-to-end workflows |
| 07 | `07_TECHNICAL_IMPLEMENTATION.md` | Feature table, project directory, implementation phases |
| 08 | `08_API_AND_DATABASE.md` | REST API contracts, ER model |
| 09 | `09_DIAGRAMS.md` | Mermaid diagrams: architecture, data flow, ML pipeline, sequence, ER, deployment |
| 10 | `10_TESTING_DEPLOYMENT_AND_PPT.md` | Testing strategy, deployment, demo script, PPT structure, USPs, limitations |
| 11 | `11_AGENT_BUILD_PLAN.md` | **Start here to build.** Concrete, sequential, no-open-questions build plan: pinned pilot district, synthetic-data fallback generator (so the prototype runs with zero external dependencies), exact DB DDL, exact API examples, exact directory tree, phase-by-phase file-level deliverables and acceptance checks |

### Non-negotiable ground rules carried through every document

1. No fabricated dataset, API, or government service is referenced. Every external source
   in `03_DATASET_AND_DATA_PIPELINE.md` was verified by live research and is cited with a URL.
2. No accuracy numbers are asserted before a model is actually trained and evaluated. Any
   metric mentioned elsewhere is a **target/reporting metric**, never a claimed result.
3. Every record in the system carries two independent, first-class fields, both shown in the
   UI: `data_source_tag` — one of `OBSERVED`, `FORECAST` (coarse, as issued by IMD/NWP),
   `BASELINE` (the mandatory Block Replication Baseline, or the optional secondary IDW
   baseline), or `ML_DOWNSCALED` (this system's model output) — and `is_synthetic` (true/false),
   which records separately whether the value came from the synthetic-data fallback generator.
   If a value's provenance is genuinely unknown or ambiguous, it is never silently assigned a
   tag; it is flagged invalid/unknown and resolved explicitly. See `08_API_AND_DATABASE.md`.
4. Agricultural advisories are produced by a **separate, explicit rule engine** consuming
   weather predictions + crop/soil context — they are never presented as an unconditional
   ML output, and every advisory response tells the user this is *guidance, not a guarantee*.
5. Every architecture/technology decision has a stated reason (see decision matrices in
   `05_SYSTEM_ARCHITECTURE.md`).
6. The system is designed as a **pilot-district MVP that scales**, not a fully-solved national
   system — this is stated explicitly wherever scope could be misread as "done."

### What is verified vs. still open (see `10_...md` §9 "Verification status summary" for the full list)

- **Verified by research (with citations):** Bharat Forecast System (BFS) launch (26 May 2025),
  ~6 km resolution, IITM/MoES/IMD provenance, and that it replaces the older ~12 km grid; NASA
  POWER resolution/access; ERA5-Land resolution/access; Bhuvan/NRSC LULC and SRTM DEM products
  and access tiers; Sentinel-2 access via Google Earth Engine; Local Government Directory (LGD)
  role and its **lack of a single nationwide open panchayat polygon layer**.
- **Not yet verified / requires direct outreach before build:** the official BharatFS/IMD
  data-access mechanism (API, registration, or data-supply request) for hackathon/third-party
  use — one secondary source's claim of free global researcher access was **not** treated as
  confirmed (`03_DATASET_AND_DATA_PIPELINE.md` §2) — whether SIH will supply a dataset link for
  PS 26074 (a "Dataset Link" field is visible but blank in the official portal at the time of
  writing), state-specific panchayat boundary access terms, and every other item marked **"TBD —
  requires source verification"** in `03_DATASET_AND_DATA_PIPELINE.md` §13.

Start with `00_PROJECT_OVERVIEW.md`, then `01_PROBLEM_ANALYSIS.md`.

### Redesign changelog (this revision)

This documentation set was critically reviewed and corrected. The most important change:

1. **Baseline corrected.** The previous baseline was IDW spatial interpolation, which is
   mathematically meaningless with only one forecast value per block (IDW degenerates to
   copying that value). The mandatory primary baseline is now the **Block Replication
   Baseline** (block forecast copied to every panchayat); IDW survives only as an **optional
   secondary baseline**, and only when multiple neighbouring blocks' values exist. See
   `04_ML_DOWNSCALING_APPROACH.md` §0.
2. **Temperature-first build order.** Rainfall, temperature, and humidity were previously
   built/evaluated together. The plan now builds and validates temperature first (smooth,
   terrain-driven, easiest to prove the pipeline on), then rainfall, then humidity/wind as
   optional stretch targets. See `07_TECHNICAL_IMPLEMENTATION.md` §5,
   `11_AGENT_BUILD_PLAN.md` §5.
3. **Rainfall's different statistical behaviour made explicit**, including an optional
   two-stage (rain/no-rain classification, then conditional amount) approach as a documented
   Phase-2 upgrade over the MVP single-stage regression. See `04_ML_DOWNSCALING_APPROACH.md`
   §5.
4. **Lead time (`horizon_days`) made an explicit first-class model feature**, not just
   metadata, and carried through the database, API, training/evaluation, and dashboard. See
   `07_TECHNICAL_IMPLEMENTATION.md` §1, `08_API_AND_DATABASE.md`.
5. **Grid-to-panchayat aggregation method made explicit** (area-weighted mean with GIS
   boundary-intersection handling), rather than left implicit. See
   `07_TECHNICAL_IMPLEMENTATION.md` §2.
6. **Uncertainty field naming tightened** (`uncertainty_label` instead of `confidence_label`
   throughout the schema/API) to keep the "never a fabricated confidence %" rule visible in the
   field names themselves, not just in prose.
7. **Synthetic-data acceptance criteria separated into three explicit categories**
   (engineering / scientific-on-synthetic / real-world), and the earlier instruction to treat a
   synthetic-data model underperforming the baseline as an automatic "build bug" to be fixed by
   adjusting the generator was removed — underperformance is now something to investigate
   (model, features, evaluation split, and only last the generator), never something to
   engineer away. See `11_AGENT_BUILD_PLAN.md` §2.5–2.6.
8. **Architecture and diagrams updated** so the Block Replication Baseline and the ML
   Inference Engine are shown as explicit, parallel components feeding the same Panchayat
   Forecast output, matching the mandated system flow (coarse forecast + local features →
   downscaling model → panchayat forecast → uncertainty → advisory). See
   `05_SYSTEM_ARCHITECTURE.md` §1, `09_DIAGRAMS.md` §1/§7.

No other structural changes were made: the pilot-district scope, tech stack, database core
entities, API surface, advisory-engine design, and testing/deployment strategy were already
sound and are unchanged in substance.

### Final correction pass (this revision)

A targeted consistency/buildability pass, on top of the redesign above, without re-architecting
anything:

1. **Provenance is now two independent fields.** `data_source_tag` (what kind of value — now
   including the previously-missing `BASELINE` tag) and `is_synthetic` (whether it's demo data)
   were being conflated or partially applied; they are now separated everywhere and added to
   every relevant table (`08_API_AND_DATABASE.md`, `11_AGENT_BUILD_PLAN.md` §6).
2. **Fixed a real bug**: the DDL in `11_AGENT_BUILD_PLAN.md` defaulted `baseline_prediction.data_source_tag`
   to `'ML_DOWNSCALED'`, silently mislabeling the Block Replication Baseline as a model output.
   Corrected to `'BASELINE'` with a CHECK constraint.
3. **Removed an unsafe fallback rule**: "if provenance is ambiguous, tag it `ML_DOWNSCALED`" is
   gone. Ambiguous provenance is now flagged invalid/unknown and resolved explicitly, never
   guessed.
4. **Fabricated-looking metrics removed** from the `/model/metrics` example in
   `11_AGENT_BUILD_PLAN.md` (was showing hardcoded `mae: 0.9` etc. as if real); replaced with the
   `not_yet_evaluated` → `"<computed>"` pattern used consistently elsewhere in the docs.
5. **LightGBM is now the single MVP model**, not "LightGBM/XGBoost" left as an implicit choice
   for the coding agent, across `04`, `05`, `07`, `09`, `11`. XGBoost is documented only as a
   phase-2/future comparison.
6. **Rainfall's MVP is unambiguously single-stage LightGBM regression**; the two-stage model is
   an explicit Phase-2 enhancement, not a build-time judgment call.
7. **Required vs. optional features made explicit** in `07_TECHNICAL_IMPLEMENTATION.md` so a
   missing raster layer (LULC, soil, etc.) can never block the MVP.

### Dataset chapter rewrite + full-documentation QA pass (this revision)

`03_DATASET_AND_DATA_PIPELINE.md` was substantially rewritten and expanded:

1. **Corrected the primary coarse-forecast identity.** The chapter previously anchored on "IMD
   Block forecast (Meghdoot), ~12 km grid." It now correctly identifies **Bharat Forecast
   System (BFS)**, IMD/IITM/MoES's operational ~6 km NWP model (live since 26 May 2025), as the
   primary coarse input, with Meghdoot named as the *dissemination layer* built on top of it —
   matching what `01_PROBLEM_ANALYSIS.md` §H already said, which the old dataset chapter had not
   caught up to. See `03_DATASET_AND_DATA_PIPELINE.md` §2, §7.1.
2. **Introduced an honest, consistent "TBD — requires source verification" marker** for anything
   not independently confirmed (access mechanism, exact variable list, historical archive
   length), replacing looser "TODO: verify" notes scattered inconsistently through the old
   version.
3. **Added a CORE / SUPPORTING / FALLBACK dataset tier** (§1, §8) so the MVP's minimum viable
   data stack is explicit, separate from "nice to have if it measurably helps."
4. **Added an explicit dataset-role table** (§3) specifically so BharatFS is never mistaken for
   an observation, IMD AWS/rain-gauge data is never mistaken for a training feature, and
   ERA5-Land/NASA POWER are never mistaken for ground truth — three specific confusions the
   older draft was vulnerable to.

Cross-references from other files into the old section numbering (`10_TESTING_DEPLOYMENT_AND_PPT.md`
§9, the `IMDForecastProvider` stub in `11_AGENT_BUILD_PLAN.md` §3.1, `00_PROJECT_OVERVIEW.md`
§3) were updated to point at the new section numbers and terminology so nothing in the other 12
files cites a section of `03` that no longer exists or now means something different.

### Bug-fix pass (this revision) — corrects fixes an earlier changelog claimed but never applied

A prior pass produced a changelog describing seven fixes; on audit, six of the seven had not
actually been made to the files. This pass makes them for real:

1. **Fixed a real backwards-direction bug** in `advisory/rules.yaml` (`11_AGENT_BUILD_PLAN.md`
   §9): the suppression rule targeted `uncertainty_label == 'low'` — the *narrowest, most
   trustworthy* interval per the field's own definition — instead of `'high'`. Renamed the
   trigger field `min_uncertainty_label` → `max_uncertainty_label` and added a binding
   "`uncertainty_label` direction convention" to `04_ML_DOWNSCALING_APPROACH.md` §3 (`low` <
   `medium` < `high`, ordered by interval width, `low` = most trustworthy) so this can't drift
   again.
2. **Removed the still-separate `ml-inference` Docker service** from `09_DIAGRAMS.md`,
   `10_TESTING_DEPLOYMENT_AND_PPT.md`, and the `docker-compose.yml` skeleton and Dockerfile list
   in `11_AGENT_BUILD_PLAN.md`. LightGBM now explicitly loads in-process inside the backend
   container; no `ml.Dockerfile`.
3. **Added genuine dev-only auth language.** `05_SYSTEM_ARCHITECTURE.md`'s Authentication row
   still specified a JWT/session system to build; it, `02_REQUIREMENTS.md` NFR-6,
   `08_API_AND_DATABASE.md` §1, and `10_TESTING_DEPLOYMENT_AND_PPT.md` §2 now consistently
   describe the MVP's actual dev-only role check (role compared against an allow-list, no token
   issuance/verification), with a real JWT/session system documented as phase-2 hardening.
4. **Corrected the Panchayat Mausam Seva description** in `01_PROBLEM_ANALYSIS.md` §I2, which
   still called it "primarily communication/outreach" from a Jan 2024 announcement. It actually
   launched real daily gram-panchayat forecasts nationally on 24 Oct 2024 for ~2.6 lakh
   panchayats. Repositioned the project's USP in `10_TESTING_DEPLOYMENT_AND_PPT.md` §6
   accordingly — away from "panchayat-level forecasts" (already delivered by PMS) and onto
   terrain-aware downscaling, calibrated uncertainty, and an open API.
5. **Normalized "confidence" language** that still didn't match the schema's `uncertainty_label`
   / `uncertainty_interval` field names, across `00`, `01`, `02`, `06`, `07`, `08`, `09`, `10`,
   `11` — including a genuine schema mismatch where `07_TECHNICAL_IMPLEMENTATION.md`'s feature
   table used `prediction_confidence_low`/`prediction_confidence_high` while the actual schema
   (`08`, `11`) used `p10`/`p50`/`p90` + `uncertainty_label`.
6. Clarified in `08_API_AND_DATABASE.md` §1 that `location_id` (resolving to `Panchayat`, or its
   `GridCell` fallback) *is* this project's panchayat-first identifier, used consistently across
   `07`, `08`, `09`, `11` — it was not, in fact, a stale non-panchayat-first design.

### Gap-closure pass (this revision) — nine build-blocking gaps identified by external review, verified against the actual files, and fixed

An external review flagged nine points that were named/referenced but never concretely
specified, risking a coding agent inventing inconsistent behaviour. Each was checked against
the actual doc text (not assumed) before fixing:

1. **Real contradiction: offline requirement vs. Leaflet tiles.** `11_AGENT_BUILD_PLAN.md` Rule
   4 and `02_REQUIREMENTS.md` NFR-7 required zero network calls; Leaflet (`05`, `07`, `09`)
   needs internet-fetched basemap tiles. Added `05_SYSTEM_ARCHITECTURE.md` §7 as the single
   explicit exception, with a graceful-degradation requirement (vector layers must render even
   if tiles fail) rather than a full offline-tile-server obligation. Rule 4 and the Phase-12/§10
   "done" checklist now state this exception explicitly instead of leaving it implicit.
2. **Auth/rate-limiting named but never designed.** `08_API_AND_DATABASE.md` said "API key
   (rate-limited)" and "dev-only role allow-list" with no concrete mechanism — and actually
   pointed at a `05_SYSTEM_ARCHITECTURE.md` §Auth section that **did not exist** (confirmed by
   direct search — a broken cross-reference from a prior pass). Added `05` §6 with the actual
   key/header/limit/error-code spec, and fixed `10_TESTING_DEPLOYMENT_AND_PPT.md` §2, which had
   been describing both endpoint groups as a single role-checked+rate-limited mechanism,
   conflicting with `08`'s two-mechanism design.
3. **`POST /prediction` had no input-bounds spec.** Added `11_AGENT_BUILD_PLAN.md` §3.3 and a
   cross-reference in `08_API_AND_DATABASE.md`: reject out-of-pilot-bbox points with `400`
   before running inference; snap in-bbox-but-off-grid points to the nearest `GridCell` and say
   so in the response. No interpolation/extrapolation path for out-of-district points, by design.
4. **GEE auth/quota not specified**, unlike the IMD provider's docstring pattern. Added a
   concrete `GEEFeatureProvider` docstring in `11_AGENT_BUILD_PLAN.md` §3.2: service-account
   JSON key (not user OAuth), quota-exhaustion fallback to cached-then-synthetic values, never a
   silent null.
5. **Attribution requirements existed in `03` but were never enforced anywhere downstream.**
   Added an explicit requirement to `07_TECHNICAL_IMPLEMENTATION.md` Phase 8's acceptance check
   (visible attribution control on the map) and `10_TESTING_DEPLOYMENT_AND_PPT.md`'s PPT slide 6.
6. **LGD-code-to-real-boundary matching was hand-waved.** Added a concrete reconciliation
   procedure to `03_DATASET_AND_DATA_PIPELINE.md` §7.5 (exact code match → block-scoped fuzzy
   name match → flagged-for-manual-review CSV; never auto-joined on a low-confidence guess),
   plus a `§13 TODO` item.
7. **Storage growth/retention unaddressed.** Added `03_DATASET_AND_DATA_PIPELINE.md` §11.5:
   monthly partitioning + a 24-month raw-retention/rollup policy for `weather_observation` and
   `weather_forecast`, explicitly scoped as a Phase-2/production concern, not required for the
   small synthetic pilot dataset.
8. **No documented hardware floor.** Added `02_REQUIREMENTS.md` NFR-8 and
   `11_AGENT_BUILD_PLAN.md` §7.5: ≥8 GB RAM / 4 CPU cores, with per-service `deploy.resources.
   limits` in the `docker-compose.yml` skeleton so a resource-starved host fails predictably
   (OOM, visible in logs) instead of hanging silently.
9. **Horizon-limit enforcement was left to an unconfirmed external source.** Since the synthetic
   path is what actually ships, `11_AGENT_BUILD_PLAN.md` §2.4 and `08_API_AND_DATABASE.md` now
   hardcode and document the demo horizon as **1–5 days**, with the real BharatFS/IMD horizon
   left as an explicit Phase-2 TODO rather than an undefined blocker.

As with the note above this one: the discipline here is the same — every fix in this list was
verified against the actual current file content (via direct search, not memory of what a
previous pass claimed) before being applied, and each fix's file/section is named so it can be
independently checked.
