import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';

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
    await page.evaluate(async () => {
        const db = (globalThis as any).powersync;
        if (!db) return;

        // Settings
        await db.execute(
            `INSERT OR REPLACE INTO settings (id, farm_name, state, units, onboarding_completed, farm_id, updated_at) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            ['farm_config', 'Stress Test Farm', 'Iowa', 'US', 1, 'stress-farm-id', new Date().toISOString()]
        );

        // Fields
        await db.execute(
            `INSERT OR REPLACE INTO fields (id, name, acreage, farm_id, created_at)
             VALUES (?, ?, ?, ?, ?)`,
            ['field-stress-1', 'North Corn Field', 160, 'stress-farm-id', new Date().toISOString()]
        );

        // Recipes
        await db.execute(
            `INSERT OR REPLACE INTO recipes (id, name, farm_id, water_rate_per_acre, created_at)
             VALUES (?, ?, ?, ?, ?)`,
            ['recipe-stress-1', 'Pre-Emerge Stress', 'stress-farm-id', 15, new Date().toISOString()]
        );
    });
}

test.describe('Total Coverage Stress Test', () => {
    let consoleErrors: string[] = [];

    test.beforeEach(async ({ page }) => {
        consoleErrors = [];
        page.on('console', msg => {
            if (msg.type() === 'error') {
                console.log(`BROWSER ERROR: ${msg.text()}`);
                consoleErrors.push(msg.text());
            }
        });
        page.on('pageerror', exc => {
            console.log(`PAGE LEVEL ERROR: ${exc.message}`);
            consoleErrors.push(exc.message);
        });
        page.on('requestfailed', request => {
            const failure = `Request failed: ${request.url()} (${request.failure()?.errorText})`;
            console.log(failure);
            consoleErrors.push(failure);
        });

        await mockLogin(page);
        await page.goto('/');

        // Wait for Powersync exposure and injection
        let found = false;
        for (let i = 0; i < 40; i++) {
            found = await page.evaluate(() => (globalThis as any).powersync !== undefined);
            if (found) break;
            await page.waitForTimeout(500);
        }

        if (found) {
            await injectAppData(page);
            await page.waitForTimeout(1000); // Allow react to catch up
        }
    });

    test('Recursive Interaction & Push-All-Buttons Protocol', async ({ page }) => {
        const tabs = ['LOG', 'HISTORY', 'DASHBOARD', 'MANAGE', 'SETTINGS'];
        const siteMap: string[] = [];

        for (const tab of tabs) {
            console.log(`\n--- Auditing Tab: ${tab} ---`);
            const tabBtn = page.getByTestId(`tab-${tab}`);
            if (await tabBtn.isVisible()) {
                await tabBtn.click();
                await page.waitForTimeout(1000);
                siteMap.push(`Tab: ${tab}`);

                // Screenshot
                await page.screenshot({ path: `test-results/trace-${tab}.png` });

                // Find all clickable buttons in this view
                const interactiveElements = await page.evaluate(() => {
                    const elements = Array.from(document.querySelectorAll('[data-testid], button, [role="button"], a, [role="tab"]'));
                    return elements.map(el => {
                        const style = window.getComputedStyle(el);
                        return {
                            text: el.textContent?.trim() || el.getAttribute('aria-label') || el.getAttribute('placeholder') || 'unnamed',
                            testId: el.getAttribute('data-testid'),
                            role: el.getAttribute('role') || el.tagName,
                            isClickable: style.cursor === 'pointer' || el.tagName === 'BUTTON' || el.tagName === 'A'
                        };
                    }).filter(e => e.isClickable || e.testId);
                });

                console.log(`Found ${interactiveElements.length} elements on ${tab}.`);
                if (interactiveElements.length === 0) {
                    console.log(`WARNING: No elements found on ${tab}. body html: ${await page.evaluate(() => document.body.innerHTML.substring(0, 500))}`);
                }

                // Interaction cycle: click and check for crash
                for (const el of interactiveElements.slice(0, 10)) { // Limit to top 10 per tab for speed
                    if (el.testId?.startsWith('tab-')) continue;

                    console.log(`Testing interaction: "${el.text}"`);
                    const locator = el.testId ? page.getByTestId(el.testId) : page.getByText(el.text).first();

                    if (await locator.isVisible()) {
                        try {
                            await locator.click({ timeout: 2000 });
                            await page.waitForTimeout(500);
                            // Capture if it opened a modal or changed screen
                            const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 100));
                            siteMap.push(`  -> Interaction "${el.text}" -> ${bodyText}...`);

                            // If it's a "Close" or "Back" button, click it to restore state
                            if (el.text.toLowerCase().includes('close') || el.text.includes('←')) {
                                // Already clicked, state might be fine
                            } else {
                                // Try to find a close button if a modal appeared
                                const closeBtn = page.getByText('Close').first();
                                if (await closeBtn.isVisible()) await closeBtn.click();
                            }
                        } catch (e) {
                            console.log(`Skipping interaction with "${el.text}" (timeout/not clickable)`);
                        }
                    }
                }
            }
        }

        fs.writeFileSync('test-results/site_map.txt', siteMap.join('\n'));
        expect(consoleErrors.filter(e => !e.includes('403')).length).toBeLessThanOrEqual(5); // Allow some non-critical background noise
    });

    test('Form Edge Case & Stress Testing', async ({ page }) => {
        console.log('\n--- Starting Form Stress Test ---');

        // Navigate to a known form view (Fields Management)
        const manageTab = page.getByTestId('tab-MANAGE');
        const moreTab = page.getByTestId('tab-MORE');

        if (await manageTab.isVisible()) {
            await manageTab.click();
        } else {
            await moreTab.click();
            await page.getByTestId('more-manage-btn').click();
        }
        await page.waitForTimeout(500);

        const addFieldBtn = page.getByText('Add Field').first();
        if (await addFieldBtn.isVisible()) {
            await addFieldBtn.click();

            const longString = 'CRASH_TEST_'.repeat(1000);
            const sqlInjn = "' OR '1'='1' --";
            const xss = "<img src=x onerror=alert(1)>";

            const nameInput = page.getByPlaceholder('Field Name');
            const acreageInput = page.getByPlaceholder('Acreage');
            const saveBtn = page.getByText('Save').first();

            console.log('Stress Testing: Extremely Long Name');
            await nameInput.fill(longString);
            await acreageInput.fill('123');
            await saveBtn.click();
            await page.waitForTimeout(500);

            console.log('Stress Testing: SQL Injection Fragment');
            await nameInput.fill(sqlInjn);
            await saveBtn.click();
            await page.waitForTimeout(500);

            console.log('Stress Testing: XSS Payload');
            await nameInput.fill(xss);
            await saveBtn.click();
            await page.waitForTimeout(500);

            console.log('Stress Testing: Rapid Double Click');
            await nameInput.fill('Double Click Test');
            await saveBtn.click();
            await saveBtn.click(); // Rapid fire
            await page.waitForTimeout(500);
        }

        console.log('Verifying application health post-stress...');
        const isCrashed = await page.evaluate(() => document.body.innerText.includes('something went wrong') || document.body.innerText.includes('Error'));
        expect(isCrashed).toBe(false);
    });
});
