# 01 — Problem Analysis

## A. What "weather downscaling" means

Downscaling is the process of deriving finer spatial/temporal resolution weather information
from coarser-resolution weather information, using either physical modelling or statistical
relationships between the coarse field and known local characteristics. It does not invent new
atmospheric physics for the fine grid — it **redistributes and adjusts** the coarse signal
using local context.

## B. Types of downscaling

| Type | What changes | Method family | Relevant here? |
|---|---|---|---|
| **Spatial downscaling** | Grid/administrative resolution (Block → Panchayat) | Statistical/ML/interpolation | **Yes — core of this project** |
| **Temporal downscaling** | Time resolution (e.g., daily → 3-hourly) | Statistical disaggregation, diurnal cycle models | Secondary; only if the advisory needs sub-daily granularity (e.g., spraying window) |
| **Statistical downscaling** | Empirical relationship between coarse predictors and local observations (regression, ML, quantile mapping) | Needs historical paired data | **Yes — primary technique selected** (see 04) |
| **Dynamical downscaling** | Re-running a physical regional climate/weather model (e.g., WRF) at high resolution | Needs HPC, NWP expertise, boundary conditions | Out of scope for a student SIH team; IMD/IITM already do this at block level via WRF-class systems — this project consumes their output rather than re-deriving it |
| **Machine-learning downscaling** | Learned mapping from coarse fields + static high-res features → local variable | Tree ensembles, CNN/U-Net, ConvLSTM | **Yes — this is what "statistical downscaling" is implemented as here** |

## C. Why Block-level forecasts are insufficient for Panchayat/farm decisions

- A rural Block in India typically spans on the order of **100–500+ km²** and can contain
  dozens of Gram Panchayats. IMD's own block forecasts are generated on grids on the order of
  **12 km × 12 km** (per IMD's own description of its experimental block forecasts) — i.e. one
  or a few grid cells per block, reported as a single block value.
- Rainfall in particular is **convective and highly spatially discontinuous** in many parts of
  India (especially pre-monsoon and monsoon-break conditions); a single block-average value can
  mask a panchayat that received a cloudburst and a neighbouring panchayat that received none.
- Sowing, irrigation-timing, spraying, and harvest decisions are made **at the field/panchayat
  level**, not the block level — a farmer needs to know about *their* panchayat, not a 12 km
  average that may be dominated by a different micro-climate zone within the block.

## D. Why weather varies within a Block

- **Terrain/elevation** changes air temperature (lapse rate, ~6.5 °C/km) and can trigger
  orographic rainfall on windward slopes while leeward areas stay dry.
- **Slope and aspect** affect solar exposure, soil moisture retention, and local heating.
- **Land cover** (forest vs. bare soil vs. built-up) changes surface albedo, evapotranspiration,
  and the urban-heat-island effect even at small scale.
- **Vegetation density** (captured via NDVI) modulates local humidity and temperature through
  transpiration.
- **Proximity to water bodies** (rivers, tanks, reservoirs) moderates local temperature swings
  and can enhance local humidity/fog.
- **Soil type/moisture** affects how quickly land heats/cools and how rainfall translates into
  runoff vs. infiltration, which feeds back into local humidity.

## E. How terrain/land cover etc. are actually used

These are not "vibes" — each becomes a **quantifiable static feature** attached to every
panchayat/grid-cell record (see the feature table in `07_TECHNICAL_IMPLEMENTATION.md`):
elevation & slope & aspect (from a DEM), land-cover class (from LULC classification), NDVI/NDWI
(from optical satellite indices), soil texture/class (from soil survey products), distance to
nearest water body (computed via GIS from a water-body layer). The ML model learns, from
historical data, how the *coarse forecast* combined with *these static local features* predicts
the *actual local observed value* better than the coarse forecast alone.

## F. What "high-resolution plots/data/variables" means in practical implementation

For an SIH-timeline prototype, "high resolution" is **not** farm-plot-boundary resolution
(individual field polygons are not available as a public dataset at national scale). It is
implemented as one of, in increasing order of ambition:

1. **Panchayat-level** administrative units (the level explicitly named in the PS title) — the
   primary target representation for this project.
2. A **regular grid** (e.g., 1 km × 1 km) inside each block, used as an intermediate
   computational representation before aggregation to panchayats (see spatial representation
   in `07_TECHNICAL_IMPLEMENTATION.md`, §2).
3. Individual **farm plots** are a stated future extension only, gated on availability of
   plot-boundary data (e.g., state land-records/Bhu-Naksha data), not a Phase-1 deliverable.

## G. Variables that should be downscaled

| Variable | Rationale |
|---|---|
| Rainfall (daily/next-5-day) | Highest spatial variability, highest agricultural relevance |
| Max/Min temperature | Smoothly varying, terrain/elevation-driven, statistically tractable |
| Relative humidity | Needed for disease/fungal-risk and evapotranspiration-based advisories |
| Wind speed (surface) | Needed for spraying-window advisories |

## H. Variables that should NOT be blindly downscaled

- **Extreme/rare events** (cyclonic wind gusts, hail, cloudbursts): sample sizes are too small
  for a statistical model to learn a reliable local correction; these should continue to be
  sourced from IMD's **nowcast/warning services** directly (3-hourly warnings, ~1,019 stations)
  rather than "downscaled," and the dashboard must say so.
- **Pressure fields**: at the panchayat scale, sea-level/surface pressure differences within a
  block are physically minor and not agriculturally actionable; downscaling this variable adds
  complexity without benefit.
- Any variable for which there is **no local ground-truth/observation** to validate against —
  downscaling without a way to check the result against reality is guessing, not modelling; the
  system should refuse to serve a variable it cannot validate and should say so explicitly.

## I2. Why this is still needed given IMD's own recent panchayat-level initiatives

Two developments must be addressed head-on, since a jury familiar with recent IMD news will
raise them:

- **"Panchayat Mausam Seva" (PMS)** — this is **not** just an outreach initiative and must not be
  understated as one. IMD (with the Ministry of Panchayati Raj and MoES) actually **launched
  real daily gram-panchayat-level forecasts nationally on 24 October 2024**, covering
  temperature, rainfall, relative humidity, wind and cloud cover for nearly all **~2.6 lakh
  panchayats**, disseminated via the Panchayat Mausam Sewa portal (mausam.imd.gov.in/greenalerts),
  Mausamgram, e-GramSwaraj and the Meri Panchayat app, and pushed to panchayat
  secretaries/ward members/sarpanches — hourly out to 36h, 3-hourly out to 5 days, 6-hourly out
  to 10 days. This is a **live, national, per-panchayat forecast product**, confirmed still
  active as of Feb 2026, not a future intent. Underlying grid resolution for these forecasts is
  reported as ~12 km (with experimental 3 km output and a stated 1 km hyper-local goal) — so the
  *dissemination* is panchayat-level even where the *dynamical* grid underneath it is not yet.
- **Bharat Forecast System (BFS)** — launched May 2025 by MoES/IITM (with IMD, NCMRWF), a
  **6 km resolution** indigenous global NWP model explicitly designed to resolve forecasts to
  the **panchayat-cluster (i.e., block-level)** grid, replacing the older ~12 km experimental
  grids referenced elsewhere in this document.

**Implication for this project:** given PMS already delivers a named, per-panchayat forecast at
national scale, "nobody forecasts at panchayat level" is not a defensible USP and must not be
claimed. Both PMS's dissemination and BFS's ~6 km dynamical grid still fall short in the same
concrete ways: neither incorporates panchayat-specific static context (elevation, NDVI, soil,
distance to water) as an explicit, inspectable correction term, and neither ships a calibrated,
per-location uncertainty interval — a PMS/BFS-quality point forecast is delivered with no stated
error bar a farmer or officer can act on with a defined confidence, and no open, documented API
for third parties to build on. This project's contribution, restated honestly: **statistically
post-process/downscale whatever coarse-grid product is available (PMS/BFS output, Meghdoot's
~12 km grid, or a fallback reanalysis) onto explainable, uncertainty-quantified panchayat-level
values, exposed through an open, documented API** — the same architecture works regardless of
which coarse product improves underneath it. The honest USP is **explainability (SHAP/feature
importance), calibrated uncertainty (`uncertainty_label`/interval, not a fabricated accuracy %),
and an open API for third-party integration** — not "nobody does panchayat level." This should
be stated explicitly in the PPT (Slide 3) so it reads as informed by, and differentiated from,
PMS/BFS rather than contradicted by them.
**TODO before build:** confirm current public BFS/Meghdoot/PMS output resolution and access
terms directly with MoES/IMD, since this is a fast-moving area and the specifics here are
current as of writing, not guaranteed unchanged by build time.

## I. How this supports agro-meteorological advisory

Once a panchayat-level rainfall/temperature/humidity estimate (with uncertainty) exists, a
**separate rule engine** (see `04` and `05`) can apply agronomic thresholds — e.g. "≥ 50 mm
rain expected in 24h and `uncertainty_label` is `low` (narrow interval, trustworthy) → delay irrigation / warn of
waterlogging risk for low-lying panchayats," or "max temp forecast > threshold during flowering stage of the locally
registered crop → heat-stress advisory." This mirrors IMD's own existing model (Gramin Krishi
Mausam Sewa issuing agromet advisories from weather forecasts twice weekly) but at a finer
spatial grain and with an explicit `uncertainty_label`/interval communicated to the user.

 # #   J .   A u d i t   o f   P S   R e q u i r e m e n t s   A l i g n m e n t 
 
 |   R e q u i r e m e n t   |   S t a t u s   |   N o t e s   | 
 | - - - | - - - | - - - | 
 |   D   ( H i g h - r e s o l u t i o n   s p a t i a l   i n f o r m a t i o n )   |   * * P A R T I A L L Y   A L I G N E D * *   |   T h e   a r c h i t e c t u r e   c o n d i t i o n s   o n   l o c a l   f e a t u r e s ,   b u t   t r a i n s   d i r e c t l y   o n   p a n c h a y a t s   i n s t e a d   o f   t h e   1 k m   c o m p u t a t i o n a l   g r i d   l a y e r .   S e e   d o c s / D E V I A T I O N S . m d .   |  
 

## J. Audit of PS Requirements Alignment

| Requirement | Status | Notes |
|---|---|---|
| D (High-resolution spatial information) | **PARTIALLY ALIGNED** | The architecture conditions on local features, but trains directly on panchayats instead of the 1km computational grid layer. See docs/DEVIATIONS.md. |
