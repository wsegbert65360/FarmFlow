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

async function injectAppData(page: Page) {
    console.log('Injecting baseline app data...');
    // Wait for Powersync exposure
    let found = false;
    for (let i = 0; i < 40; i++) {
        found = await page.evaluate(() => (globalThis as any).powersync !== undefined);
        if (found) break;
        await page.waitForTimeout(500);
    }

    if (found) {
        await page.evaluate(async () => {
            const db = (globalThis as any).powersync;
            // Settings
            await db.execute(
                `INSERT OR REPLACE INTO settings (id, farm_name, state, units, onboarding_completed, farm_id, updated_at) 
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                ['farm_config', 'Chaos Audit Farm', 'Iowa', 'US', 1, 'chaos-farm-id', new Date().toISOString()]
            );
            // Fields
            await db.execute(
                `INSERT OR REPLACE INTO fields (id, name, acreage, farm_id, created_at)
                 VALUES (?, ?, ?, ?, ?)`,
                ['field-chaos-1', 'Audit Field 1', 160, 'chaos-farm-id', new Date().toISOString()]
            );
        });
        await page.waitForTimeout(1000);
    }
}

test('Recursive UI Discovery and Stress Test', async ({ page }) => {
    test.setTimeout(300000); // 5 minutes
    await mockLogin(page);
    await page.goto('/');
    await injectAppData(page);

    const interactives = page.locator('button, a, [role="button"], [data-testid], [accessibilityrole="button"]');
    const count = await interactives.count();
    console.log(`Found ${count} interactive elements.`);

    const errors: string[] = [];

    for (let i = 0; i < count; i++) {
        try {
            const el = interactives.nth(i);
            if (await el.isVisible() && await el.isEnabled()) {
                const text = await el.textContent().catch(() => '') || await el.getAttribute('aria-label').catch(() => '') || await el.getAttribute('data-testid').catch(() => '') || `Element ${i}`;
                console.log(`Testing element ${i}: "${text.trim().substring(0, 30)}"`);

                await el.click({ timeout: 5000 }).catch(e => console.log(`Click timed out for element ${i}`));
                await page.waitForTimeout(1000);

                const errorCount = await page.locator('text=Error, text=Exception, text=Something went wrong').count();
                if (errorCount > 0) {
                    const errorMsg = `CRASH DETECTED at element ${i} ("${text}")`;
                    console.error(errorMsg);
                    errors.push(errorMsg);
                    await page.screenshot({ path: `test-results/chaos-crash-${i}.png` });
                }

                // Reset to home for next element
                await page.goto('/');
                await page.waitForTimeout(2000);
            }
        } catch (e: any) {
            console.error(`Element ${i} interaction failed: ${e.message}`);
        }
    }
});
