"""KrishiMitra unified schema initialization

Revision ID: 0001_krishimitra
Revises: 
Create Date: 2026-09-28 12:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from geoalchemy2 import Geometry

# revision identifiers, used by Alembic.
revision: str = '0001_krishimitra'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. region
    op.create_table(
        'region',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('state', sa.String(), nullable=False),
        sa.Column('district', sa.String(), nullable=False),
        sa.Column('config_json', sa.String(), nullable=False),
        sa.Column('data_mode_json', sa.String(), nullable=False),
        sa.Column('loaded_at', sa.DateTime(timezone=True), nullable=False)
    )

    # 2. region_load_state
    op.create_table(
        'region_load_state',
        sa.Column('region_id', sa.String(), primary_key=True),
        sa.Column('data_hash', sa.String(), nullable=False),
        sa.Column('loaded_at', sa.DateTime(timezone=True), nullable=False)
    )

    # 3. district
    op.create_table(
        'district',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('region_id', sa.String(), sa.ForeignKey('region.id'), nullable=True),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('state', sa.String(), nullable=False),
        sa.Column('lgd_code', sa.String(), nullable=True)
    )

    # 4. block
    op.create_table(
        'block',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('region_id', sa.String(), sa.ForeignKey('region.id'), nullable=True),
        sa.Column('district_id', sa.String(), sa.ForeignKey('district.id'), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('lgd_code', sa.String(), nullable=True),
        sa.Column('geometry', Geometry('POLYGON', srid=4326, spatial_index=True), nullable=True)
    )

    # 5. panchayat
    op.create_table(
        'panchayat',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('region_id', sa.String(), sa.ForeignKey('region.id'), nullable=True),
        sa.Column('block_id', sa.String(), sa.ForeignKey('block.id'), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('lgd_code', sa.String(), nullable=True),
        sa.Column('geometry', Geometry('POLYGON', srid=4326, spatial_index=True), nullable=True),
        sa.Column('is_synthetic_boundary', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('boundary_is_official', sa.Boolean(), nullable=False, server_default=sa.text('false'))
    )

    # 6. grid_cell
    op.create_table(
        'grid_cell',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('region_id', sa.String(), sa.ForeignKey('region.id'), nullable=True),
        sa.Column('block_id', sa.String(), sa.ForeignKey('block.id'), nullable=False),
        sa.Column('geometry', Geometry('POLYGON', srid=4326, spatial_index=True), nullable=False),
        sa.Column('centroid', Geometry('POINT', srid=4326, spatial_index=True), nullable=False)
    )

    # 7. environmental_feature
    op.create_table(
        'environmental_feature',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('location_ref', sa.String(), nullable=False, index=True),
        sa.Column('feature_name', sa.String(), nullable=False, index=True),
        sa.Column('value_num', sa.Float(), nullable=True),
        sa.Column('value_str', sa.String(), nullable=True),
        sa.Column('value', sa.Float(), nullable=True),
        sa.Column('valid_from', sa.Date(), nullable=True),
        sa.Column('valid_to', sa.Date(), nullable=True),
        sa.Column('is_synthetic', sa.Boolean(), nullable=False, server_default=sa.text('true'))
    )

    # 8. weather_observation
    op.create_table(
        'weather_observation',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('location_ref', sa.String(), nullable=False),
        sa.Column('timestamp', sa.DateTime(timezone=True), nullable=False),
        sa.Column('variable', sa.String(), nullable=False),
        sa.Column('value', sa.Float(), nullable=False),
        sa.Column('source', sa.String(), nullable=False),
        sa.Column('is_synthetic', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('data_source_tag', sa.String(), nullable=False, server_default='OBSERVED')
    )
    op.create_index('idx_obs_loc_time_var', 'weather_observation', ['location_ref', 'timestamp', 'variable'])

    # 9. weather_forecast
    op.create_table(
        'weather_forecast',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('block_id', sa.String(), sa.ForeignKey('block.id'), nullable=False),
        sa.Column('forecast_date', sa.Date(), nullable=False),
        sa.Column('target_date', sa.Date(), nullable=False),
        sa.Column('horizon_days', sa.Integer(), nullable=False),
        sa.Column('variable', sa.String(), nullable=False),
        sa.Column('value', sa.Float(), nullable=False),
        sa.Column('is_synthetic', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('data_source_tag', sa.String(), nullable=False, server_default='FORECAST')
    )
    op.create_index('idx_fcst_block_target_fcst_var', 'weather_forecast', ['block_id', 'target_date', 'forecast_date', 'variable'])

    # 10. model_version
    op.create_table(
        'model_version',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('region_id', sa.String(), nullable=True),
        sa.Column('variable', sa.String(), nullable=False),
        sa.Column('model_type', sa.String(), nullable=False),
        sa.Column('training_window', sa.String(), nullable=False),
        sa.Column('feature_schema_hash', sa.String(), nullable=False),
        sa.Column('validation_metrics', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False)
    )

    # 11. baseline_prediction
    op.create_table(
        'baseline_prediction',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('location_ref', sa.String(), nullable=False),
        sa.Column('forecast_date', sa.Date(), nullable=False),
        sa.Column('target_date', sa.Date(), nullable=False),
        sa.Column('horizon_days', sa.Integer(), nullable=False),
        sa.Column('variable', sa.String(), nullable=False),
        sa.Column('value', sa.Float(), nullable=False),
        sa.Column('model_version_id', sa.String(), sa.ForeignKey('model_version.id'), nullable=False),
        sa.Column('is_synthetic', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('data_source_tag', sa.String(), nullable=False, server_default='BASELINE')
    )

    # 12. ml_prediction
    op.create_table(
        'ml_prediction',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('location_ref', sa.String(), nullable=False),
        sa.Column('forecast_date', sa.Date(), nullable=False),
        sa.Column('target_date', sa.Date(), nullable=False),
        sa.Column('horizon_days', sa.Integer(), nullable=False),
        sa.Column('variable', sa.String(), nullable=False),
        sa.Column('value', sa.Float(), nullable=False),
        sa.Column('model_version_id', sa.String(), sa.ForeignKey('model_version.id'), nullable=False),
        sa.Column('is_synthetic', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('data_source_tag', sa.String(), nullable=False, server_default='ML_DOWNSCALED')
    )

    # 13. prediction_uncertainty
    op.create_table(
        'prediction_uncertainty',
        sa.Column('prediction_id', sa.Integer(), sa.ForeignKey('ml_prediction.id'), primary_key=True),
        sa.Column('p10', sa.Float(), nullable=True),
        sa.Column('p50', sa.Float(), nullable=True),
        sa.Column('p90', sa.Float(), nullable=True),
        sa.Column('uncertainty_label', sa.String(), nullable=True)
    )

    # 14. crop
    op.create_table(
        'crop',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('name', sa.String(), nullable=False)
    )

    # 15. crop_stage
    op.create_table(
        'crop_stage',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('crop_id', sa.String(), sa.ForeignKey('crop.id'), nullable=False),
        sa.Column('stage_name', sa.String(), nullable=False),
        sa.Column('sensitive_thresholds', sa.String(), nullable=True)
    )

    # 16. advisory
    op.create_table(
        'advisory',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('location_ref', sa.String(), nullable=False),
        sa.Column('crop_id', sa.String(), sa.ForeignKey('crop.id'), nullable=True),
        sa.Column('crop_stage_id', sa.String(), sa.ForeignKey('crop_stage.id'), nullable=True),
        sa.Column('rule_id', sa.String(), nullable=False),
        sa.Column('message', sa.String(), nullable=False),
        sa.Column('uncertainty_label', sa.String(), nullable=True),
        sa.Column('prediction_id', sa.Integer(), sa.ForeignKey('ml_prediction.id'), nullable=True),
        sa.Column('issued_at', sa.DateTime(timezone=True), nullable=False)
    )

    # 17. app_user
    op.create_table(
        'app_user',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('role', sa.String(), nullable=False)
    )


def downgrade() -> None:
    op.drop_table('app_user')
    op.drop_table('advisory')
    op.drop_table('crop_stage')
    op.drop_table('crop')
    op.drop_table('prediction_uncertainty')
    op.drop_table('ml_prediction')
    op.drop_table('baseline_prediction')
    op.drop_table('model_version')
    op.drop_index('idx_fcst_block_target_fcst_var', table_name='weather_forecast')
    op.drop_table('weather_forecast')
    op.drop_index('idx_obs_loc_time_var', table_name='weather_observation')
    op.drop_table('weather_observation')
    op.drop_table('environmental_feature')
    op.drop_table('grid_cell')
    op.drop_table('panchayat')
    op.drop_table('block')
    op.drop_table('district')
    op.drop_table('region_load_state')
    op.drop_table('region')
