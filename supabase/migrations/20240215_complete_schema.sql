-- FarmFlow Complete Schema for Supabase
-- Run this in the Supabase Dashboard SQL Editor
-- This matches the PowerSync local schema exactly

-- 1. Core Tables
CREATE TABLE IF NOT EXISTS farms (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    owner_id TEXT NOT NULL, -- auth.uid()
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invites (
    id TEXT PRIMARY KEY,
    farm_id TEXT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL DEFAULT 'WORKER',
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fields (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    acreage FLOAT NOT NULL DEFAULT 0,
    last_gps_lat FLOAT,
    last_gps_long FLOAT,
    farm_id TEXT NOT NULL,
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
    farm_id TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS recipe_items (
    id TEXT PRIMARY KEY,
    recipe_id TEXT NOT NULL,
    product_name TEXT,
    epa_number TEXT,
    rate FLOAT,
    unit TEXT,
    farm_id TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS seed_varieties (
    id TEXT PRIMARY KEY,
    brand TEXT,
    variety_name TEXT,
    type TEXT,
    default_population FLOAT,
    farm_id TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS spray_logs (
    id TEXT PRIMARY KEY,
    field_id TEXT NOT NULL,
    recipe_id TEXT NOT NULL,
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
    farm_id TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS planting_logs (
    id TEXT PRIMARY KEY,
    field_id TEXT NOT NULL,
    seed_id TEXT NOT NULL,
    population FLOAT,
    depth FLOAT,
    start_time TEXT,
    end_time TEXT,
    notes TEXT,
    farm_id TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bins (
    id TEXT PRIMARY KEY,
    name TEXT,
    capacity FLOAT,
    crop_type TEXT,
    landlord_id TEXT,
    landlord_share_pct FLOAT,
    farm_id TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS grain_logs (
    id TEXT PRIMARY KEY,
    type TEXT,
    field_id TEXT,
    bin_id TEXT NOT NULL,
    destination_type TEXT,
    destination_name TEXT,
    contract_id TEXT,
    bushels_net FLOAT,
    moisture FLOAT,
    start_time TEXT,
    end_time TEXT,
    notes TEXT,
    farm_id TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contracts (
    id TEXT PRIMARY KEY,
    commodity TEXT,
    total_bushels FLOAT,
    price_per_bushel FLOAT,
    delivery_deadline TEXT,
    destination_name TEXT,
    farm_id TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS farm_members (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    farm_id TEXT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'WORKER',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory (
    id TEXT PRIMARY KEY,
    product_name TEXT,
    quantity_on_hand FLOAT DEFAULT 0,
    unit TEXT,
    farm_id TEXT NOT NULL,
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
    farm_id TEXT NOT NULL,
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
    farm_id TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    action TEXT,
    table_name TEXT,
    record_id TEXT,
    changed_by TEXT,
    changes TEXT,
    farm_id TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS landlords (
    id TEXT PRIMARY KEY,
    name TEXT,
    email TEXT,
    farm_id TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS landlord_shares (
    id TEXT PRIMARY KEY,
    field_id TEXT NOT NULL,
    landlord_id TEXT NOT NULL,
    share_percentage FLOAT,
    farm_id TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Security Configuration (RLS)
-- Define a helper function to check farm membership
CREATE OR REPLACE FUNCTION check_farm_membership(f_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM farm_members
    WHERE farm_members.farm_id = f_id
    AND farm_members.user_id = auth.uid()::text
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable RLS on all tables
ALTER TABLE farms ENABLE ROW LEVEL SECURITY;
ALTER TABLE invites ENABLE ROW LEVEL SECURITY;
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

-- Apply Membership-based RLS Policies
-- Farms: Owners see their farms, members see farms they belong to
CREATE POLICY "Farm Access" ON farms FOR ALL USING (
  owner_id = auth.uid()::text OR check_farm_membership(id)
);

-- Invites: Members of a farm can see invites for that farm
CREATE POLICY "Invite Access" ON invites FOR ALL USING (check_farm_membership(farm_id));

-- Membership: Members can see other members of their farm
CREATE POLICY "Member Access" ON farm_members FOR ALL USING (check_farm_membership(farm_id));

-- All other tables: standard membership check
CREATE POLICY "Data Access Fields" ON fields FOR ALL USING (check_farm_membership(farm_id));
CREATE POLICY "Data Access Recipes" ON recipes FOR ALL USING (check_farm_membership(farm_id));
CREATE POLICY "Data Access RecipeItems" ON recipe_items FOR ALL USING (check_farm_membership(farm_id));
CREATE POLICY "Data Access SeedVarieties" ON seed_varieties FOR ALL USING (check_farm_membership(farm_id));
CREATE POLICY "Data Access SprayLogs" ON spray_logs FOR ALL USING (check_farm_membership(farm_id));
CREATE POLICY "Data Access PlantingLogs" ON planting_logs FOR ALL USING (check_farm_membership(farm_id));
CREATE POLICY "Data Access Bins" ON bins FOR ALL USING (check_farm_membership(farm_id));
CREATE POLICY "Data Access GrainLogs" ON grain_logs FOR ALL USING (check_farm_membership(farm_id));
CREATE POLICY "Data Access Contracts" ON contracts FOR ALL USING (check_farm_membership(farm_id));
CREATE POLICY "Data Access Inventory" ON inventory FOR ALL USING (check_farm_membership(farm_id));
CREATE POLICY "Data Access Settings" ON settings FOR ALL USING (check_farm_membership(farm_id));
CREATE POLICY "Data Access Attachments" ON attachments FOR ALL USING (check_farm_membership(farm_id));
CREATE POLICY "Data Access AuditLogs" ON audit_logs FOR ALL USING (check_farm_membership(farm_id));
CREATE POLICY "Data Access Landlords" ON landlords FOR ALL USING (check_farm_membership(farm_id));
CREATE POLICY "Data Access LandlordShares" ON landlord_shares FOR ALL USING (check_farm_membership(farm_id));

-- 3. Functions & RPCs
-- Securely accept an invitation token
CREATE OR REPLACE FUNCTION accept_invite(token_text TEXT)
RETURNS TABLE (
    farm_id TEXT,
    farm_name TEXT,
    role TEXT
) AS $$
DECLARE
    target_invite RECORD;
BEGIN
    -- 1. Find and validate the invite
    SELECT i.farm_id, i.role, f.name INTO target_invite
    FROM invites i
    JOIN farms f ON f.id = i.farm_id
    WHERE i.token = token_text
    AND i.expires_at > NOW();

    IF target_invite.farm_id IS NULL THEN
        RAISE EXCEPTION 'Invalid or expired invitation token';
    END IF;

    -- 2. Create the membership (if not already a member)
    INSERT INTO farm_members (id, user_id, farm_id, role, created_at)
    VALUES (
        gen_random_uuid()::text,
        auth.uid()::text,
        target_invite.farm_id,
        target_invite.role,
        NOW()
    )
    ON CONFLICT DO NOTHING;

    -- 3. Return the farm info
    RETURN QUERY SELECT target_invite.farm_id, target_invite.name, target_invite.role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
