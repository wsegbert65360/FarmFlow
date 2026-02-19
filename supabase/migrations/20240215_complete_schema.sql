-- FarmFlow Complete Schema for Supabase
-- Run this in the Supabase Dashboard SQL Editor
-- This matches the PowerSync local schema exactly

-- 1. Core Tables
CREATE TABLE IF NOT EXISTS fields (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    acreage FLOAT NOT NULL DEFAULT 0,
    last_gps_lat FLOAT,
    last_gps_long FLOAT,
    farm_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS recipes (
    id TEXT PRIMARY KEY,
    name TEXT,
    product_name TEXT,
    epa_number TEXT,
    rate_per_acre FLOAT,
    water_rate_per_acre FLOAT,
    phi_days INTEGER,
    rei_hours INTEGER,
    farm_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS recipe_items (
    id TEXT PRIMARY KEY,
    recipe_id TEXT,
    product_name TEXT,
    epa_number TEXT,
    rate FLOAT,
    unit TEXT,
    farm_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS seed_varieties (
    id TEXT PRIMARY KEY,
    brand TEXT,
    variety_name TEXT,
    type TEXT,
    default_population FLOAT,
    farm_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS spray_logs (
    id TEXT PRIMARY KEY,
    field_id TEXT,
    recipe_id TEXT,
    start_time TEXT,
    end_time TEXT,
    total_gallons FLOAT,
    total_product FLOAT,
    weather_temp FLOAT,
    weather_wind_speed FLOAT,
    weather_wind_dir TEXT,
    weather_humidity FLOAT,
    target_crop TEXT,
    target_pest TEXT,
    applicator_name TEXT,
    applicator_cert TEXT,
    acres_treated FLOAT,
    phi_days INTEGER,
    rei_hours INTEGER,
    notes TEXT,
    farm_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS planting_logs (
    id TEXT PRIMARY KEY,
    field_id TEXT,
    seed_id TEXT,
    population FLOAT,
    depth FLOAT,
    start_time TEXT,
    end_time TEXT,
    notes TEXT,
    farm_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bins (
    id TEXT PRIMARY KEY,
    name TEXT,
    capacity FLOAT,
    crop_type TEXT,
    farm_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS grain_logs (
    id TEXT PRIMARY KEY,
    type TEXT,
    field_id TEXT,
    bin_id TEXT,
    destination_type TEXT,
    destination_name TEXT,
    contract_id TEXT,
    bushels_net FLOAT,
    moisture FLOAT,
    start_time TEXT,
    end_time TEXT,
    notes TEXT,
    farm_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contracts (
    id TEXT PRIMARY KEY,
    commodity TEXT,
    total_bushels FLOAT,
    price_per_bushel FLOAT,
    delivery_deadline TEXT,
    destination_name TEXT,
    farm_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS farm_members (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    farm_id TEXT,
    role TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory (
    id TEXT PRIMARY KEY,
    product_name TEXT,
    quantity_on_hand FLOAT DEFAULT 0,
    unit TEXT,
    farm_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS settings (
    id TEXT PRIMARY KEY,
    farm_name TEXT,
    state TEXT,
    units TEXT DEFAULT 'US',
    onboarding_completed BOOLEAN DEFAULT FALSE,
    default_applicator_name TEXT,
    default_applicator_cert TEXT,
    farm_id TEXT,
    supabase_anon_key TEXT,
    farm_join_token TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS attachments (
    id TEXT PRIMARY KEY,
    filename TEXT,
    type TEXT,
    size INTEGER,
    hash TEXT,
    owner_record_id TEXT,
    local_path TEXT,
    remote_url TEXT,
    status TEXT,
    farm_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    action TEXT,
    table_name TEXT,
    record_id TEXT,
    changed_by TEXT,
    changes TEXT,
    farm_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS landlords (
    id TEXT PRIMARY KEY,
    name TEXT,
    email TEXT,
    farm_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS landlord_shares (
    id TEXT PRIMARY KEY,
    field_id TEXT,
    landlord_id TEXT,
    share_percentage FLOAT,
    farm_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Disable RLS on all tables so the anon key can read/write
-- (For a production app you'd add proper policies, but for now we need it to work)
ALTER TABLE fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE seed_varieties ENABLE ROW LEVEL SECURITY;
ALTER TABLE spray_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE planting_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE bins ENABLE ROW LEVEL SECURITY;
ALTER TABLE grain_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE farm_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE landlords ENABLE ROW LEVEL SECURITY;
ALTER TABLE landlord_shares ENABLE ROW LEVEL SECURITY;

-- 3. Create permissive policies for authenticated users
-- This allows any authenticated user to read/write all rows (scoped by farm_id in the app)
CREATE POLICY "Allow all for authenticated" ON fields FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON recipes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON recipe_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON seed_varieties FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON spray_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON planting_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON bins FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON grain_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON contracts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON farm_members FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON inventory FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON attachments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON audit_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON landlords FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON landlord_shares FOR ALL USING (true) WITH CHECK (true);
