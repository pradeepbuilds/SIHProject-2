import os
from sqlalchemy import Column, Integer, String, Boolean, Float, Date, ForeignKey, DateTime, Index
from sqlalchemy.orm import declarative_base, relationship
from geoalchemy2 import Geometry

Base = declarative_base()


class Region(Base):
    __tablename__ = 'region'
    id = Column(String, primary_key=True)  # e.g., 'ka-tumakuru'
    state = Column(String, nullable=False)
    district = Column(String, nullable=False)
    config_json = Column(String, nullable=False)
    data_mode_json = Column(String, nullable=False)
    loaded_at = Column(DateTime(timezone=True), nullable=False)


class RegionLoadState(Base):
    __tablename__ = 'region_load_state'
    region_id = Column(String, primary_key=True)
    data_hash = Column(String, nullable=False)
    loaded_at = Column(DateTime(timezone=True), nullable=False)


class District(Base):
    __tablename__ = 'district'
    id = Column(String, primary_key=True)
    region_id = Column(String, ForeignKey('region.id'), nullable=True)
    name = Column(String, nullable=False)
    state = Column(String, nullable=False)
    lgd_code = Column(String)


class Block(Base):
    __tablename__ = 'block'
    id = Column(String, primary_key=True)
    region_id = Column(String, ForeignKey('region.id'), nullable=True)
    district_id = Column(String, ForeignKey('district.id'), nullable=False)
    name = Column(String, nullable=False)
    lgd_code = Column(String)
    geometry = Column(Geometry('POLYGON', srid=4326, spatial_index=True))


class Panchayat(Base):
    __tablename__ = 'panchayat'
    id = Column(String, primary_key=True)
    region_id = Column(String, ForeignKey('region.id'), nullable=True)
    block_id = Column(String, ForeignKey('block.id'), nullable=False)
    name = Column(String, nullable=False)
    lgd_code = Column(String)
    geometry = Column(Geometry('POLYGON', srid=4326, spatial_index=True))
    is_synthetic_boundary = Column(Boolean, nullable=False, default=True)
    boundary_is_official = Column(Boolean, nullable=False, default=False)


class GridCell(Base):
    __tablename__ = 'grid_cell'
    id = Column(String, primary_key=True)
    region_id = Column(String, ForeignKey('region.id'), nullable=True)
    block_id = Column(String, ForeignKey('block.id'), nullable=False)
    geometry = Column(Geometry('POLYGON', srid=4326, spatial_index=True), nullable=False)
    centroid = Column(Geometry('POINT', srid=4326, spatial_index=True), nullable=False)


class EnvironmentalFeature(Base):
    __tablename__ = 'environmental_feature'
    id = Column(Integer, primary_key=True, autoincrement=True)
    location_ref = Column(String, nullable=False, index=True)
    feature_name = Column(String, nullable=False, index=True)
    value_num = Column(Float, nullable=True)
    value_str = Column(String, nullable=True)
    value = Column(Float, nullable=True)  # backwards compatibility alias
    valid_from = Column(Date)
    valid_to = Column(Date)
    is_synthetic = Column(Boolean, nullable=False, default=True)


class WeatherObservation(Base):
    __tablename__ = 'weather_observation'
    id = Column(Integer, primary_key=True, autoincrement=True)
    location_ref = Column(String, nullable=False)
    timestamp = Column(DateTime(timezone=True), nullable=False)
    variable = Column(String, nullable=False)
    value = Column(Float, nullable=False)
    source = Column(String, nullable=False)
    is_synthetic = Column(Boolean, nullable=False, default=True)
    data_source_tag = Column(String, nullable=False, default='OBSERVED')

    __table_args__ = (
        Index('idx_obs_loc_time_var', 'location_ref', 'timestamp', 'variable'),
    )


class WeatherForecast(Base):
    __tablename__ = 'weather_forecast'
    id = Column(Integer, primary_key=True, autoincrement=True)
    block_id = Column(String, ForeignKey('block.id'), nullable=False)
    forecast_date = Column(Date, nullable=False)
    target_date = Column(Date, nullable=False)
    horizon_days = Column(Integer, nullable=False)
    variable = Column(String, nullable=False)
    value = Column(Float, nullable=False)
    is_synthetic = Column(Boolean, nullable=False, default=True)
    data_source_tag = Column(String, nullable=False, default='FORECAST')

    __table_args__ = (
        Index('idx_fcst_block_target_fcst_var', 'block_id', 'target_date', 'forecast_date', 'variable'),
    )


class ModelVersion(Base):
    __tablename__ = 'model_version'
    id = Column(String, primary_key=True)
    region_id = Column(String, nullable=True)
    variable = Column(String, nullable=False)
    model_type = Column(String, nullable=False)
    training_window = Column(String, nullable=False)
    feature_schema_hash = Column(String, nullable=False)
    validation_metrics = Column(String)  # JSON string
    created_at = Column(DateTime(timezone=True), nullable=False)


class BaselinePrediction(Base):
    __tablename__ = 'baseline_prediction'
    id = Column(Integer, primary_key=True, autoincrement=True)
    location_ref = Column(String, nullable=False)
    forecast_date = Column(Date, nullable=False)
    target_date = Column(Date, nullable=False)
    horizon_days = Column(Integer, nullable=False)
    variable = Column(String, nullable=False)
    value = Column(Float, nullable=False)
    model_version_id = Column(String, ForeignKey('model_version.id'), nullable=False)
    is_synthetic = Column(Boolean, nullable=False, default=True)
    data_source_tag = Column(String, nullable=False, default='BASELINE')


class MlPrediction(Base):
    __tablename__ = 'ml_prediction'
    id = Column(Integer, primary_key=True, autoincrement=True)
    location_ref = Column(String, nullable=False)
    forecast_date = Column(Date, nullable=False)
    target_date = Column(Date, nullable=False)
    horizon_days = Column(Integer, nullable=False)
    variable = Column(String, nullable=False)
    value = Column(Float, nullable=False)
    model_version_id = Column(String, ForeignKey('model_version.id'), nullable=False)
    is_synthetic = Column(Boolean, nullable=False, default=True)
    data_source_tag = Column(String, nullable=False, default='ML_DOWNSCALED')


class PredictionUncertainty(Base):
    __tablename__ = 'prediction_uncertainty'
    prediction_id = Column(Integer, ForeignKey('ml_prediction.id'), primary_key=True)
    p10 = Column(Float)
    p50 = Column(Float)
    p90 = Column(Float)
    uncertainty_label = Column(String)


class Crop(Base):
    __tablename__ = 'crop'
    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)


class CropStage(Base):
    __tablename__ = 'crop_stage'
    id = Column(String, primary_key=True)
    crop_id = Column(String, ForeignKey('crop.id'), nullable=False)
    stage_name = Column(String, nullable=False)
    sensitive_thresholds = Column(String)  # JSON string


class Advisory(Base):
    __tablename__ = 'advisory'
    id = Column(Integer, primary_key=True, autoincrement=True)
    location_ref = Column(String, nullable=False)
    crop_id = Column(String, ForeignKey('crop.id'))
    crop_stage_id = Column(String, ForeignKey('crop_stage.id'))
    rule_id = Column(String, nullable=False)
    message = Column(String, nullable=False)
    uncertainty_label = Column(String)
    prediction_id = Column(Integer, ForeignKey('ml_prediction.id'))
    issued_at = Column(DateTime(timezone=True), nullable=False)


class AppUser(Base):
    __tablename__ = 'app_user'
    id = Column(Integer, primary_key=True, autoincrement=True)
    role = Column(String, nullable=False)
