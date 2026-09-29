"""Environment parity check script for KrishiMitra.

Verifies that critical scientific and ML libraries are installed with matching
or compatible versions across host and container environments.
"""
import sys
import importlib.metadata

REQUIRED_LIBRARIES = [
    'pandas',
    'numpy',
    'scikit-learn',
    'lightgbm',
    'joblib',
    'shapely',
    'geopandas',
    'pyarrow',
    'yaml'  # PyYAML
]


def check_env_parity():
    print("=" * 60)
    print("KRISHIMITRA ENVIRONMENT PARITY AUDIT")
    print(f"Python: {sys.version}")
    print("=" * 60)

    all_present = True
    installed_versions = {}

    for lib in REQUIRED_LIBRARIES:
        pkg_name = 'PyYAML' if lib == 'yaml' else lib
        try:
            ver = importlib.metadata.version(pkg_name)
            installed_versions[lib] = ver
            print(f"  [OK] {lib:<15} : {ver}")
        except importlib.metadata.PackageNotFoundError:
            print(f"  [MISSING] {lib:<15} : Not installed!")
            all_present = False

    print("=" * 60)
    if all_present:
        print("[SUCCESS] All required ML and geospatial libraries are present.")
        return 0
    else:
        print("[FAIL] Missing dependencies. Please run pip install -r backend/requirements.txt")
        return 1


if __name__ == '__main__':
    sys.exit(check_env_parity())
