import os
import json
import numpy as np
import pandas as pd


def create_or_load_split(region_id: str, data_dir: str, seed: int = 42) -> dict:
    split_file = os.path.join(data_dir, 'split.json')

    # If ka-tumakuru, check if existing split exists
    if os.path.exists(split_file):
        with open(split_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
            # If calibration_locations is already in the split, return it directly
            if 'calibration_locations' in data and len(data['calibration_locations']) > 0:
                return data

            # Carve calibration set (~20%) from train locations while preserving test_locations exactly!
            train_locs = list(data.get('train_locations', []))
            test_locs = list(data.get('test_locations', []))

            rng = np.random.default_rng(seed)
            n_calib = max(1, int(len(train_locs) * 0.20))
            shuffled_train = list(train_locs)
            rng.shuffle(shuffled_train)

            calib_locs = sorted(shuffled_train[:n_calib])
            actual_train_locs = sorted(shuffled_train[n_calib:])

            updated_split = {
                'train_locations': actual_train_locs,
                'calibration_locations': calib_locs,
                'test_locations': test_locs
            }
            with open(split_file, 'w', encoding='utf-8') as fw:
                json.dump(updated_split, fw, indent=2)
            print(f"[{region_id}] Updated split.json: {len(actual_train_locs)} train, {len(calib_locs)} calib, {len(test_locs)} test.")
            return updated_split

    # For new regions, perform spatial holdout split (80% train, 20% test)
    panchayats_path = os.path.join(data_dir, 'panchayats.parquet')
    if not os.path.exists(panchayats_path):
        raise FileNotFoundError(f"panchayats.parquet not found in {data_dir}")

    gdf = pd.read_parquet(panchayats_path)
    all_locs = sorted(list(gdf['id'].unique()))

    rng = np.random.default_rng(seed)
    shuffled = list(all_locs)
    rng.shuffle(shuffled)

    n_test = max(2, int(len(all_locs) * 0.20))
    test_locs = sorted(shuffled[:n_test])
    remaining_train = shuffled[n_test:]

    n_calib = max(1, int(len(remaining_train) * 0.20))
    calib_locs = sorted(remaining_train[:n_calib])
    train_locs = sorted(remaining_train[n_calib:])

    split_data = {
        'train_locations': train_locs,
        'calibration_locations': calib_locs,
        'test_locations': test_locs
    }

    with open(split_file, 'w', encoding='utf-8') as f:
        json.dump(split_data, f, indent=2)

    print(f"[{region_id}] Created new split: {len(train_locs)} train, {len(calib_locs)} calib, {len(test_locs)} test.")
    return split_data
