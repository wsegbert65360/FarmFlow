-- FarmFlow Initial Schema (PostgreSQL / Supabase)
-- This schema supports offline-first event-sourcing with PowerSync.

-- 1. Events Table (The Source of Truth)
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    applied BOOLEAN DEFAULT FALSE
);

-- 2. Projections (The Current State)
CREATE TABLE fields (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    acreage FLOAT NOT NULL,
    last_gps_lat FLOAT,
    last_gps_long FLOAT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE recipes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    product_name TEXT NOT NULL,
    epa_number TEXT,
    rate_per_acre FLOAT NOT NULL,
    water_rate_per_acre FLOAT, -- gallons of water per acre
    phi_days INTEGER,
    rei_hours INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE seed_varieties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand TEXT NOT NULL,
    variety_name TEXT NOT NULL,
    type TEXT NOT NULL, -- e.g., 'Corn', 'Soybeans'
    default_population FLOAT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE spray_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    field_id UUID REFERENCES fields(id),
    recipe_id UUID REFERENCES recipes(id),
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ,
    total_gallons FLOAT,
    total_product FLOAT,
    weather_temp FLOAT,
    weather_wind_speed FLOAT,
    weather_wind_dir TEXT,
    weather_humidity FLOAT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE planting_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    field_id UUID REFERENCES fields(id),
    seed_id UUID REFERENCES seed_varieties(id),
    population FLOAT,
    depth FLOAT,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE bins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    capacity FLOAT, -- total capacity in bushels
    crop_type TEXT, -- e.g., 'Corn'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE grain_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL, -- 'HARVEST' (Field -> Bin) or 'DELIVERY' (Bin -> Elevator)
    field_id UUID REFERENCES fields(id),
    bin_id UUID REFERENCES bins(id),
    destination_type TEXT, -- 'BIN' or 'ELEVATOR'
    destination_name TEXT, -- Elevator name if not a bin
    bushels_net FLOAT NOT NULL,
    moisture FLOAT,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    commodity TEXT NOT NULL,
    total_bushels FLOAT NOT NULL,
    price_per_bushel FLOAT,
    delivery_deadline TIMESTAMPTZ,
    destination_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_name TEXT UNIQUE NOT NULL,
    quantity_on_hand FLOAT DEFAULT 0,
    unit TEXT NOT NULL -- e.g., 'gal', 'oz', 'lb'
);

CREATE TABLE settings (
    id TEXT PRIMARY KEY, -- 'farm_config'
    farm_name TEXT,
    state TEXT,
    units TEXT DEFAULT 'US', -- 'US' or 'Metric'
    onboarding_completed BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- PowerSync Publication
-- This tells PowerSync which tables to sync to the mobile devices.
-- Typically handled in the PowerSync dashboard, but here for reference.
/*
CREATE PUBLICATION powersync FOR TABLE fields, recipes, spray_logs, inventory;
*/
