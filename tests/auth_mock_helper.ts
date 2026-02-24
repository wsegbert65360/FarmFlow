import { Page } from '@playwright/test';

export async function mockLogin(page: Page) {
    const projectId = 'skkbmmxjclpbbijcrgyi'; // From original vault.spec.ts
    const mockSession = {
        access_token: 'mock-token',
        refresh_token: 'mock-refresh',
        expires_at: Math.floor(Date.now() / 1000) + 360000,
        user: {
            id: 'mock-user-id',
            email: 'test@example.com',
        },
    };

    await page.addInitScript((data) => {
        (window as any).E2E_TESTING = true;
        window.localStorage.setItem(`sb-${data.projectId}-auth-token`, JSON.stringify(data.session));
    }, { projectId, session: mockSession });
}

export async function mockFarm(page: Page) {
    await page.evaluate(async () => {
        for (let i = 0; i < 100; i++) {
            if ((window as any).powersync) break;
            await new Promise(r => setTimeout(r, 200));
        }
        const db = (window as any).powersync;
        if (!db) throw new Error('PowerSync DB not found for injection');

        await db.execute(
            `INSERT OR REPLACE INTO settings (id, farm_name, state, units, onboarding_completed, farm_id, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
            ['farm_config', 'Test Farm', 'Iowa', 'US', 1, 'test-farm-id', new Date().toISOString()]
        );

        await db.execute(
            `INSERT OR REPLACE INTO fields (id, name, acreage, farm_id, created_at) VALUES (?, ?, ?, ?, ?)`,
            ['field-1', 'North 40', 40, 'test-farm-id', new Date().toISOString()]
        );

        // Seed a default seed variety so PLANTING flows are saveable
        await db.execute(
            `INSERT OR REPLACE INTO seed_varieties (id, brand, variety_name, type, default_population, farm_id, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            ['seed-1', 'Pioneer', 'P1197', 'Corn', 32000, 'test-farm-id', new Date().toISOString()]
        );

        // Seed a default spray recipe so SPRAY flows are saveable
        await db.execute(
            `INSERT OR REPLACE INTO recipes (id, name, product_name, epa_number, rate_per_acre, water_rate_per_acre, phi_days, rei_hours, farm_id, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            ['recipe-1', 'Test Herbicide Pass', 'Glyphosate', '123-ABC', 1.0, 15.0, 7, 12, 'test-farm-id', new Date().toISOString()]
        );
        await db.execute(
            `INSERT OR REPLACE INTO recipe_items (id, recipe_id, product_name, epa_number, rate, unit, farm_id, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            ['recipe-item-1', 'recipe-1', 'Glyphosate', '123-ABC', 1.0, 'qt/ac', 'test-farm-id', new Date().toISOString()]
        );

        // Seed a default bin so HARVEST (Field -> Bin) flows are testable
        await db.execute(
            `INSERT OR REPLACE INTO bins (id, name, capacity, crop_type, farm_id, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
            ['bin-1', 'Test Bin 1', 50000, 'Corn', 'test-farm-id', new Date().toISOString()]
        );
    });
}
