-- Migration: Planting Phase 3 (Corrections)
-- Description: Add voided_at, void_reason, and replaces_log_id to planting_logs

ALTER TABLE planting_logs ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ;
ALTER TABLE planting_logs ADD COLUMN IF NOT EXISTS void_reason TEXT;
ALTER TABLE planting_logs ADD COLUMN IF NOT EXISTS replaces_log_id UUID REFERENCES planting_logs(id);
