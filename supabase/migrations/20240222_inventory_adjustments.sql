-- 1. Create inventory_adjustments table
CREATE TABLE IF NOT EXISTS inventory_adjustments (
    id TEXT PRIMARY KEY,
    farm_id TEXT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    product_name TEXT NOT NULL,
    amount REAL NOT NULL, -- positive = addition, negative = deduction
    reason TEXT NOT NULL, -- e.g. 'LOG_CREATED', 'LOG_VOIDED', 'MANUAL_ADJUST'
    reference_id TEXT, -- links to spray_log_id or similar
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Trigger function to update total quantity in inventory table
CREATE OR REPLACE FUNCTION update_inventory_on_adjustment()
RETURNS TRIGGER AS $$
BEGIN
    -- Update existing inventory record
    UPDATE inventory 
    SET quantity_on_hand = quantity_on_hand + NEW.amount
    WHERE product_name = NEW.product_name AND farm_id = NEW.farm_id;

    -- If no record existed, create one (might be negative if starting with a log)
    IF NOT FOUND THEN
        INSERT INTO inventory (id, farm_id, product_name, quantity_on_hand, unit, created_at)
        VALUES (uuid_generate_v4()::text, NEW.farm_id, NEW.product_name, NEW.amount, 'Gal', NOW());
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. The trigger
DROP TRIGGER IF EXISTS tr_inventory_adjustment ON inventory_adjustments;
CREATE TRIGGER tr_inventory_adjustment
AFTER INSERT ON inventory_adjustments
FOR EACH ROW
EXECUTE FUNCTION update_inventory_on_adjustment();

-- 4. Enable RLS
ALTER TABLE inventory_adjustments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Data Access InventoryAdjustments" ON inventory_adjustments 
FOR ALL USING (check_farm_membership(farm_id));

-- 5. Helper trigger for updated_at
CREATE TRIGGER set_updated_at_inventory_adjustments
BEFORE UPDATE ON inventory_adjustments
FOR EACH ROW
EXECUTE FUNCTION handle_updated_at();
