-- KrishiMitra - PostgreSQL + PostGIS Initialization
-- Alembic is the single source of truth for tables.
-- init.sql only initializes required spatial extensions.

CREATE EXTENSION IF NOT EXISTS postgis;
