-- Phase 1: Rent Agreements + Field Ownership
-- Migration to support CASH and SHARE rent types

-- 1. Create Tables
CREATE TABLE IF NOT EXISTS rent_agreements (
    id TEXT PRIMARY KEY,
    farm_id TEXT NOT NULL,
    landlord_id TEXT NOT NULL,
    crop_year INTEGER NOT NULL,
    rent_type TEXT NOT NULL, -- 'CASH' or 'SHARE'
    landlord_share_pct FLOAT, -- NULL unless SHARE
    cash_rent_per_acre FLOAT, -- NULL unless CASH
    cash_rent_total FLOAT,    -- Optional
    split_basis TEXT DEFAULT 'BUSHELS', -- 'BUSHELS' or 'PROCEEDS'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agreement_fields (
    agreement_id TEXT NOT NULL,
    field_id TEXT NOT NULL,
    farm_id TEXT NOT NULL,
    PRIMARY KEY (agreement_id, field_id)
);

-- 2. Enable RLS
ALTER TABLE rent_agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE agreement_fields ENABLE ROW LEVEL SECURITY;

-- 3. Apply RLS Policies
-- Agreements: standard membership check
CREATE POLICY "Data Access RentAgreements" ON rent_agreements FOR ALL USING (check_farm_membership(farm_id));

-- AgreementLinks: standard membership check
CREATE POLICY "Data Access AgreementFields" ON agreement_fields FOR ALL USING (check_farm_membership(farm_id));

-- 4. Trigger for updated_at on rent_agreements
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_rent_agreements_updated_at 
BEFORE UPDATE ON rent_agreements 
FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
