# 00 — Project Overview

## 1. Restated problem

IMD/MoES currently issues (or is rolling out) weather forecasts at **Block** level — India has
roughly 6,700+ rural blocks, and IMD's Meghdoot agromet program has already operationalised
block-level forecasts for **~6,970 blocks** and block-level agromet advisories for **~3,100
blocks**, updated twice weekly. A newer "block-level monsoon forecast" initiative (AI-assisted,
up to 4-week validity) currently covers **3,196 blocks across 15 states + 1 UT**, and a
1 km × 1 km experimental model exists for Uttar Pradesh. This confirms the problem statement's
premise: block-level forecasting is real and growing, but a **Block** (average area order of
100–500 km²) still contains many Gram Panchayats, and terrain/land-cover/water/vegetation
variation within a block routinely causes real local weather (especially rainfall and
temperature extremes) to diverge from the block-average forecast.

PS 26074 asks for a system that **infers Panchayat/plot-level weather information from
Block-level forecasts**, using spatial statistical/ML relationships between coarse forecasts
and high-resolution local conditions (terrain, land cover, vegetation, soil, water), and turns
the result into **agro-meteorological advisory** content, with uncertainty communicated
honestly. Restated as a single flow:

```text
COARSE BLOCK-LEVEL FORECAST
             +
LOCAL HIGH-RESOLUTION FEATURES
             ↓
      DOWNSCALING MODEL
             ↓
PANCHAYAT-LEVEL WEATHER FORECAST
             ↓
       UNCERTAINTY
             ↓
AGRO-METEOROLOGICAL ADVISORY
```

The existing Block-level forecast (from IMD/Meghdoot, BFS, or the synthetic stand-in) is always
the **starting point**, not something this project re-derives. The ML system performs **local
spatial refinement/post-processing** of that forecast; it is not a new numerical weather
prediction (NWP) system, a generic weather app, a satellite-analytics product, a farm-management
system, an IoT weather-station platform, or a general agriculture-advisory app that happens to
use weather as one input. Every document in this set is written to keep that boundary clear.

## 2. Goals (this blueprint's scope)

1. A working **pilot-district** downscaling pipeline (1 district, its blocks, and their
   panchayats) — chosen to be small enough for a student team to build in an SIH timeline, and
   architected to scale to more districts/states without a redesign.
2. A **documented, reasoned dataset strategy** using only datasets that are actually
   researchable/accessible (Section 03).
3. A **baseline + one ML model** compared honestly (not "AI-powered" marketing).
4. An **uncertainty-aware** prediction output, never presented as ground truth.
5. A **separate, rule-based** agro-advisory layer.
6. A **map + dashboard** clearly distinguishing observation / forecast / downscaled-prediction.
7. REST APIs suitable for downstream consumption (state agri department systems, mobile apps).

## 3. Explicit non-goals (to avoid scope creep that kills SIH prototypes)

- This is **not** a new numerical weather prediction (NWP) model. The system statistically
  refines an existing coarse forecast; it does not re-run atmospheric physics.
- It does **not** claim nationwide panchayat-boundary coverage on day one (no such single open
  dataset exists — see `03_DATASET_AND_DATA_PIPELINE.md` §7.5 LGD, §7.7 LULC).
- It does **not** promise real-time (sub-hourly) updates; the underlying coarse forecast
  (BharatFS/IMD) runs on a daily forecast cycle and the Meghdoot advisory layer built on it
  updates twice weekly, while most supporting Earth-observation layers update at best daily (a
  few hours' to days' latency) — so the system's realistic refresh cadence is **daily**.
- It does **not** replace an agronomist; the advisory engine issues guidance with an explicit
  `uncertainty_label`/interval and a disclaimer, not a directive.

## 4. Success criteria for the SIH prototype

| Criterion | Target for demo |
|---|---|
| Spatial scope | 1 district, all its blocks, all their panchayats (or a representative subset if panchayat boundaries are unavailable for that district — see limitations) |
| Downscaled variables | **Temperature (max/min) built and validated first**, as the primary MVP target (smoothly varying, easiest to prove the pipeline on); **rainfall (next-day/next-5-day) built second**, once temperature is validated, with its own two-stage-vs-single-stage tradeoff documented (`04_ML_DOWNSCALING_APPROACH.md` §5); humidity and wind are optional stretch targets only if time remains — see `07_TECHNICAL_IMPLEMENTATION.md` §5 |
| Model comparison | At least: **Block Replication Baseline** (block forecast copied to every panchayat — the mandatory primary baseline, `04_ML_DOWNSCALING_APPROACH.md` §0) vs. one tree-ensemble ML model, evaluated on held-out **panchayats/grid cells not seen in training** (spatial split); an optional IDW-across-neighbouring-blocks secondary baseline is reported only where multiple neighbouring block values exist |
| Uncertainty | Every downscaled value ships with an `uncertainty_label`/`uncertainty_interval` (ensemble spread or quantile interval — not a single fabricated "accuracy %" or "confidence" score) |
| Advisory | At least 3 rule-based advisory types (heavy-rainfall alert, irrigation suggestion, heat-stress alert) driven by downscaled output + simple crop-stage input |
| Traceability | Every value on the dashboard carries a `data_source_tag` (OBSERVED / FORECAST / BASELINE / ML_DOWNSCALED) and an independent `is_synthetic` flag |
| Docs | This documentation set, complete and internally consistent, precedes the code |

## 5. Stakeholders / actors (detailed in `06_WORKFLOW_AND_USE_CASES.md`)

Farmer, Agricultural Officer, Block/Panchayat Officer, District Administration,
IMD/data-provider role (external, read-only from this system's point of view), System
Administrator, ML/Data Scientist.

## 6. Relationship to other documents

- Why downscaling is needed and which variables are safe to downscale → `01_PROBLEM_ANALYSIS.md`
- What data actually exists to do this → `03_DATASET_AND_DATA_PIPELINE.md`
- How the ML works → `04_ML_DOWNSCALING_APPROACH.md`
- How it's built → `05_SYSTEM_ARCHITECTURE.md`, `07_TECHNICAL_IMPLEMENTATION.md`
