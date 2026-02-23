
import { db } from '../src/db/powersync';
import { v4 as uuidv4 } from 'uuid';

/**
 * FULL SEASON INTEGRATION TEST (Lead QA Edition)
 * Lifecycle: Field -> Planting -> Spraying -> Harvest -> Bin
 */

async function runFullSeasonTest() {
    console.log('--- STARTING FULL SEASON INTEGRATION TEST ---');
    const farmId = 'dev-guest-farm'; // Match dev user
    const results = [];

    try {
        // Step A: Add Field "Test Section 1"
        console.log('[Step A] Adding Field...');
        const fieldId = uuidv4();
        await db.execute(
            'INSERT INTO fields (id, farm_id, name, acreage, created_at) VALUES (?, ?, ?, ?, ?)',
            [fieldId, farmId, 'Test Section 1', 100, new Date().toISOString()]
        );
        results.push({ step: 'Add Field', status: 'PASS', details: 'Added 100 acre field: Test Section 1' });

        // Step B: Planting "P1197"
        console.log('[Step B] Planting Variety P1197...');
        const seedId = uuidv4();
        await db.execute('INSERT INTO seed_varieties (id, farm_id, brand, variety_name, type) VALUES (?, ?, ?, ?, ?)', [seedId, farmId, 'Pioneer', 'P1197', 'Corn']);

        await db.execute(
            'INSERT INTO planting_logs (id, farm_id, field_id, seed_id, population, depth, planted_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [uuidv4(), farmId, fieldId, seedId, 32000, 1.5, new Date().toISOString(), new Date().toISOString()]
        );
        results.push({ step: 'Planting', status: 'PASS', details: 'Planted P1197 at 32k pop' });

        // Step C: Spraying with Weather Capture
        console.log('[Step C] Spraying & Weather Audit...');
        const recipeId = uuidv4();
        await db.execute('INSERT INTO recipes (id, farm_id, name) VALUES (?, ?, ?)', [recipeId, farmId, 'Test Recipe']);

        const sprayId = uuidv4();
        await db.execute(
            'INSERT INTO spray_logs (id, farm_id, field_id, recipe_id, weather_temp, weather_wind_speed, weather_wind_dir, sprayed_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [sprayId, farmId, fieldId, recipeId, 72, 8, 'NW', new Date().toISOString(), new Date().toISOString()]
        );
        results.push({ step: 'Spraying', status: 'PASS', details: 'Weather Captured: 72F, 8mph NW' });

        // Step D: Harvest 20,000 bu to Bin A
        console.log('[Step D] Harvesting to Bin A...');
        const binId = uuidv4();
        await db.execute('INSERT INTO bins (id, farm_id, name, capacity, crop_type) VALUES (?, ?, ?, ?, ?)', [binId, farmId, 'Bin A', 50000, 'Corn']);

        const harvestLogId = uuidv4();
        await db.execute(
            'INSERT INTO grain_logs (id, farm_id, type, field_id, bin_id, destination_type, bushels_net, end_time, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [harvestLogId, farmId, 'HARVEST', fieldId, binId, 'BIN', 20000, new Date().toISOString(), new Date().toISOString()]
        );

        // Movement Logic (Phase 2)
        const lotId = uuidv4();
        await db.execute('INSERT INTO grain_lots (id, farm_id, crop_type, crop_year, source_field_id) VALUES (?, ?, ?, ?, ?)', [lotId, farmId, 'Corn', 2026, fieldId]);
        await db.execute(
            'INSERT INTO lot_movements (id, farm_id, lot_id, movement_type, bin_id, bushels_net, occurred_at, source_grain_log_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [uuidv4(), farmId, lotId, 'INTO_BIN', binId, 20000, new Date().toISOString(), harvestLogId]
        );
        results.push({ step: 'Harvest', status: 'PASS', details: '20,000 bu moved to Bin A' });

        // DATABASE INTEGRITY AUDIT
        console.log('[Audit] Verifying Bin Balance...');
        const movementRows = await db.getAll('SELECT SUM(bushels_net) as total FROM lot_movements WHERE bin_id = ? AND movement_type = "INTO_BIN" AND farm_id = ?', [binId, farmId]) as any[];

        if (movementRows[0].total === 20000) {
            results.push({ step: 'Inventory Audit', status: 'PASS', details: 'Bin A confirmed at 20,000 bu' });
        } else {
            results.push({ step: 'Inventory Audit', status: 'FAIL', details: `Expected 20,000, found ${movementRows[0].total}` });
        }

        console.log('--- TEST COMPLETE ---');
        console.log(JSON.stringify(results, null, 2));

    } catch (e: any) {
        console.error('TEST FAILED:', e);
    }
}

runFullSeasonTest();
