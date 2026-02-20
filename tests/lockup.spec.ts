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
        const globals = await page.evaluate(() => Object.keys(globalThis).filter(k => k.includes('POWERSYNC') || k.includes('powersync')));
        throw new Error(`PowerSync not found on globalThis after 25s. Found similar globals: ${globals.join(', ')}`);
    }

    await page.evaluate(async () => {
        const db = (globalThis as any).powersync;
        console.log('PowerSync found, injecting data...');

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
        page.on('console', msg => console.log(`BROWSER [${msg.type()}]: ${msg.text()}`));
        await mockLogin(page);
        await page.goto('/');
        await mockData(page);
    });

    test('should open spray log session without locking up', async ({ page }) => {
        console.log('Navigating to LOG tab...');
        // Log tab is usually default, but let's click it to be sure
        const logTab = page.getByTestId('tab-LOG');
        if (await logTab.isVisible()) {
            await logTab.click();
        }

        console.log('Clicking Spray button...');
        const sprayBtn = page.getByTestId('log-action-spray');
        await expect(sprayBtn).toBeVisible();
        await sprayBtn.click();

        console.log('Selecting field...');
        const fieldItem = page.getByTestId('field-item-field-1');
        await expect(fieldItem).toBeVisible();
        await fieldItem.click();

        console.log('Clicking Start Spraying in action sheet...');
        const startSprayingBtn = page.getByTestId('action-start-spraying');
        await expect(startSprayingBtn).toBeVisible();
        await startSprayingBtn.click();

        console.log('Verifying LogSessionScreen is visible...');
        try {
            await expect(page.getByText('SPRAY Log')).toBeVisible({ timeout: 15000 });
            console.log('Success: No lockup detected.');
        } catch (e) {
            console.error('Lockup or error detected! Taking screenshot...');
            await page.screenshot({ path: 'test-results/lockup-failure.png' });
            throw e;
        }
    });
});
