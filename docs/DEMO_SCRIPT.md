# KrishiMitra — 6 to 8 Minute Live Competition Demo Script

> This script is rehearsed for competitive judging panels. It directly addresses judging criteria: technical depth, real-world utility, honest claims, architectural scalability, and refined UI ergonomics.

---

## Demo Overview (Timing Budget: 7m 30s)

| Act | Phase | Focus | Duration |
|---|---|---|---|
| **Act 1** | The Problem | The coarse forecast failure: block average says 0 mm, but convective rain drowns the farmer | 1m 00s |
| **Act 2** | Farmer Experience | Plain language headline, 5-day strip, crop advisories, SMS copy, "Why?" explainability | 1m 30s |
| **Act 3** | Officer GIS & Alerts | Multi-panchayat surveillance, sort/filter, 1-click printable PDF bulletin | 1m 00s |
| **Act 4** | Rigorous ML & Analytics | Insights dashboard: spatial holdout skill, hurdle model, uncertainty calibration | 1m 30s |
| **Act 5** | Config-Driven Scalability | Live district addition via YAML in 30 seconds | 1m 30s |
| **Act 6** | Scientific Honesty & Q&A | Data provenance disclosure: what is real, synthetic, and next steps | 1m 00s |

---

## Detailed Act-by-Act Walkthrough

### Act 1: The Problem (1:00)
- **Action:** Open `http://localhost:5173/` in Google Chrome (Desktop 1366x768). Default region: `Karnataka — Tumakuru`. Theme is clean agricultural light mode.
- **Narrator Speaks:**
  > *"Judges, current weather forecasts in India are issued at the block level (15 to 25 km across). But Indian agriculture doesn't happen at 25-kilometer averages. 
  > In semi-arid plateaus and coastal ghats, convective clouds drop 60 mm of rain on one hillside while the block headquarters 12 kilometers away gets nothing.*
  > 
  > *Look at our scenario bar: let's click 'Heavy rain — 14 Jul 2025'. Notice what happened: The coarse block forecast reported an average of 4.2 mm. But down at Panchayat 12 on the windward slope, KrishiMitra's downscaling engine predicts 58 mm with 84% probability. A farmer relying on the block forecast would spray expensive pesticides and watch them wash away."*

### Act 2: Farmer Experience (1:30)
- **Action:** Click on the high-rainfall panchayat on the map. Point out the right-hand **Forecast Card** in **Farmer View**.
- **Narrator Speaks:**
  > *"Farmers do not want raw math or confusing probability distributions. Look at our Farmer View:
  > 1. A single plain-language headline sentence: 'Rain is likely (about 84%). Expect around 58.2 mm, up to 74.0 mm if it turns heavy.'
  > 2. A 5-day outlook strip with daily expected millimeters, rain chance, and temperatures.
  > 3. Stage-aware crop advisories: for Ragi at the flowering stage, it warns: 'Heavy rainfall expected within 24h. Delay nitrogen top-dressing and verify drainage.'
  > 4. Click 'Why did this rule trigger?': We show the farmer exactly why — rainfall exceeded the 50 mm threshold with 84% probability.
  > 5. Click 'Why this differs from the block forecast': Local elevation is +140 meters higher, causing orographic lifting.
  > 6. Language Switcher: Switch to ಕನ್ನಡ (Kannada) or हिंदी (Hindi). The entire interface, headline, and advisory seamlessly render in the native tongue without page reloading.
  > 7. Click 'Copy SMS': Produces a 240-character clean bulletin text ready for low-bandwidth WhatsApp or SMS transmission."*

### Act 3: Officer View & Printable Bulletin (1:00)
- **Action:** Click the **Farmer / Officer** toggle in the header.
- **Narrator Speaks:**
  > *"Now switch to the Officer View. A District Agricultural Officer or Tahsildar needs district-wide surveillance.
  > Below the map, a sortable, filterable operations table instantly reveals which panchayats are in 'Warning' status. The officer can filter by 'Warning Only', sort by rainfall, and click 'Export CSV' for field teams.
  > 
  > Even better: click 'Print Bulletin'. 
  > This opens a dedicated one-page Agrometeorological Advisory Bulletin styled with high-contrast print typography. Pressing Ctrl+P gives a clean, institutional PDF with official headers, synopsis, forecast tables, and signature blocks — formatted entirely in browser print CSS so Indic scripts render flawlessly."*

### Act 4: The Analytics Dashboard — Methodological Depth (1:30)
- **Action:** Navigate to the **Insights** tab (`/insights`).
- **Narrator Speaks:**
  > *"Other teams show a dashboard that simply plots synthetic weather. We built a machine learning validation cockpit:
  > 1. Look at KPI 3: '+41.5% ML Improvement over Baseline'. This is evaluated on **23 held-out test panchayats** that the model never saw during training. We never evaluate on random row splits.
  > 2. Chart 1 (Forecast Timeline): Shows local P50 resolving micro-climatic peaks, flanked by the [P10, P90] 80% confidence band.
  > 3. Chart 2 (Forecast Evolution): Traces how forecasts issued at T-5, T-4, down to T-1 converge on the observed ground truth.
  > 4. Chart 3 (Skill vs Lead Time): Demonstrates that across all 1 to 5 day horizons, local LightGBM models consistently beat coarse block replication.
  > 5. Chart 4 (Uncertainty Calibration): The 80% prediction interval contains 81.2% of holdout observations. Tail error rates are balanced at ~9.5% each.
  > 6. Every chart features a computed takeaway title, a 'View as Table' accessible fallback, and CSV export."*

### Act 5: Config-Driven Scalability (1:30)
- **Action:** Open terminal or show the region config directory (`regions/`).
- **Narrator Speaks:**
  > *"How does KrishiMitra scale to all 700+ districts of India?
  > We do not hardcode bounding boxes or rules in Python or TypeScript. Everything is driven by a single YAML file in `regions/<region_id>.yaml`.
  > We ship 4 distinct agro-climatic zones today:
  > - `ka-tumakuru` (Southern dry plateau)
  > - `mh-ratnagiri` (Konkan coastal mountains, 3000mm monsoon rain)
  > - `pb-ludhiana` (Northern irrigated plain, wheat-rice rotation)
  > - `rj-jodhpur` (Western Thar desert, extreme heat)
  > 
  > Adding a 5th district takes one YAML file and running `python -m krishimitra.cli region build --region <id>`. Within 2 minutes, boundary clipping, terrain feature generation, LightGBM training with `n_jobs=2`, and calibration exports are complete and live in the UI."*

### Act 6: Scientific Honesty & Provenance (1:00)
- **Action:** Navigate to the **Method** tab (`/method`).
- **Narrator Speaks:**
  > *"Finally, judges, our commitment to scientific honesty:
  > In the Method page, we provide an inline architecture diagram and our Real vs Synthetic Data Matrix:
  > - District outlines are 100% real official geoBoundaries.
  > - Sub-district boundaries are clearly marked as illustrative Voronoi partitions because official panchayat GIS polygons are not published as open data.
  > - Weather fields are calibrated-synthetic shaped by NASA POWER and IMD monthly normals.
  > - We never claim 1 km pixel precision because current inference is panchayat-level.
  > - We openly disclose the synthetic-world caveat: when state governments connect live AWS telemetry, this exact containerized pipeline trains on real data with zero architectural changes.*
  > 
  > *KrishiMitra: Weather intelligence for every panchayat. We welcome your questions."*

---

## Contingency & Fallback Plans

| Failure Mode | Fallback Procedure |
|---|---|
| **Basemap OpenStreetMap tiles fail / No Internet** | The vector map layer automatically renders on a soft `--surface-2` canvas. Explain: *"The platform is offline-first; all models, fonts, and boundaries are bundled. Only OSM tiles use the web, and our UI degrades gracefully without them."* |
| **API Container Restarting / Lagging** | Use the cached local responses or query `ka-tumakuru` which has pre-rendered and pre-warmed in-memory cache structures. |
| **Print Dialog Stalls** | Point to the pre-rendered bulletin view on screen which already renders in standard A4 sheet format. |
