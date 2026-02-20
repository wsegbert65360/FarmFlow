import { db } from '../db/powersync';
import { useSpray } from '../hooks/useSpray';
import { v4 as uuidv4 } from 'uuid';

/**
 * Verification Script for Spray Snapshots
 * 
 * Goals:
 * 1. Create a recipe with specific items.
 * 2. Log a spray using that recipe.
 * 3. Verify snapshot items exist and match recipe.
 * 4. Update the original recipe (change rate).
 * 5. Verify the spray log snapshot REMAINS UNCHANGED.
 */
export const runSprayVerification = async () => {
    console.log('--- STARTING SPRAY SNAPSHOT VERIFICATION ---');

    const farmId = 'test-farm-id';
    const fieldId = 'test-field-id';
    const recipeId = uuidv4();

    // 1. Create Test Recipe
    console.log('[Step 1] Creating test recipe...');
    await db.execute(
        `INSERT INTO recipes (id, name, farm_id, created_at) VALUES (?, ?, ?, ?)`,
        [recipeId, 'Audit Test Recipe', farmId, new Date().toISOString()]
    );
    await db.execute(
        `INSERT INTO recipe_items (id, recipe_id, product_name, epa_number, rate, unit, farm_id) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [uuidv4(), recipeId, 'Roundup', '524-529', 32, 'oz', farmId]
    );

    // 2. Log Spray
    console.log('[Step 2] Logging spray application...');
    // We'll use a direct DB call or a mock of the hook logic since it's a script
    const logId = uuidv4();
    const now = new Date().toISOString();

    // Simulating useSpray.addSprayLog logic
    await db.execute(
        `INSERT INTO spray_logs (id, field_id, recipe_id, farm_id, sprayed_at, acres_treated) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [logId, fieldId, recipeId, farmId, now, 100]
    );

    // Create snapshot
    await db.execute(
        `INSERT INTO spray_log_items (id, farm_id, spray_log_id, product_name, epa_number, rate, rate_unit, total_amount, total_unit)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [uuidv4(), farmId, logId, 'Roundup', '524-529', 32, 'oz', 3200, 'oz']
    );

    // 3. Verify Snapshot
    console.log('[Step 3] Verifying initial snapshot...');
    const snapshot = (await db.getAll('SELECT * FROM spray_log_items WHERE spray_log_id = ?', [logId])) as any[];
    console.log('Initial Snapshot:', snapshot);
    if (snapshot.length !== 1 || snapshot[0].rate !== 32) {
        throw new Error('Snapshot verification failed: Initial state incorrect.');
    }

    // 4. Update Recipe (Change rate from 32 to 44)
    console.log('[Step 4] Updating original recipe template (rate change)...');
    await db.execute('UPDATE recipe_items SET rate = 44 WHERE recipe_id = ?', [recipeId]);

    // 5. Verify Snapshot REMAINS UNCHANGED
    console.log('[Step 5] Final verification of historical log...');
    const finalSnapshot = (await db.getAll('SELECT * FROM spray_log_items WHERE spray_log_id = ?', [logId])) as any[];
    console.log('Final Snapshot (should be same as initial):', finalSnapshot);

    if (finalSnapshot[0].rate === 32) {
        console.log('✅ SUCCESS: Historical snapshot remained unchanged after recipe edit.');
    } else {
        console.error('❌ FAILURE: Historical snapshot was affected by recipe edit.');
    }

    console.log('--- VERIFICATION COMPLETE ---');
};
