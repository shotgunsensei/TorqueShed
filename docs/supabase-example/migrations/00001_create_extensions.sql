-- Migration: 00001_create_extensions
-- Description: Enable required PostgreSQL extensions
-- Created: 2026-01-16

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable pg_trgm for text search (future use)
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
