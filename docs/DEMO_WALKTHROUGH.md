# SIH 26074 - Live Demonstration Script & Walkthrough

This document outlines the exact 5–10 minute demonstration workflow for SIH 2026 Problem Statement 26074 (*Weather Downscaling from Block Level to Panchayat Level*).

---

## 1. Demo Overview

- **Target Audience:** SIH Evaluation Panel & Domain Experts (IMD / Ministry of Earth Sciences).
- **Core Narrative:** How physics-guided and terrain-aware ML statistical downscaling closes the spatial granularity gap between coarse NWP/IMD block forecasts (~10–25 km) and localized gram panchayat topography (~1–3 km).
- **Environment:** Standalone local deployment (`http://localhost:5173`) running with synthetic pilot data for Tumakuru district, Karnataka.

---

## 2. 10-Step Judging Walkthrough

### Step 1: System Overview & Provenance Transparency
- **Action:** Open Dashboard (`http://localhost:5173`).
- **Talking Point:** Point out the amber **"Synthetic Testbed Active"** header banner. Emphasize that every data point carries explicit provenance tags (`data_source_tag: OBSERVED / FORECAST / BASELINE / ML_DOWNSCALED` and `is_synthetic: true`) to maintain scientific integrity.

### Step 2: District & Coarse Block Forecast
- **Action:** Select **State: Karnataka** $\rightarrow$ **District: Tumakuru** $\rightarrow$ **Block: Block 1**.
- **Talking Point:** Show the coarse numerical weather prediction forecast issued for the entire block (e.g. 15 mm rain, 31.2°C max temp). Explain that standard IMD forecasts treat every village in this block identically.

### Step 3: Panchayat Selection & Downscaled ML Output ("Aha!" Moment)
- **Action:** Select **Panchayat A** within Block 1, then compare with **Panchayat B**.
- **Talking Point:** Highlight how Panchayat A (situated near higher elevation or vegetative cover) receives a downscaled forecast that differs from Panchayat B within the same block, demonstrating that the spatial resolution problem is genuinely solved.

### Step 4: Map Layer Comparison (Choropleth Toggle)
- **Action:** Toggle between **"Coarse Baseline"** and **"Downscaled ML"** on the Leaflet map.
- **Talking Point:** The coarse view displays monolithic, uniform polygon blocks. Switching to the ML Downscaled layer reveals high-resolution micro-climate spatial variation across panchayats.

### Step 5: Uncertainty Interval & Quantile Badges
- **Action:** Hover over the **Uncertainty Badge** (`LOW` / `MEDIUM` / `HIGH`).
- **Talking Point:** Explain that predictions are not single "black-box" numbers; the model outputs quantile intervals ($p_{10}, p_{50}, p_{90}$). The uncertainty badge reflects interval width ($p_{90} - p_{10}$), providing trustworthy decision support rather than fabricated confidence percentages.

### Step 6: Feature Contribution & Local Terrain Awareness
- **Action:** View the location metrics card (Elevation, NDVI, Slope).
- **Talking Point:** Show that local environmental features (elevation differences, vegetation density) explain *why* this panchayat's forecast deviates from the block average.

### Step 7: Agro-Advisory Rules Engine
- **Action:** Select Crop **"Ragi"** and Stage **"Flowering"**.
- **Talking Point:** The advisory engine dynamically evaluates model predictions against phenological vulnerability thresholds. If forecast uncertainty is high, advisories automatically append the caution prefix: `"[Informational only — wide forecast uncertainty]"`.

### Step 8: Historical Trend & 7-Day Lead Time
- **Action:** Inspect the 7-day forecast trend chart.
- **Talking Point:** Note how prediction intervals naturally widen with lead time ($T+1$ to $T+7$), physically reflecting atmospheric forecast divergence.

### Step 9: Honest Model Metrics & Baseline Comparison
- **Action:** Click **"Model Metrics"** in the top navigation.
- **Talking Point:** Display the validation metrics honestly computed on the spatial holdout test split. Show MAE and RMSE improvements of ML downscaling over the Block Replication Baseline.

### Step 10: Scaling Roadmap & Closing
- **Action:** Close the modal and show API documentation (`/docs`).
- **Talking Point:** Explain that the pilot district architecture is modular and ready to scale statewide by ingesting real-time BharatFS grids, NRSC Bhuvan LULC, and IMD AWS stations.
