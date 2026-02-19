-- Migration for Phase 2: Grain Lots + Lot Movements

CREATE TABLE IF NOT EXISTS grain_lots (
    id TEXT PRIMARY KEY,
    farm_id TEXT NOT NULL,
    crop_type TEXT NOT NULL,
    crop_year INTEGER NOT NULL,
    source_field_id TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for grain_lots
ALTER TABLE grain_lots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can only access their farm's grain lots" ON grain_lots
    FOR ALL USING (check_farm_membership(farm_id));

CREATE TABLE IF NOT EXISTS lot_movements (
    id TEXT PRIMARY KEY,
    farm_id TEXT NOT NULL,
    lot_id TEXT NOT NULL REFERENCES grain_lots(id) ON DELETE CASCADE,
    movement_type TEXT NOT NULL, -- 'INTO_BIN', 'OUT_OF_BIN', 'DIRECT_TO_TOWN'
    bin_id TEXT, -- NULL for DIRECT_TO_TOWN
    destination_name TEXT, -- NULL for INTO_BIN
    bushels_net FLOAT NOT NULL,
    moisture FLOAT,
    test_weight FLOAT,
    occurred_at TIMESTAMPTZ NOT NULL,
    note TEXT,
    source_grain_log_id TEXT, -- For back-linking to legacy grain_logs
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for lot_movements
ALTER TABLE lot_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can only access their farm's lot movements" ON lot_movements
    FOR ALL USING (check_farm_membership(farm_id));

-- Trigger for updated_at
CREATE TRIGGER update_grain_lots_modtime BEFORE UPDATE ON grain_lots FOR EACH ROW EXECUTE FUNCTION update_modified_column();
CREATE TRIGGER update_lot_movements_modtime BEFORE UPDATE ON lot_movements FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_lot_movements_bin_id ON lot_movements(bin_id);
CREATE INDEX IF NOT EXISTS idx_lot_movements_lot_id ON lot_movements(lot_id);
CREATE INDEX IF NOT EXISTS idx_grain_lots_field_year ON grain_lots(source_field_id, crop_year);
