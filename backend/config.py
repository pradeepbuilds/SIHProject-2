import os
from pydantic import BaseModel


class Settings(BaseModel):
    PROJECT_NAME: str = "KrishiMitra API"
    TAGLINE: str = "Weather intelligence for every panchayat."
    VERSION: str = "0.2.0"
    API_V1_STR: str = ""
    
    DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql://app:app@localhost:5432/weatherdb")
    FORECAST_PROVIDER: str = os.getenv("FORECAST_PROVIDER", "synthetic")
    FEATURE_PROVIDER: str = os.getenv("FEATURE_PROVIDER", "synthetic")
    OBSERVATION_PROVIDER: str = os.getenv("OBSERVATION_PROVIDER", "synthetic")
    
    PILOT_DISTRICT_ID: str = "DIST-KA-TUM"
    PILOT_DISTRICT_NAME: str = "Tumakuru"
    PILOT_STATE: str = "Karnataka"
    
    # Bounding Box for Tumakuru District
    PILOT_BBOX: dict = {
        "min_lat": 12.75,
        "max_lat": 14.35,
        "min_lon": 76.35,
        "max_lon": 77.65
    }
    
    SUPPORTED_HORIZON_MIN: int = 1
    SUPPORTED_HORIZON_MAX: int = 5
    
    ADMIN_API_KEY: str = os.getenv("ADMIN_API_KEY", "dev-admin-key-krishimitra")


settings = Settings()
