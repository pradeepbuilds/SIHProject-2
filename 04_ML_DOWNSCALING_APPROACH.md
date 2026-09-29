# 04 — Machine Learning Downscaling Approach

## 0. Baseline correction (read this before anything else in this file)

An earlier draft of this project treated **IDW (inverse-distance-weighted) spatial
interpolation** as the primary baseline. That is not a meaningful baseline for this problem and
must not be used as the headline comparison, for a simple reason: **each Block issues exactly
one coarse forecast value**. IDW interpolates *between multiple known points*; with only one
value per block, "interpolating" it to every panchayat inside that block using IDW mathematically
collapses to copying that single value everywhere — it does no useful work, but *looks* like a
real spatial method, which risks presenting a trivial operation as if it were meaningful
downscaling.

The mandatory primary baseline is therefore the **Block Replication Baseline**:

```text
Panchayat prediction = Block forecast value  (same value assigned to every panchayat in the block)
```

This baseline answers the only question that actually matters for justifying the project:
*does the ML model provide panchayat-level variation and accuracy beyond simply copying the
block forecast to every panchayat in it?* Every ML result in this project is judged against
this number, not against IDW.

**IDW is retained only as an optional secondary baseline**, and only in the specific situation
where **multiple neighbouring blocks'** forecast values are available for the same date/variable
— in that case, IDW (or kriging) between neighbouring block-forecast points can produce a
genuinely different, non-trivial spatial surface, and it is reasonable to report it alongside
the Block Replication Baseline as a second, weaker point of comparison. IDW is never presented
as *the* baseline, and it is never computed from a single block's own value.

## 1. Approach comparison

| Approach | Input | Output | Training data need | Advantages | Disadvantages | Compute | Explainability | SIH prototype fit | Production fit |
|---|---|---|---|---|---|---|---|---|---|
| **Block Replication baseline (mandatory, primary)** | Single coarse block forecast value | Same value copied to every panchayat in the block | None | Trivial to implement, honestly represents "no downscaling happened," the correct floor to beat | Carries zero within-block spatial information by design — that's the point | Trivial | Full | **Required** as the primary baseline | Always available as a sanity floor |
| Spatial interpolation secondary baseline (IDW / kriging across **neighbouring blocks**) | Multiple neighbouring blocks' coarse forecast values | Local value | Minimal (a few neighbouring block values) | Only meaningful when more than one coarse value exists nearby; can be a genuinely non-trivial second baseline | Not usable at all with only one block's value (mathematically reduces to Block Replication); still ignores terrain/land-cover context | Trivial | Full | **Optional**, only if neighbouring-block data exists | Useful as a fallback when ML confidence is low |
| Random Forest / Extra Trees | Tabular: coarse features + static features | Local value per variable | Moderate (100s–1000s of paired samples) | Handles non-linear interactions, robust to noisy features, native feature importance, no GPU needed | Cannot model smooth spatial fields directly (needs tabular framing per point), limited extrapolation beyond training range | Low (CPU, minutes) | High (feature importance, easy SHAP) | **Excellent** | Good, with periodic retraining |
| LightGBM (chosen MVP model) / XGBoost (future alternative) | Same as above | Same | Same, slightly more sample-hungry for tuning | Typically higher accuracy than RF on tabular data, fast inference, quantile-loss variants give uncertainty for free | More hyperparameters to tune; slight overfitting risk with small pilot data | Low (CPU) | High (SHAP well-supported) | **Excellent — LightGBM is the selected MVP model; XGBoost is documented only as a phase-2 comparison, not a second MVP deliverable** | Good |
| CNN spatial downscaling | Coarse grid image + static raster stack | Fine grid image | Large (many spatial scenes) | Learns spatial patterns directly, good for grid-to-grid super-resolution | Needs substantially more training data than a pilot district can offer; harder to justify vs. tabular for point/panchayat targets | High (benefits from GPU) | Low-medium | Risky for pilot timeline/data volume | Good once data scales to multi-district |
| U-Net | Same as CNN | Fine grid image | Large | Strong for image-to-image super-resolution (proven in climate downscaling literature) | Same data-hunger issue; overkill for panchayat point/administrative-unit targets rather than continuous raster targets | High | Low-medium | Not recommended for MVP | Consider once grid-based (not panchayat-based) product is prioritised |
| ConvLSTM | Sequence of coarse+static grids | Sequence of fine grids | Large + long time series | Captures spatio-temporal dynamics | Highest data/compute need of all candidates | High | Low | Not recommended for MVP | Long-term research direction only |
| Graph Neural Network (panchayat adjacency) | Panchayat graph + features | Per-node value | Moderate-large | Naturally encodes neighbour relationships | Immature tooling for a student team, harder to explain to a jury, needs careful graph construction from imperfect boundary data (see dataset gap in `03`) | Medium | Low-medium | Not recommended for MVP | Interesting future extension |
| Hybrid statistical + ML (bias-correct baseline with ML residual model) | Baseline output + coarse/static features | Corrected local value | Moderate | Combines interpretability of a physical/statistical baseline with ML's ability to learn residual bias; naturally conservative when data is thin | Two-stage pipeline is slightly more engineering | Low | High | **Strong secondary candidate**, can be phase-2 upgrade | Strong |
| Physics-informed / constraint-aware ML | Any of the above + physical constraints (e.g., mass/energy bounds, monotonic elevation-temperature relationship) | Constrained local value | Same as base model + constraint definitions | Prevents physically implausible outputs (e.g., negative rainfall) | Requires domain constraint engineering | Low-medium | Medium-high | Apply as **post-processing constraints** on top of the chosen model, not a separate model | Recommended practice regardless of model choice |

## 2. Selected approach and justification

**Primary model: LightGBM, one model per weather variable, operating on a per-panchayat/grid-cell
tabular feature vector, trained with a quantile-loss objective to also produce prediction
intervals. LightGBM is the single default implementation for the coding agent — it is not a
choice to be made at build time.** XGBoost is documented as an **alternative model family for
future experimentation** (e.g., a phase-2 comparison once the LightGBM pipeline is validated),
and Random Forest is kept only as an internal sanity-check baseline during development, never as
a second MVP deliverable. The coding agent must not be asked to pick between LightGBM and
XGBoost for the MVP; building both in parallel and comparing them is explicitly out of scope
until the LightGBM pipeline is working end-to-end.

**Baseline for comparison: the Block Replication Baseline** (§0 above) — the block forecast
value copied to every panchayat in that block, with no spatial or static-feature information
at all. This establishes what "no real downscaling happened" looks like and is the number every
ML result must beat before being called an improvement. An **optional secondary baseline**
(IDW/kriging across neighbouring blocks) is reported alongside it only when multiple
neighbouring block values are available for the same date/variable.

Reasoning, against the required decision criteria:

- **Data availability**: only a pilot district's worth of paired coarse-forecast + static
  features + station observations will realistically exist by the SIH deadline. Tree ensembles
  are far more sample-efficient than CNN/U-Net/ConvLSTM, which need many spatial scenes to
  learn convolutional filters meaningfully.
- **Accuracy**: literature and practice consistently show tabular gradient boosting matches or
  beats deep nets on small-to-medium tabular/geospatial feature sets; the marginal deep-learning
  gain (if any) is not worth the added risk given (below) data volume.
- **Feasibility & timeline**: a tree ensemble trains in minutes on a laptop CPU; there is no
  GPU dependency risk for the demo.
- **Computational requirements**: CPU-only, consistent with NFR-7 (offline-runnable demo).
- **Explainability**: tree-based feature importance / SHAP values let the team show the jury
  *why* a panchayat's prediction differs from the block average (e.g., "elevation + NDVI pushed
  the temperature prediction down by 1.2 °C") — this directly satisfies the PS's implicit
  expectation of an explainable system, not a black box.
- **Deployment complexity**: a single `joblib`/ONNX-exported model per variable, served from a
  simple FastAPI inference endpoint — no custom tensor-serving infrastructure needed.

CNN/U-Net/ConvLSTM/GNN approaches are documented as **explicit future extensions** once the
system has scaled to multi-district training data (see `10_TESTING_DEPLOYMENT_AND_PPT.md` —
Future Extensions), not discarded outright.

## 3. Uncertainty mechanism

Chosen approach: **quantile regression via LightGBM's quantile objective**, training
three models per variable (e.g., 10th / 50th / 90th percentile) to produce a **prediction
interval** directly, supplemented by **ensembling** across a small set of bootstrap-resampled
models to get a variance-based confidence score as a cross-check. This is preferred over full
conformal prediction for the prototype because it is simpler to implement correctly under time
pressure, while still being a statistically grounded interval rather than an invented
"confidence %". Conformal prediction is documented as a **phase-2 hardening step** once more
historical data is available to calibrate it properly (it requires a held-out calibration set
separate from train/validation).

The UI must show, for every prediction: the point estimate, the interval width (visualised as
error bars or a shaded band), a qualitative `uncertainty_label` derived from interval width
relative to the variable's typical range (thresholds defined and documented, not implied), and a
data-quality flag if any input feature was missing or interpolated for that location.

### `uncertainty_label` direction convention (binding — do not invert)

`uncertainty_label` describes the **width of the prediction interval**, not a confidence score,
and its three values are ordered **`low` < `medium` < `high`** by how wide (untrustworthy) the
interval is:

| `uncertainty_label` | Interval width | Meaning |
|---|---|---|
| `low` | Narrow | The model's P10–P90 spread is small relative to the variable's typical range — the **most trustworthy** prediction |
| `medium` | Moderate | — |
| `high` | Wide | The model's P10–P90 spread is large relative to the variable's typical range — the **least trustworthy** prediction |

This is the opposite of everyday "high confidence / low confidence" phrasing — do not write logic
or copy that treats `uncertainty_label == "low"` as "less trustworthy" or `"high"` as "more
trustworthy." Anywhere this field feeds a threshold, gate, or suppression rule (e.g.
`advisory/rules.yaml`, `11_AGENT_BUILD_PLAN.md` §9), the rule must act on **`high`** as the
flagged/least-trustworthy case, never on `low`. The API and UI never rename this field or its
values to "confidence" (see `08_API_AND_DATABASE.md` §1) — that framing is exactly what caused
the earlier suppression-rule bug (fixed in `11_AGENT_BUILD_PLAN.md` §9).

## 4. Variable-specific modeling — this is not one universal "weather model"

The system is conceptually three (or more) independent models, not one:

```text
              Panchayat Downscaling
                       │
        ┌──────────────┼──────────────┐
        ↓              ↓              ↓
   Temperature      Rainfall       Humidity
      Model           Model          Model
        ↓              ↓              ↓
    P10/P50/P90    P10/P50/P90    P10/P50/P90
```

All variable models use the same MVP model family (**LightGBM**) trained separately per
variable — this keeps the implementation simple while still respecting that each variable has
different statistical behaviour (§5). CNN/U-Net/ConvLSTM/GNN approaches, and an XGBoost
comparison, remain explicit **future research extensions** (§ above), not part of the MVP for
any variable.

### MVP build order

Temperature is built, trained, and validated **first**, before rainfall is attempted, because
temperature is smoothly varying and terrain/elevation-driven — it is the easiest variable on
which to prove the whole pipeline (data → features → model → baseline comparison → uncertainty)
actually works end-to-end. Rainfall is added only once the temperature pipeline is validated.
Humidity and wind are optional stretch targets after both are working. See
`07_TECHNICAL_IMPLEMENTATION.md` §5 for the phased build order.

```text
Temperature MVP → Validation → Rainfall → Additional variables (humidity, wind — optional)
```

## 5. Rainfall requires different treatment than temperature

**Rainfall modeling is more difficult than temperature downscaling because rainfall is
intermittent and highly nonlinear** — it contains many exact-zero values (no rain) punctuated by
occasional large events, whereas temperature varies smoothly. Treating rainfall with the same
plain regression approach as temperature, without acknowledging this, risks a model that
predicts a bland "average drizzle" everywhere instead of correctly separating dry days from wet
ones.

**Recommended (advanced) approach — two-stage model:**

```text
Stage 1: Rain / No-Rain classification (binary)
              ↓
Stage 2: Rainfall amount, conditional on Stage 1 predicting rain
```

Stage 1 is a binary classifier (LightGBM classifier) predicting whether measurable rainfall
occurs; Stage 2 is a regression (LightGBM quantile regression) model trained only on the
rainy-day subset to predict the amount, conditional on rain occurring. This mirrors how rainfall
is actually distributed (a point mass at zero plus a skewed positive-continuous part) far more
honestly than a single regression.

**The MVP implementation is single-stage LightGBM regression — this is the one default the
coding agent builds, not a choice.** The known cost of this simplification (a blander fit on
dry/wet transition days, since one regressor has to represent both the zero-mass and the
skewed-positive part) must be stated explicitly in the evaluation report and PPT, not silently
assumed away. The two-stage classification-then-regression model above is documented purely as
an **optional Phase-2 enhancement**, attempted only after the single-stage MVP rainfall model is
built, evaluated against the Block Replication Baseline, and working end-to-end — never as an
alternative the coding agent picks between at MVP build time.

## 6. Explicit anti-pattern this design avoids

The team must **never** report a single "% accuracy" figure without stating: which metric
(MAE/RMSE/etc.), for which variable, on which split (random row split is explicitly disallowed
— see `07_TECHNICAL_IMPLEMENTATION.md` §training strategy for why), and over what date range.
Any number presented before the model is actually trained and evaluated is a placeholder and
must be marked **"TBD after Phase 6 evaluation"**, per project rule 2/3.
