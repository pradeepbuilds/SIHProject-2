# 09 — Diagrams

## 1. High-level system architecture

```mermaid
flowchart TB
    subgraph Sources["Data Sources"]
        A1[IMD Block Forecast]
        A2[ERA5-Land / NASA POWER]
        A3[DEM / LULC / NDVI / Soil / LGD]
        A4[IMD AWS Observations]
    end
    subgraph Platform["Weather Downscaling Platform"]
        B1[Ingestion]
        B2[(PostGIS + Parquet Feature Store)]
        B2a[Baseline Module - Block Replication + optional IDW]
        B3[ML Inference Engine]
        B4[Uncertainty Engine]
        B5[Advisory Engine]
        B6[Backend API - FastAPI]
    end
    C1[React + Leaflet Dashboard]
    C2[External Consumers via REST]

    A1 --> B1
    A2 --> B1
    A3 --> B1
    A4 --> B1
    B1 --> B2
    B2 --> B2a
    B2 --> B3
    B2a --> B6
    B3 --> B4
    B4 --> B5
    B3 --> B6
    B4 --> B6
    B5 --> B6
    B6 --> C1
    B6 --> C2
```

Note: the Baseline Module (`B2a`) runs in parallel with the ML Inference Engine (`B3`) on the
same feature store, not downstream of it — both feed the API so every panchayat record carries
a baseline value and an ML value side by side (§0 of `04_ML_DOWNSCALING_APPROACH.md`).

## 2. Data flow diagram

```mermaid
flowchart LR
    Raw[Raw feeds] --> Val[Validation & QC]
    Val --> Align[Spatial + Temporal Alignment]
    Align --> Feat[Feature Store]
    Feat --> Train[Model Training]
    Feat --> Infer[Inference]
    Train --> Registry[(Model Registry)]
    Registry --> Infer
    Infer --> Pred[(Predictions + Uncertainty)]
    Pred --> Adv[Advisory Engine]
    Pred --> API[Backend API]
    Adv --> API
    API --> UI[Dashboard]
```

## 3. ML pipeline (training)

```mermaid
flowchart TB
    R[Raw Data] --> V[Data Validation]
    V --> SA[Spatial Alignment]
    SA --> TA[Temporal Alignment]
    TA --> MV[Missing Value Handling]
    MV --> FE[Feature Engineering]
    FE --> Split[Spatial / Temporal Split]
    Split --> Train[Model Training - LightGBM quantile]
    Train --> Tune[Hyperparameter Tuning]
    Tune --> Val2[Validation]
    Val2 --> SGT[Spatial Generalisation Test]
    SGT --> Export[Model Export - joblib/ONNX]
    Export --> API2[Inference API]
```

## 4. Inference pipeline (runtime)

```mermaid
sequenceDiagram
    participant Sched as Scheduler
    participant Ing as Ingestion
    participant FS as Feature Store
    participant Inf as Inference Engine
    participant Base as Baseline Module
    participant Adv as Advisory Engine
    participant DB as PostGIS
    Sched->>Ing: Trigger daily run
    Ing->>FS: Write aligned features
    FS->>Inf: Feature vectors per grid/panchayat
    FS->>Base: Feature vectors per grid/panchayat
    Base->>DB: Write BaselinePrediction (tag BASELINE)
    Inf->>Inf: Score model + quantile interval
    Inf->>DB: Write MLPrediction + PredictionUncertainty (tag ML_DOWNSCALED)
    Inf->>Adv: Pass predictions
    Adv->>DB: Write Advisory records
```

## 5. Use-case diagram

See `06_WORKFLOW_AND_USE_CASES.md` §3.

## 6. Sequence diagram — dashboard request

```mermaid
sequenceDiagram
    participant User
    participant FE as Frontend
    participant BE as Backend API
    participant DB as PostGIS

    User->>FE: Select District > Block > Panchayat
    FE->>BE: GET /prediction/{location_id}
    BE->>DB: Query latest MLPrediction + Uncertainty
    DB-->>BE: Row(s)
    BE-->>FE: JSON (prediction, interval, provenance tag)
    FE-->>User: Render map + chart + uncertainty badge
    FE->>BE: GET /advisory?location_id=...
    BE-->>FE: Advisory list
    FE-->>User: Render advisory panel
```

## 7. ER diagram

```mermaid
erDiagram
    DISTRICT ||--o{ BLOCK : contains
    BLOCK ||--o{ PANCHAYAT : contains
    BLOCK ||--o{ GRIDCELL : contains
    BLOCK ||--o{ WEATHERFORECAST : has
    PANCHAYAT ||--o{ WEATHEROBSERVATION : has
    GRIDCELL ||--o{ WEATHEROBSERVATION : has
    PANCHAYAT ||--o{ ENVIRONMENTALFEATURE : has
    GRIDCELL ||--o{ ENVIRONMENTALFEATURE : has
    PANCHAYAT ||--o{ MLPREDICTION : has
    GRIDCELL ||--o{ MLPREDICTION : has
    PANCHAYAT ||--o{ BASELINEPREDICTION : has
    GRIDCELL ||--o{ BASELINEPREDICTION : has
    MLPREDICTION ||--|| PREDICTIONUNCERTAINTY : has
    MLPREDICTION }o--|| MODELVERSION : produced_by
    BASELINEPREDICTION }o--|| MODELVERSION : produced_by
    MLPREDICTION ||--o{ ADVISORY : triggers
    ADVISORY }o--|| CROP : concerns
    ADVISORY }o--|| CROPSTAGE : concerns
```

## 8. Deployment diagram

```mermaid
flowchart TB
    subgraph Docker Compose
        FE[frontend container]
        BE["backend container (LightGBM inference runs in-process — no separate ml-inference service)"]
        PG[(postgres+postgis container)]
        Vol[(object storage volume: rasters, models)]
    end
    FE <--> BE
    BE <--> PG
    BE <--> Vol
```

## 9. Component diagram

```mermaid
flowchart LR
    subgraph Frontend
        Map[Map component]
        Chart[Chart component]
        AdvPanel[Advisory panel]
    end
    subgraph Backend
        Router[API routers]
        Svc[Services layer]
    end
    subgraph ML
        Feat2[Feature builder]
        Model[Model loader/scorer]
    end
    Map --> Router
    Chart --> Router
    AdvPanel --> Router
    Router --> Svc
    Svc --> Feat2
    Svc --> Model
```

## 10. Data lifecycle

```mermaid
flowchart LR
    Ingest[Ingest raw] --> Land[Landing zone] --> Clean[Validated] --> Store[Feature store]
    Store --> Archive[Historical archive - Parquet]
    Store --> Live[Live inference input]
    Live --> Pred[Prediction output]
    Pred --> Retention[Retained for model evaluation]
```

## 11. Dashboard flow

```mermaid
flowchart TB
    Start[Select State/District] --> Blk[Select Block]
    Blk --> Panch[Select Panchayat / Grid Cell]
    Panch --> Var[Select Variable]
    Var --> Toggle[Toggle Coarse vs Downscaled]
    Toggle --> Conf[View Uncertainty Layer]
    Conf --> Adv2[View Advisory Panel]
```
