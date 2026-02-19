-- Phase 1: Spray Record Improvements (Snapshots & Single Timestamp)

-- 1. Update spray_logs table
ALTER TABLE spray_logs 
ADD COLUMN IF NOT EXISTS sprayed_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS weather_source TEXT DEFAULT 'AUTO',
ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS void_reason TEXT,
ADD COLUMN IF NOT EXISTS replaces_log_id UUID REFERENCES spray_logs(id);

-- Backfill sprayed_at from start_time for existing records
UPDATE spray_logs SET sprayed_at = start_time WHERE sprayed_at IS NULL;

-- 2. Create spray_log_items table for immutable snapshots
CREATE TABLE IF NOT EXISTS spray_log_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    spray_log_id UUID NOT NULL REFERENCES spray_logs(id) ON DELETE CASCADE,
    product_name TEXT NOT NULL,
    epa_number TEXT,
    rate REAL NOT NULL,
    rate_unit TEXT NOT NULL,
    total_amount REAL NOT NULL,
    total_unit TEXT NOT NULL,
    sort_order INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. RLS Policies
ALTER TABLE spray_log_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view spray_log_items for their farm"
    ON spray_log_items FOR SELECT
    USING (farm_id IN (SELECT farm_id FROM farm_members WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert spray_log_items for their farm"
    ON spray_log_items FOR INSERT
    WITH CHECK (farm_id IN (SELECT farm_id FROM farm_members WHERE user_id = auth.uid()));

CREATE POLICY "Users can update spray_log_items for their farm"
    ON spray_log_items FOR UPDATE
    USING (farm_id IN (SELECT farm_id FROM farm_members WHERE user_id = auth.uid()));

-- 4. Trigger for updated_at
CREATE TRIGGER update_spray_log_items_modtime
    BEFORE UPDATE ON spray_log_items
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_spray_log_items_log_id ON spray_log_items(spray_log_id);
CREATE INDEX IF NOT EXISTS idx_spray_log_items_farm_id ON spray_log_items(farm_id);
