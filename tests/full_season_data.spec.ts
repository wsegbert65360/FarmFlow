import { test, expect } from '@playwright/test';
import { db } from '../src/db/powersync';
import { v4 as uuidv4 } from 'uuid';

/**
 * FULL SEASON DATA INTEGRITY TEST
 * This test runs in the browser environment via Playwright to ensure 
 * the data layer (PowerSync) handles the full lifecycle correctly.
 */
test('Data Integrity: Field → Planting → Spraying → Harvest → Bin', async ({ page }) => {
    // We use page.evaluate to run the database logic in the browser context
    // where PowerSync is initialized and the schema is applied.
    await page.goto('/');

    // Wait for DB to be defined
    await page.waitForFunction(() => (window as any).powersync !== undefined);

    const result = await page.evaluate(async () => {
        const db = (window as any).powersync;
        const farmId = 'dev-guest-farm';
        const results = [];

        try {
            // Step A: Add Field
            const fieldId = 'field-integrity-test';
            await db.execute(
                'INSERT OR REPLACE INTO fields (id, farm_id, name, acreage, created_at) VALUES (?, ?, ?, ?, ?)',
                [fieldId, farmId, 'Integrity Section', 100, new Date().toISOString()]
            );
            results.push({ step: 'Add Field', status: 'PASS' });

            // Step B: Planting
            const seedId = 'seed-integrity-test';
            await db.execute('INSERT OR REPLACE INTO seed_varieties (id, farm_id, brand, variety_name, type) VALUES (?, ?, ?, ?, ?)',
                [seedId, farmId, 'Pioneer', 'P1197', 'Corn']);

            await db.execute(
                'INSERT INTO planting_logs (id, farm_id, field_id, seed_id, population, depth, planted_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                ['pl-1', farmId, fieldId, seedId, 32000, 1.5, new Date().toISOString(), new Date().toISOString()]
            );
            results.push({ step: 'Planting', status: 'PASS' });

            // Step C: Spraying
            const recipeId = 'recipe-integrity-test';
            await db.execute('INSERT OR REPLACE INTO recipes (id, farm_id, name) VALUES (?, ?, ?)', [recipeId, farmId, 'Integrity Recipe']);

            await db.execute(
                'INSERT INTO spray_logs (id, farm_id, field_id, recipe_id, weather_temp, weather_wind_speed, weather_wind_dir, sprayed_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                ['sl-1', farmId, fieldId, recipeId, 72, 8, 'NW', new Date().toISOString(), new Date().toISOString()]
            );
            results.push({ step: 'Spraying', status: 'PASS' });

            // Step D: Harvest to Bin
            const binId = 'bin-integrity-test';
            await db.execute('INSERT OR REPLACE INTO bins (id, farm_id, name, capacity, crop_type) VALUES (?, ?, ?, ?, ?)',
                [binId, farmId, 'Integrity Bin', 50000, 'Corn']);

            const harvestLogId = 'hl-1';
            await db.execute(
                'INSERT INTO grain_logs (id, farm_id, type, field_id, bin_id, destination_type, bushels_net, end_time, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [harvestLogId, farmId, 'HARVEST', fieldId, binId, 'BIN', 20000, new Date().toISOString(), new Date().toISOString()]
            );

            // Movement Logic
            const lotId = 'lot-integrity-test';
            await db.execute('INSERT OR REPLACE INTO grain_lots (id, farm_id, crop_type, crop_year, source_field_id) VALUES (?, ?, ?, ?, ?)',
                [lotId, farmId, 'Corn', 2026, fieldId]);
            await db.execute(
                'INSERT INTO lot_movements (id, farm_id, lot_id, movement_type, bin_id, bushels_net, occurred_at, source_grain_log_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                ['mov-1', farmId, lotId, 'INTO_BIN', binId, 20000, new Date().toISOString(), harvestLogId]
            );
            results.push({ step: 'Harvest', status: 'PASS' });

            // Audit
            const movementRows = await db.getAll('SELECT SUM(bushels_net) as total FROM lot_movements WHERE bin_id = ? AND movement_type = "INTO_BIN" AND farm_id = ?', [binId, farmId]);
            if (movementRows[0].total === 20000) {
                results.push({ step: 'Inventory Audit', status: 'PASS' });
            } else {
                results.push({ step: 'Inventory Audit', status: 'FAIL', details: `Expected 20,000, found ${movementRows[0].total}` });
            }

            return { success: true, results };
        } catch (e: any) {
            return { success: false, error: e.message };
        }
    });

    expect(result.success).toBe(true);
    const failStep = result.results?.find(r => r.status === 'FAIL');
    expect(failStep).toBeUndefined();
});
