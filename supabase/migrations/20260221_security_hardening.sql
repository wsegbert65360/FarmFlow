-- FarmFlow Security Hardening Migration
-- Drops overly permissive "Allow all" policies and re-enforces farm-based isolation.

-- 1. Helper Function (Ensure it exists and is correct)
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

-- 2. Clean up Permissive Policies
-- Based on linter report, these broad policies need to be removed.
DO $$
DECLARE
    table_name_rec RECORD;
BEGIN
    FOR table_name_rec IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Allow all for authenticated" ON %I', table_name_rec.tablename);
        EXECUTE format('DROP POLICY IF EXISTS "Allow all for users" ON %I', table_name_rec.tablename);
    END LOOP;
END $$;

-- 3. Re-enforce Standard Membership Policies
-- Ensure RLS is enabled on all critical tables
ALTER TABLE farms ENABLE ROW LEVEL SECURITY;
ALTER TABLE farm_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE bins ENABLE ROW LEVEL SECURITY;
ALTER TABLE spray_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE spray_log_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE planting_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE grain_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE landlords ENABLE ROW LEVEL SECURITY;
ALTER TABLE landlords ENABLE ROW LEVEL SECURITY;
ALTER TABLE rent_agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;

-- 4. Apply Correct Multi-Tenant Policies
-- Farms: Owner or Member access
DROP POLICY IF EXISTS "Farm Access" ON farms;
CREATE POLICY "Farm Access" ON farms FOR ALL USING (owner_id = auth.uid()::text OR check_farm_membership(id));

-- Membership & Invites
DROP POLICY IF EXISTS "Member Access" ON farm_members;
CREATE POLICY "Member Access" ON farm_members FOR ALL USING (check_farm_membership(farm_id));

DROP POLICY IF EXISTS "Invite Access" ON invites;
CREATE POLICY "Invite Access" ON invites FOR ALL USING (check_farm_membership(farm_id));

-- Data Tables (Consistent Membership Check)
CREATE POLICY "Data Access Fields" ON fields FOR ALL USING (check_farm_membership(farm_id));
CREATE POLICY "Data Access Bins" ON bins FOR ALL USING (check_farm_membership(farm_id));
CREATE POLICY "Data Access SprayLogs" ON spray_logs FOR ALL USING (check_farm_membership(farm_id));
CREATE POLICY "Data Access SprayLogItems" ON spray_log_items FOR ALL USING (check_farm_membership(farm_id));
CREATE POLICY "Data Access PlantingLogs" ON planting_logs FOR ALL USING (check_farm_membership(farm_id));
CREATE POLICY "Data Access GrainLogs" ON grain_logs FOR ALL USING (check_farm_membership(farm_id));
CREATE POLICY "Data Access Contracts" ON contracts FOR ALL USING (check_farm_membership(farm_id));
CREATE POLICY "Data Access Inventory" ON inventory FOR ALL USING (check_farm_membership(farm_id));
CREATE POLICY "Data Access InventoryAdj" ON inventory_adjustments FOR ALL USING (check_farm_membership(farm_id));
CREATE POLICY "Data Access Settings" ON settings FOR ALL USING (check_farm_membership(farm_id));
CREATE POLICY "Data Access Landlords" ON landlords FOR ALL USING (check_farm_membership(farm_id));
CREATE POLICY "Data Access RentAgreements" ON rent_agreements FOR ALL USING (check_farm_membership(farm_id));
CREATE POLICY "Data Access AuditLogs" ON audit_logs FOR ALL USING (check_farm_membership(farm_id));
CREATE POLICY "Data Access Attachments" ON attachments FOR ALL USING (check_farm_membership(farm_id));

-- 5. Final Audit
-- Check if any tables still have 'true' policies
SELECT polname, tablename 
FROM pg_policy 
WHERE polqual::text = 'true' OR polwithcheck::text = 'true';
