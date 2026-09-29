# KrishiMitra — 12-Slide Competition Pitch Deck Outline

> Optimized for a 7-minute presentation followed by a 3-minute Q&A. Every slide designates exact visual assets, charts, and required attributions.

---

### Slide 1: Title & Vision
- **Header:** KrishiMitra: Weather Intelligence for Every Panchayat
- **Sub-header:** Probabilistic Agro-Meteorological Downscaling for Indian Smallholders
- **Visual Assets:** Official Sprout Logo (`logo.svg`), Hero screenshot of KrishiMitra Map Dashboard.
- **Key Bullet Points:**
  - Block forecasts (25 km) fail to resolve hyper-local agricultural weather risks.
  - KrishiMitra delivers verified, calibrated, stage-aware intelligence directly to the panchayat level.
  - Deployed across 4 distinct agro-climatic zones with zero-manual-step configuration.

---

### Slide 2: The Core Problem — The Resolution Gap
- **Header:** Why Block Forecasts Fail Indian Farmers
- **Visual Assets:** Side-by-side graphic: 25 km Block boundary vs 12 distinct panchayat terrain profiles.
- **Key Bullet Points:**
  - Micro-climatic variation: Orographic lift, valley inversions, and localized convective storm cells.
  - Real-world failure mode: Block forecast says 4 mm; windward panchayat gets 55 mm cloudburst.
  - The human cost: Ruined pesticide sprays, flooded seed beds, unmitigated heat stress.

---

### Slide 3: Our Solution — KrishiMitra
- **Header:** Scalable, Calibrated Panchayat Weather Intelligence
- **Visual Assets:** High-level platform screenshot highlighting the Farmer View vs Officer View.
- **Key Bullet Points:**
  - Bridges 10–25 km numerical weather models down to panchayat terrain features.
  - Decoupled two-stage Hurdle model for intermittent precipitation.
  - Clear dual interfaces: Farmer View (plain-language guidance) & Officer View (district surveillance).

---

### Slide 4: Farmer Experience — Actionable, Jargon-Free Guidance
- **Header:** Built for Real Farmers, Not Meteorologists
- **Visual Assets:** Screenshot: `docs/screenshots/map_farmer_desktop.png` (Headline sentence, 5-day strip, SMS copy).
- **Key Bullet Points:**
  - Deterministic headline: "Rain is likely (about 84%). Expect around 58 mm."
  - Stage-aware crop advisories (Ragi, Groundnut, Wheat, Rice, Cotton, Mango).
  - Native multi-lingual translation: English, Hindi, Kannada, Marathi.
  - One-click 240-character SMS copy for low-bandwidth rural delivery.

---

### Slide 5: Officer View & Institutional Operations
- **Header:** District-Wide Surveillance & 1-Click Official Bulletins
- **Visual Assets:** Screenshot: `docs/screenshots/map_officer_desktop.png` & `docs/screenshots/bulletin_view.png`.
- **Key Bullet Points:**
  - Real-time tabular surveillance of all panchayats in the district with severity chips.
  - CSV export for block agriculture extension officers and disaster teams.
  - Printable official 1-page Agrometeorological Advisory Bulletin styled via browser print CSS.

---

### Slide 6: Rigorous Machine Learning Architecture
- **Header:** The Hurdle Model & Quantile Downscaling Engine
- **Visual Assets:** Inline pipeline architecture diagram from `MethodPage` (`/method`).
- **Key Bullet Points:**
  - Zero-inflation hurdle: Isotonic calibrated classification (`P(Rain >= 1.0mm)`).
  - Conditional quantile amount: LightGBM regressors for P10, P50, P90 on wet instances.
  - TreeSHAP feature contributions explain why local forecast differs from the block average.

---

### Slide 7: Scientific Verification — Spatial Holdout Validation
- **Header:** Proving Skill on Completely Unseen Panchayats
- **Visual Assets:** Screenshot: `docs/screenshots/insights_desktop.png` (Skill vs Lead Time & Timeline charts).
- **Key Bullet Points:**
  - Strict spatial holdout: 23 panchayats in Tumakuru strictly withheld from training.
  - Fair comparison: Coarse baseline and ML evaluated on identical holdout test locations.
  - Results: **+41.5% MAE improvement** over block baseline across all 1 to 5 day forecast horizons.

---

### Slide 8: Uncertainty Quantification & Conformal Calibration
- **Header:** Honest Error Bounds: The 80% Prediction Interval
- **Visual Assets:** Reliability curve chart (`insights_calibration.png`) with the 80% nominal target line.
- **Key Bullet Points:**
  - Raw predictions calibrated via conformal quantile techniques on a spatial calibration set.
  - Verified holdout coverage: 81.2% empirical coverage of the [P10, P90] interval.
  - Balanced tail error rates: 9.5% below P10, 9.3% above P90.

---

### Slide 9: Config-Driven Scalability — 700+ Districts
- **Header:** Adding a District with One Declarative YAML File
- **Visual Assets:** Code snippet of `regions/ka-tumakuru.yaml` and the CLI build command.
- **Key Bullet Points:**
  - No hardcoded coordinates, bounding boxes, or village names in application code.
  - 4 Shipping zones: Semi-arid Plateau, Konkan Coast, Indo-Gangetic Plain, Thar Desert.
  - Adding a 5th district: 1 YAML file + `python -m krishimitra.cli region build --region <id>` (2 min run).

---

### Slide 10: Technical Stack & Offline-First Engineering
- **Header:** Lightweight, Containerized, Zero-Manual-Step Startup
- **Visual Assets:** Docker compose topology diagram & terminal output of `docker stats`.
- **Key Bullet Points:**
  - Total stack memory budget: Under 1.5 GB RAM (runs on 8 GB RAM / 4 cores).
  - Multi-stage Nginx frontend + FastAPI backend + PostGIS database.
  - Bundled fonts and vector layers; degrades gracefully without internet or OpenStreetMap tiles.

---

### Slide 11: Data Provenance & Ethical Disclosures
- **Header:** Complete Scientific Transparency: Real vs Synthetic
- **Visual Assets:** Provenance matrix table from `docs/DATA_SOURCES.md`.
- **Required Attributions:**
  - District Boundaries: *geoBoundaries ADM2 (Runfola et al., 2020), CC BY 4.0.*
  - Topographic DEM: *NASA SRTM 90m Elevation Data.*
  - Climatological Normals: *NASA POWER & IMD Agrometeorological Climatology.*
  - OpenStreetMap: *© OpenStreetMap contributors (ODbL).*
- **Ethical Commitments:**
  - Clearly disclose calibrated synthetic meteorological inputs.
  - Refusal to claim unverified "1 km" pixel precision.

---

### Slide 12: Roadmap to National Field Deployment & Q&A
- **Header:** Deployment Roadmap: From Competition to 100,000 Villages
- **Visual Assets:** Photo collage of KVK field trials and KrishiMitra team.
- **Key Bullet Points:**
  - Phase 1: Connect live MQTT/REST telemetry from State Disaster Management AWS networks.
  - Phase 2: Agronomic threshold validation workshops with ICAR / local KVKs.
  - Phase 3: District pilot deployment with WhatsApp and SMS bulletin distribution.
  - **KrishiMitra: Weather intelligence for every panchayat.**
