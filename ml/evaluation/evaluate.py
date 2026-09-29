import os
import sys
import json
import numpy as np
import pandas as pd
from sklearn.metrics import (
    mean_absolute_error,
    mean_squared_error,
    r2_score,
    precision_score,
    recall_score,
    f1_score,
    accuracy_score,
    confusion_matrix
)
import joblib

# Ensure project root is in sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))
from ml.preprocessing.split import create_or_load_split

DATA_DIR = os.path.join(os.path.dirname(__file__), '..', 'data', 'features')
MODEL_DIR = os.path.join(os.path.dirname(__file__), '..', 'models')
METRICS_FILE = os.path.join(os.path.dirname(__file__), '..', '..', 'backend', 'model_metrics.json')

NUMERIC_FEATURES = [
    'horizon_days', 'coarse_temp_max_c', 'coarse_temp_min_c', 'coarse_rainfall_mm',
    'coarse_humidity_pct', 'aspect', 'distance_to_water_km', 'elevation', 'ndvi', 'ndwi', 'slope'
]
CATEGORICAL_FEATURES = ['land_cover_class', 'soil_texture_class']


def compute_regression_metrics(y_true, y_pred):
    y_true = np.asarray(y_true, dtype=float)
    y_pred = np.asarray(y_pred, dtype=float)
    
    mae = float(mean_absolute_error(y_true, y_pred))
    rmse = float(np.sqrt(mean_squared_error(y_true, y_pred)))
    bias = float(np.mean(y_pred - y_true))
    r2 = float(r2_score(y_true, y_pred))
    
    # Compute Pearson correlation coefficient (r)
    if np.std(y_true) > 1e-8 and np.std(y_pred) > 1e-8:
        corr_matrix = np.corrcoef(y_true, y_pred)
        r = float(corr_matrix[0, 1])
    else:
        r = 0.0
        
    return {
        "mae": round(mae, 4),
        "rmse": round(rmse, 4),
        "bias": round(bias, 4),
        "r": round(r, 4),
        "r2": round(r2, 4)
    }


def compute_classification_metrics(y_true, y_pred, threshold=0.1):
    y_true_cls = (np.asarray(y_true) > threshold).astype(int)
    y_pred_cls = (np.asarray(y_pred) > threshold).astype(int)
    
    prec = float(precision_score(y_true_cls, y_pred_cls, zero_division=0))
    rec = float(recall_score(y_true_cls, y_pred_cls, zero_division=0))
    f1 = float(f1_score(y_true_cls, y_pred_cls, zero_division=0))
    acc = float(accuracy_score(y_true_cls, y_pred_cls))
    
    tn, fp, fn, tp = confusion_matrix(y_true_cls, y_pred_cls, labels=[0, 1]).ravel()
    
    return {
        "precision": round(prec, 4),
        "recall": round(rec, 4),
        "f1": round(f1, 4),
        "accuracy": round(acc, 4),
        "contingency": {
            "true_positive": int(tp),
            "false_positive": int(fp),
            "true_negative": int(tn),
            "false_negative": int(fn)
        }
    }


def compute_improvement(baseline_test_metrics, ml_test_metrics):
    b_mae = baseline_test_metrics.get("mae", 0.0)
    m_mae = ml_test_metrics.get("mae", 0.0)
    b_rmse = baseline_test_metrics.get("rmse", 0.0)
    m_rmse = ml_test_metrics.get("rmse", 0.0)
    
    mae_red = ((b_mae - m_mae) / b_mae * 100.0) if b_mae > 0 else 0.0
    rmse_red = ((b_rmse - m_rmse) / b_rmse * 100.0) if b_rmse > 0 else 0.0
    
    return {
        "mae_reduction_pct": round(float(mae_red), 2),
        "rmse_reduction_pct": round(float(rmse_red), 2),
        "beats_baseline": bool(m_mae < b_mae and m_rmse < b_rmse)
    }


def evaluate_all():
    print("=" * 60)
    print("PHASE 6: FULL MODEL EVALUATION ON SPATIAL HOLDOUT SET")
    print("=" * 60)
    
    feature_path = os.path.join(DATA_DIR, 'training_features.parquet')
    if not os.path.exists(feature_path):
        raise FileNotFoundError(f"Feature dataset not found at {feature_path}")
        
    print(f"Loading feature dataset from {feature_path}...")
    df = pd.read_parquet(feature_path)
    
    split = create_or_load_split()
    train_locs = set(split['train_locations'])
    test_locs = set(split['test_locations'])
    
    # Verify spatial separation
    overlap = train_locs.intersection(test_locs)
    if overlap:
        raise ValueError(f"Spatial data leakage detected! Overlapping locations: {overlap}")
        
    train_df = df[df['location_ref'].isin(train_locs)].copy()
    test_df = df[df['location_ref'].isin(test_locs)].copy()
    
    print(f"Dataset split: {len(train_locs)} train locations ({len(train_df)} rows), "
          f"{len(test_locs)} spatial holdout test locations ({len(test_df)} rows).")
          
    metrics_output = {
        "_metadata": {
            "evaluation_type": "spatial_holdout",
            "train_locations_count": len(train_locs),
            "test_locations_count": len(test_locs),
            "total_samples": len(df),
            "is_synthetic": True
        }
    }
    
    variables_config = [
        {
            "key": "temperature_max",
            "name": "Temperature Max (°C)",
            "target_col": "target_temp_max_c",
            "coarse_col": "coarse_temp_max_c",
            "model_file": "temperature_max.joblib",
            "is_rain": False
        },
        {
            "key": "temperature_min",
            "name": "Temperature Min (°C)",
            "target_col": "target_temp_min_c",
            "coarse_col": "coarse_temp_min_c",
            "model_file": "temperature_min.joblib",
            "is_rain": False
        },
        {
            "key": "rainfall",
            "name": "Rainfall (mm)",
            "target_col": "target_rainfall_mm",
            "coarse_col": "coarse_rainfall_mm",
            "model_file": "rainfall.joblib",
            "is_rain": True
        }
    ]
    
    for var in variables_config:
        key = var["key"]
        print(f"\n--- Evaluating: {var['name']} ---")
        
        # 1. Baseline Evaluation (Block Replication)
        base_train_reg = compute_regression_metrics(train_df[var["target_col"]], train_df[var["coarse_col"]])
        base_test_reg = compute_regression_metrics(test_df[var["target_col"]], test_df[var["coarse_col"]])
        
        # 2. ML Model Evaluation
        model_path = os.path.join(MODEL_DIR, var["model_file"])
        if not os.path.exists(model_path):
            print(f"Warning: Model {model_path} not found. Skipping ML evaluation for {key}.")
            metrics_output[key] = {
                "status": "not_yet_evaluated",
                "baseline_block_replication": base_test_reg,
                "ml": None
            }
            continue
            
        model = joblib.load(model_path)
        
        X_train = train_df[NUMERIC_FEATURES + CATEGORICAL_FEATURES]
        X_test = test_df[NUMERIC_FEATURES + CATEGORICAL_FEATURES]
        
        pred_train = model.predict(X_train)
        pred_test = model.predict(X_test)
        
        if var["is_rain"]:
            pred_train = np.maximum(0.0, pred_train)
            pred_test = np.maximum(0.0, pred_test)
            
        ml_train_reg = compute_regression_metrics(train_df[var["target_col"]], pred_train)
        ml_test_reg = compute_regression_metrics(test_df[var["target_col"]], pred_test)
        
        improvement = compute_improvement(base_test_reg, ml_test_reg)
        
        # Location-level spatial error check
        test_df_copy = test_df[['location_ref', var['target_col']]].copy()
        test_df_copy['pred'] = pred_test
        test_df_copy['abs_error'] = np.abs(test_df_copy['pred'] - test_df_copy[var['target_col']])
        spatial_mae_by_loc = test_df_copy.groupby('location_ref')['abs_error'].mean().to_dict()
        
        var_entry = {
            "status": "evaluated",
            "baseline_block_replication": {
                "mae": base_test_reg["mae"],
                "rmse": base_test_reg["rmse"],
                "bias": base_test_reg["bias"],
                "r": base_test_reg["r"],
                "r2": base_test_reg["r2"]
            },
            "ml": {
                "mae": ml_test_reg["mae"],
                "rmse": ml_test_reg["rmse"],
                "bias": ml_test_reg["bias"],
                "r": ml_test_reg["r"],
                "r2": ml_test_reg["r2"]
            },
            "improvement": improvement,
            "train_metrics": {
                "baseline": base_train_reg,
                "ml": ml_train_reg
            },
            "spatial_holdout_mae_by_location": {k: round(float(v), 4) for k, v in spatial_mae_by_loc.items()}
        }
        
        if var["is_rain"]:
            base_train_cls = compute_classification_metrics(train_df[var["target_col"]], train_df[var["coarse_col"]])
            base_test_cls = compute_classification_metrics(test_df[var["target_col"]], test_df[var["coarse_col"]])
            ml_train_cls = compute_classification_metrics(train_df[var["target_col"]], pred_train)
            ml_test_cls = compute_classification_metrics(test_df[var["target_col"]], pred_test)
            
            var_entry["rain_occurrence"] = {
                "baseline_test": {
                    "precision": base_test_cls["precision"],
                    "recall": base_test_cls["recall"],
                    "f1": base_test_cls["f1"],
                    "accuracy": base_test_cls["accuracy"]
                },
                "ml_test": {
                    "precision": ml_test_cls["precision"],
                    "recall": ml_test_cls["recall"],
                    "f1": ml_test_cls["f1"],
                    "accuracy": ml_test_cls["accuracy"]
                },
                "train_details": {
                    "baseline": base_train_cls,
                    "ml": ml_train_cls
                }
            }
            
        metrics_output[key] = var_entry
        
        print(f"Baseline Test MAE: {base_test_reg['mae']} | ML Test MAE: {ml_test_reg['mae']} (Reduction: {improvement['mae_reduction_pct']}%)")
        print(f"Baseline Test RMSE: {base_test_reg['rmse']} | ML Test RMSE: {ml_test_reg['rmse']} (Reduction: {improvement['rmse_reduction_pct']}%)")
        print(f"Beats baseline on spatial holdout: {improvement['beats_baseline']}")
        
    os.makedirs(os.path.dirname(METRICS_FILE), exist_ok=True)
    with open(METRICS_FILE, 'w') as f:
        json.dump(metrics_output, f, indent=2)
        
    print("\n" + "=" * 60)
    print(f"Phase 6 evaluation complete! Metrics written to {METRICS_FILE}")
    print("=" * 60)
    return metrics_output


if __name__ == "__main__":
    evaluate_all()
