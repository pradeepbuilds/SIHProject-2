import os
import json
import logging
import importlib.metadata
import joblib
import numpy as np
import pandas as pd
from typing import Dict, Any, Optional, Tuple

logger = logging.getLogger("krishimitra.inference")
if not logger.handlers:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

MODELS_BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'models'))

# Multi-region loaded models store: models[region_id][variable] = model_obj
models: Dict[str, Dict[str, Any]] = {}
models_meta: Dict[str, Dict[str, Any]] = {}


def check_meta_version_parity(meta_path: str) -> bool:
    """Compares runtime package versions with model sidecar metadata."""
    if not os.path.exists(meta_path):
        return True
    try:
        with open(meta_path, 'r', encoding='utf-8') as f:
            meta = json.load(f)
        saved_versions = meta.get('library_versions', {})
        for pkg, saved_ver in saved_versions.items():
            try:
                curr_ver = importlib.metadata.version(pkg)
                curr_parts = curr_ver.split('.')[:2]
                saved_parts = saved_ver.split('.')[:2]
                if curr_parts != saved_parts:
                    logger.error(
                        f"Version mismatch for {pkg} in {meta_path}: runtime is {curr_ver}, trained with {saved_ver}"
                    )
                    return False
            except Exception:
                pass
        return True
    except Exception as e:
        logger.warning(f"Could not read metadata at {meta_path}: {e}")
        return True


def load_models() -> Dict[str, Dict[str, Any]]:
    """Loads all models across all region directories in ml/models/."""
    global models, models_meta
    logger.info("Initializing KrishiMitra multi-region ML models...")
    
    if not os.path.exists(MODELS_BASE_DIR):
        logger.warning(f"Models directory not found at {MODELS_BASE_DIR}")
        return models

    # Scan for region directories
    entries = sorted(os.listdir(MODELS_BASE_DIR))
    region_ids = [d for d in entries if os.path.isdir(os.path.join(MODELS_BASE_DIR, d))]
    
    # Also support single-region fallback if files are directly in MODELS_BASE_DIR
    variables = ['temperature_max', 'temperature_min', 'rainfall']
    
    total_loaded = 0
    for r_id in region_ids:
        r_dir = os.path.join(MODELS_BASE_DIR, r_id)
        models[r_id] = {}
        models_meta[r_id] = {}
        for var in variables:
            model_file = os.path.join(r_dir, f"{var}.joblib")
            meta_file = os.path.join(r_dir, f"{var}.meta.json")
            if os.path.exists(model_file):
                parity = check_meta_version_parity(meta_file)
                try:
                    obj = joblib.load(model_file)
                    models[r_id][var] = obj
                    total_loaded += 1
                    if os.path.exists(meta_file):
                        with open(meta_file, 'r', encoding='utf-8') as f:
                            models_meta[r_id][var] = json.load(f)
                    logger.info(f"Loaded {var} model for region '{r_id}' (env parity: {'OK' if parity else 'MISMATCH'})")
                except Exception as e:
                    logger.error(f"Failed to load {model_file}: {e}")

    # Fallback default region alias
    if 'ka-tumakuru' in models:
        models['default'] = models['ka-tumakuru']

    logger.info(f"KrishiMitra model loader finished: {total_loaded} models active across {len(region_ids)} regions.")
    return models


def get_model(region_id: str, variable: str) -> Optional[Any]:
    r_models = models.get(region_id) or models.get('default') or {}
    return r_models.get(variable)


def predict(var_name: str, X: pd.DataFrame, region_id: str = "ka-tumakuru") -> np.ndarray:
    model = get_model(region_id, var_name)
    if not model:
        raise ValueError(f"Model for variable '{var_name}' in region '{region_id}' not loaded")
    return model.predict(X)
