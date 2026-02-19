-- Migration: Planting Updates (Phase 1)
-- Description: Add planted_at column, backfill data, and eventually deprecate start/end time.

-- 1. Add planted_at column
ALTER TABLE planting_logs ADD COLUMN IF NOT EXISTS planted_at TIMESTAMPTZ;

-- 2. Backfill existing data
-- Prioritize start_time, then end_time, then created_at, then NOW()
UPDATE planting_logs
SET planted_at = COALESCE(
    CAST(start_time AS TIMESTAMPTZ),
    CAST(end_time AS TIMESTAMPTZ),
    created_at,
    NOW()
)
WHERE planted_at IS NULL;

-- 3. Make it NOT NULL after backfill
ALTER TABLE planting_logs ALTER COLUMN planted_at SET NOT NULL;
