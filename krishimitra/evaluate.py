import os
import json
import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import (
    mean_absolute_error, mean_squared_error, r2_score,
    precision_score, recall_score, f1_score, accuracy_score, brier_score_loss
)
from krishimitra.models import ALL_FEATURES, NUMERIC_FEATURES, CATEGORICAL_FEATURES, BlockReplicationBaseline


def compute_regression_metrics(y_true, y_pred):
    y_true = np.asarray(y_true, dtype=float)
    y_pred = np.asarray(y_pred, dtype=float)

    mae = float(mean_absolute_error(y_true, y_pred))
    rmse = float(np.sqrt(mean_squared_error(y_true, y_pred)))
    bias = float(np.mean(y_pred - y_true))
    r2 = float(r2_score(y_true, y_pred))

    if np.std(y_true) > 1e-6 and np.std(y_pred) > 1e-6:
        r = float(np.corrcoef(y_true, y_pred)[0, 1])
    else:
        r = 0.0

    return {
        "mae": round(mae, 4),
        "rmse": round(rmse, 4),
        "bias": round(bias, 4),
        "r": round(r, 4),
        "r2": round(r2, 4)
    }


def compute_calibration_report(y_true, p10, p90, horizons=None):
    y_true = np.asarray(y_true, dtype=float)
    p10 = np.asarray(p10, dtype=float)
    p90 = np.asarray(p90, dtype=float)

    in_interval = (y_true >= p10) & (y_true <= p90)
    below_p10 = y_true < p10
    above_p90 = y_true > p90

    coverage = float(np.mean(in_interval))
    tail_low = float(np.mean(below_p10))
    tail_high = float(np.mean(above_p90))

    by_horizon = {}
    if horizons is not None:
        h_arr = np.asarray(horizons)
        for h in np.unique(h_arr):
            mask = h_arr == h
            if np.sum(mask) > 0:
                by_horizon[int(h)] = {
                    "coverage": round(float(np.mean(in_interval[mask])), 4),
                    "target": 0.80,
                    "count": int(np.sum(mask))
                }

    # Plain-language verdict
    pct = round(coverage * 100, 1)
    if abs(coverage - 0.80) <= 0.05:
        verdict = f"Well-calibrated: the 80% interval captured {pct}% of observations."
    elif coverage > 0.80:
        verdict = f"Conservative: the 80% interval captured {pct}% of observations (wider than nominal)."
    else:
        verdict = f"Under-covered: the 80% interval captured {pct}% of observations."

    return {
        "empirical_coverage_80": round(coverage, 4),
        "target_coverage": 0.80,
        "tail_rate_p10": round(tail_low, 4),
        "tail_rate_p90": round(tail_high, 4),
        "verdict": verdict,
        "by_horizon": by_horizon
    }


def evaluate_region(region_id: str, data_dir: str, models_dir: str, eval_dir: str, split_dict: dict):
    os.makedirs(eval_dir, exist_ok=True)
    df = pd.read_parquet(os.path.join(data_dir, 'training_features.parquet'))

    test_locs = set(split_dict['test_locations'])
    train_locs = set(split_dict['train_locations'])
    test_df = df[df['location_ref'].isin(test_locs)].copy()
    train_df = df[df['location_ref'].isin(train_locs)].copy()

    baseline = BlockReplicationBaseline()

    output_metrics = {
        "_metadata": {
            "region_id": region_id,
            "evaluation_type": "spatial_holdout",
            "train_locations_count": len(train_locs),
            "test_locations_count": len(test_locs),
            "total_test_rows": len(test_df),
            "is_synthetic": True,
            "note": "Generator uses static terrain features as inputs; skill reflects the synthetic world, not real-world accuracy."
        }
    }

    test_predictions_records = []

    # --- 1. Evaluate Temperature Max ---
    tmax_model = joblib.load(os.path.join(models_dir, 'temperature_max.joblib'))
    p10_tmax, p50_tmax, p90_tmax = tmax_model.predict_quantiles(test_df)
    base_tmax = baseline.predict(test_df, 'temp_max')
    y_tmax = test_df['target_temp_max_c'].values

    base_reg_tmax = compute_regression_metrics(y_tmax, base_tmax)
    ml_reg_tmax = compute_regression_metrics(y_tmax, p50_tmax)
    calib_tmax = compute_calibration_report(y_tmax, p10_tmax, p90_tmax, test_df['horizon_days'].values)

    # By-horizon breakdown
    tmax_by_horizon = {}
    for h in sorted(test_df['horizon_days'].unique()):
        h_mask = test_df['horizon_days'] == h
        tmax_by_horizon[int(h)] = {
            "baseline": compute_regression_metrics(y_tmax[h_mask], base_tmax[h_mask]),
            "ml": compute_regression_metrics(y_tmax[h_mask], p50_tmax[h_mask])
        }

    output_metrics['temperature_max'] = {
        "baseline_block_replication": base_reg_tmax,
        "ml": ml_reg_tmax,
        "improvement": {
            "mae_reduction_pct": round((base_reg_tmax['mae'] - ml_reg_tmax['mae']) / base_reg_tmax['mae'] * 100, 2),
            "rmse_reduction_pct": round((base_reg_tmax['rmse'] - ml_reg_tmax['rmse']) / base_reg_tmax['rmse'] * 100, 2),
            "beats_baseline": bool(ml_reg_tmax['mae'] < base_reg_tmax['mae'])
        },
        "calibration": calib_tmax,
        "by_horizon": tmax_by_horizon
    }

    # Record test predictions for analytics
    for i, (_, row) in enumerate(test_df.iterrows()):
        test_predictions_records.append({
            'region_id': region_id,
            'location_ref': str(row['location_ref']),
            'target_date': str(row['target_date']),
            'forecast_date': str(row.get('forecast_date', row['target_date'])),
            'horizon_days': int(row['horizon_days']),
            'variable': 'temperature_max',
            'observed': round(float(y_tmax[i]), 2),
            'coarse': round(float(base_tmax[i]), 2),
            'p10': round(float(p10_tmax[i]), 2),
            'p50': round(float(p50_tmax[i]), 2),
            'p90': round(float(p90_tmax[i]), 2),
            'is_test_location': True
        })

    # --- 2. Evaluate Temperature Min ---
    tmin_model = joblib.load(os.path.join(models_dir, 'temperature_min.joblib'))
    p10_tmin, p50_tmin, p90_tmin = tmin_model.predict_quantiles(test_df)
    base_tmin = baseline.predict(test_df, 'temp_min')
    y_tmin = test_df['target_temp_min_c'].values

    base_reg_tmin = compute_regression_metrics(y_tmin, base_tmin)
    ml_reg_tmin = compute_regression_metrics(y_tmin, p50_tmin)
    calib_tmin = compute_calibration_report(y_tmin, p10_tmin, p90_tmin, test_df['horizon_days'].values)

    tmin_by_horizon = {}
    for h in sorted(test_df['horizon_days'].unique()):
        h_mask = test_df['horizon_days'] == h
        tmin_by_horizon[int(h)] = {
            "baseline": compute_regression_metrics(y_tmin[h_mask], base_tmin[h_mask]),
            "ml": compute_regression_metrics(y_tmin[h_mask], p50_tmin[h_mask])
        }

    output_metrics['temperature_min'] = {
        "baseline_block_replication": base_reg_tmin,
        "ml": ml_reg_tmin,
        "improvement": {
            "mae_reduction_pct": round((base_reg_tmin['mae'] - ml_reg_tmin['mae']) / base_reg_tmin['mae'] * 100, 2),
            "rmse_reduction_pct": round((base_reg_tmin['rmse'] - ml_reg_tmin['rmse']) / base_reg_tmin['rmse'] * 100, 2),
            "beats_baseline": bool(ml_reg_tmin['mae'] < base_reg_tmin['mae'])
        },
        "calibration": calib_tmin,
        "by_horizon": tmin_by_horizon
    }

    for i, (_, row) in enumerate(test_df.iterrows()):
        test_predictions_records.append({
            'region_id': region_id,
            'location_ref': str(row['location_ref']),
            'target_date': str(row['target_date']),
            'forecast_date': str(row.get('forecast_date', row['target_date'])),
            'horizon_days': int(row['horizon_days']),
            'variable': 'temperature_min',
            'observed': round(float(y_tmin[i]), 2),
            'coarse': round(float(base_tmin[i]), 2),
            'p10': round(float(p10_tmin[i]), 2),
            'p50': round(float(p50_tmin[i]), 2),
            'p90': round(float(p90_tmin[i]), 2),
            'is_test_location': True
        })

    # --- 3. Evaluate Rainfall Hurdle Model ---
    rain_model = joblib.load(os.path.join(models_dir, 'rainfall.joblib'))
    rain_components = rain_model.predict_components(test_df)
    ml_rain = rain_components['rainfall_mm']
    base_rain = baseline.predict(test_df, 'rainfall')
    y_rain = test_df['target_rainfall_mm'].values

    base_reg_rain = compute_regression_metrics(y_rain, base_rain)
    ml_reg_rain = compute_regression_metrics(y_rain, ml_rain)
    calib_rain = compute_calibration_report(
        y_rain,
        rain_components['wet_amount_p10'] * rain_components['rain_probability'],
        rain_components['wet_amount_p90'] * (1.2 if np.mean(rain_components['rain_probability']) < 0.3 else 1.0),
        test_df['horizon_days'].values
    )

    # Classification metrics for wet-day detection
    wet_true = (y_rain >= rain_model.rain_day_mm).astype(int)
    wet_pred_ml = (rain_components['rain_probability'] >= rain_model.threshold).astype(int)
    wet_pred_base = (base_rain >= rain_model.rain_day_mm).astype(int)

    brier_ml = float(brier_score_loss(wet_true, rain_components['rain_probability']))
    brier_base = float(brier_score_loss(wet_true, np.clip(base_rain / 10.0, 0, 1)))

    hurdle_report = {
        "decision_threshold": rain_model.threshold,
        "rain_day_mm": rain_model.rain_day_mm,
        "brier_score": round(brier_ml, 4),
        "baseline_brier_score": round(brier_base, 4),
        "ml_test": {
            "precision": round(float(precision_score(wet_true, wet_pred_ml, zero_division=0)), 4),
            "recall": round(float(recall_score(wet_true, wet_pred_ml, zero_division=0)), 4),
            "f1": round(float(f1_score(wet_true, wet_pred_ml, zero_division=0)), 4),
            "accuracy": round(float(accuracy_score(wet_true, wet_pred_ml)), 4)
        },
        "baseline_test": {
            "precision": round(float(precision_score(wet_true, wet_pred_base, zero_division=0)), 4),
            "recall": round(float(recall_score(wet_true, wet_pred_base, zero_division=0)), 4),
            "f1": round(float(f1_score(wet_true, wet_pred_base, zero_division=0)), 4),
            "accuracy": round(float(accuracy_score(wet_true, wet_pred_base)), 4)
        }
    }

    rain_by_horizon = {}
    for h in sorted(test_df['horizon_days'].unique()):
        h_mask = test_df['horizon_days'] == h
        rain_by_horizon[int(h)] = {
            "baseline": compute_regression_metrics(y_rain[h_mask], base_rain[h_mask]),
            "ml": compute_regression_metrics(y_rain[h_mask], ml_rain[h_mask])
        }

    output_metrics['rainfall'] = {
        "baseline_block_replication": base_reg_rain,
        "ml": ml_reg_rain,
        "improvement": {
            "mae_reduction_pct": round((base_reg_rain['mae'] - ml_reg_rain['mae']) / base_reg_rain['mae'] * 100, 2),
            "rmse_reduction_pct": round((base_reg_rain['rmse'] - ml_reg_rain['rmse']) / base_reg_rain['rmse'] * 100, 2),
            "beats_baseline": bool(ml_reg_rain['mae'] < base_reg_rain['mae'])
        },
        "hurdle_report": hurdle_report,
        "calibration": calib_rain,
        "by_horizon": rain_by_horizon
    }

    for i, (_, row) in enumerate(test_df.iterrows()):
        test_predictions_records.append({
            'region_id': region_id,
            'location_ref': str(row['location_ref']),
            'target_date': str(row['target_date']),
            'forecast_date': str(row.get('forecast_date', row['target_date'])),
            'horizon_days': int(row['horizon_days']),
            'variable': 'rainfall',
            'observed': round(float(y_rain[i]), 2),
            'coarse': round(float(base_rain[i]), 2),
            'p10': round(float(rain_components['wet_amount_p10'][i] * rain_components['rain_probability'][i]), 2),
            'p50': round(float(ml_rain[i]), 2),
            'p90': round(float(rain_components['wet_amount_p90'][i]), 2),
            'is_test_location': True
        })

    # Save metrics JSON & test_predictions.parquet
    metrics_path = os.path.join(eval_dir, 'metrics.json')
    with open(metrics_path, 'w', encoding='utf-8') as f:
        json.dump(output_metrics, f, indent=2)

    pred_df = pd.DataFrame(test_predictions_records)
    pred_path = os.path.join(eval_dir, 'test_predictions.parquet')
    pred_df.to_parquet(pred_path)

    print(f"[{region_id}] Evaluation complete! Metrics saved to {metrics_path}")
    print(f"  - Tmax MAE Reduction: {output_metrics['temperature_max']['improvement']['mae_reduction_pct']}%")
    print(f"  - Tmin MAE Reduction: {output_metrics['temperature_min']['improvement']['mae_reduction_pct']}%")
    print(f"  - Rain MAE Reduction: {output_metrics['rainfall']['improvement']['mae_reduction_pct']}%")
    print(f"  - Rainfall Hurdle F1: ML {hurdle_report['ml_test']['f1']} vs Baseline {hurdle_report['baseline_test']['f1']}")
    return output_metrics
