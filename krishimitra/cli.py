import os
import sys
import argparse
from krishimitra.config import get_all_regions, get_region_config
from krishimitra.generator import (
    generate_region_geography,
    generate_environmental_features,
    generate_climate_weather_and_events
)
from krishimitra.features import build_region_features
from krishimitra.split import create_or_load_split
from krishimitra.models import train_region_models
from krishimitra.evaluate import evaluate_region
from krishimitra.seed import seed_all_regions, seed_region_data


def build_region(region_id: str):
    config = get_region_config(region_id)
    if not config:
        print(f"Error: Region config '{region_id}' not found.")
        sys.exit(1)

    print("=" * 60)
    print(f"BUILDING REGION PIPELINE: {config.region_id} ({config.district}, {config.state})")
    print(f"Zone: {config.agro_climatic_zone}")
    print("=" * 60)

    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    data_dir = os.path.join(base_dir, 'ml', 'data', region_id)
    models_dir = os.path.join(base_dir, 'ml', 'models', region_id)
    eval_dir = os.path.join(base_dir, 'ml', 'evaluation', region_id)

    # 1. Generate Geography (Blocks, Panchayats, Grids)
    print("\n[Step 1/5] Generating Geography & Boundaries...")
    b_gdf, p_gdf, g_gdf = generate_region_geography(config, data_dir)

    # 2. Generate Static Environmental Features
    print("\n[Step 2/5] Generating Terrain & Environmental Features...")
    generate_environmental_features(config, p_gdf, g_gdf, data_dir)

    # 3. Generate Climate Weather Timeseries & Event Catalog
    print("\n[Step 3/5] Generating Climate Weather & Scenario Events...")
    generate_climate_weather_and_events(config, b_gdf, p_gdf, data_dir)

    # 4. Build Feature Table
    print("\n[Step 4/5] Constructing Feature Table (training_features.parquet)...")
    build_region_features(region_id, data_dir)

    # 5. Spatial Holdout Split, Model Training & Calibration
    print("\n[Step 5/5] Spatial Split, Training & Evaluation...")
    split_dict = create_or_load_split(region_id, data_dir)
    train_region_models(region_id, data_dir, models_dir, split_dict)
    evaluate_region(region_id, data_dir, models_dir, eval_dir, split_dict)

    print("\n" + "=" * 60)
    print(f"REGION '{region_id}' BUILD COMPLETE!")
    print("=" * 60)


def main():
    parser = argparse.ArgumentParser(description="KrishiMitra CLI - Region and ML Operations")
    subparsers = parser.add_subparsers(dest="command", help="Command to run")

    # Region commands
    region_parser = subparsers.add_parser("region", help="Region management")
    region_sub = region_parser.add_subparsers(dest="subcommand", help="Region subcommand")

    list_p = region_sub.add_parser("list", help="List all configured regions")

    build_p = region_sub.add_parser("build", help="Build region data and ML pipeline")
    build_p.add_argument("--region", type=str, help="Specific region ID to build")
    build_p.add_argument("--all", action="store_true", help="Build all configured regions")

    # Seed commands
    seed_p = subparsers.add_parser("seed", help="Seed database with region datasets")
    seed_p.add_argument("--region", type=str, help="Specific region ID to seed")
    seed_p.add_argument("--all", action="store_true", help="Seed all regions")
    seed_p.add_argument("--db-url", type=str, default=None, help="Database URL")
    seed_p.add_argument("--force", action="store_true", help="Force re-seeding regardless of hash")

    args = parser.parse_args()

    if args.command == "region":
        if args.subcommand == "list":
            regions = get_all_regions()
            print(f"{'Region ID':<15} {'District':<15} {'State':<15} {'Zone'}")
            print("-" * 65)
            for r in regions:
                print(f"{r.region_id:<15} {r.district:<15} {r.state:<15} {r.agro_climatic_zone}")
        elif args.subcommand == "build":
            if args.all:
                for r in get_all_regions():
                    build_region(r.region_id)
            elif args.region:
                build_region(args.region)
            else:
                print("Error: Specify --region <id> or --all")
                sys.exit(1)
    elif args.command == "seed":
        if args.all:
            seed_all_regions(db_url=args.db_url, force=args.force)
        elif args.region:
            url = args.db_url or os.getenv("DATABASE_URL", "postgresql+psycopg2://app:app@postgres:5432/weatherdb")
            seed_region_data(args.region, url, force=args.force)
        else:
            print("Error: Specify --region <id> or --all")
            sys.exit(1)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
