import { test, expect, Page } from '@playwright/test';

async function mockLogin(page: Page) {
    const projectId = 'skkbmmxjclpbbijcrgyi';
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

async function mockData(page: Page) {
    console.log('Waiting for PowerSync exposure...');
    let found = false;
    for (let i = 0; i < 50; i++) {
        found = await page.evaluate(() => (globalThis as any).powersync !== undefined);
        if (found) break;
        await page.waitForTimeout(500);
    }

    if (!found) {
        throw new Error(`PowerSync not found on globalThis after 25s.`);
    }

    await page.evaluate(async () => {
        const db = (globalThis as any).powersync;

        // Add farm settings
        await db.execute(
            `INSERT OR REPLACE INTO settings (id, farm_name, state, units, onboarding_completed, farm_id, updated_at) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            ['farm_config', 'Repro Farm', 'Iowa', 'US', 1, 'repro-farm-id', new Date().toISOString()]
        );

        // Add a field
        await db.execute(
            `INSERT OR REPLACE INTO fields (id, name, acreage, farm_id, created_at)
             VALUES (?, ?, ?, ?, ?)`,
            ['field-1', 'North Corn Field', 160, 'repro-farm-id', new Date().toISOString()]
        );

        // Add a spray recipe
        await db.execute(
            `INSERT OR REPLACE INTO recipes (id, name, farm_id, water_rate_per_acre, created_at)
             VALUES (?, ?, ?, ?, ?)`,
            ['recipe-1', 'Pre-Emerge Repro', 'repro-farm-id', 15, new Date().toISOString()]
        );
    });
}

test.describe('Spray Button Lockup Reproduction', () => {
    test.beforeEach(async ({ page }) => {
        page.on('console', msg => {
            const text = msg.text();
            // Known benign noise during web E2E (asset loads / blocked external resources)
            if (msg.type() === 'error' && (text.includes('Failed to load resource') || text.includes('403'))) {
                return;
            }
            console.log(`BROWSER [${msg.type()}]: ${text}`);
        });
        await mockLogin(page);
        await page.goto('/');
        await mockData(page);
    });

    test('should open spray log session without locking up', async ({ page }) => {
        console.log('Verifying Fields tab is active...');
        const manageTab = page.getByTestId('tab-MANAGE');
        await expect(manageTab).toBeVisible();

        // Ensure we are on the Fields tab
        await manageTab.click();

        console.log('Clicking Spray button on Field card...');
        const sprayBtn = page.getByTestId('field-card-spray-field-1');
        await expect(sprayBtn).toBeVisible();
        await sprayBtn.click();

        console.log('Verifying LogSessionScreen is visible...');
        await expect(page.getByText('SPRAY Log')).toBeVisible({ timeout: 15000 });
        console.log('Success: No lockup detected.');
    });
});
