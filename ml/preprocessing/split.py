import os
import json
import pandas as pd
import numpy as np

DATA_DIR = os.path.join(os.path.dirname(__file__), '..', 'data', 'features')
SPLIT_FILE = os.path.join(os.path.dirname(__file__), '..', 'data', 'split.json')

def create_or_load_split(test_size=0.2, seed=42):
    if os.path.exists(SPLIT_FILE):
        with open(SPLIT_FILE, 'r') as f:
            return json.load(f)
            
    print("Creating new spatial holdout split...")
    df = pd.read_parquet(os.path.join(DATA_DIR, 'training_features.parquet'))
    locations = df['location_ref'].unique()
    
    # Cast to python list to avoid ArrowStringArray shuffle warning
    locations = list(locations)
    
    np.random.seed(seed)
    np.random.shuffle(locations)
    
    split_idx = int(len(locations) * (1 - test_size))
    train_locs = locations[:split_idx]
    test_locs = locations[split_idx:]
    
    split = {
        "train_locations": train_locs,
        "test_locations": test_locs
    }
    
    os.makedirs(os.path.dirname(SPLIT_FILE), exist_ok=True)
    with open(SPLIT_FILE, 'w') as f:
        json.dump(split, f)
        
    print(f"Split created: {len(train_locs)} train locations, {len(test_locs)} test locations.")
    return split
