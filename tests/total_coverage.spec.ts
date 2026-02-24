import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';

async function closeBlockingOverlays(page: Page) {
    // Farm switcher modal can intercept pointer events during stress clicking.
    const switchFarmTitle = page.getByText('Switch Farm');
    if (await switchFarmTitle.isVisible().catch(() => false)) {
        const cancel = page.getByText('Cancel');
        if (await cancel.isVisible().catch(() => false)) {
            await cancel.click({ force: true }).catch(() => { });
        } else {
            await page.keyboard.press('Escape').catch(() => { });
        }
        await page.waitForTimeout(250);
    }
}

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
    });
}

test.describe('Total Coverage Stress Test', () => {
    let consoleErrors: string[] = [];

    test.beforeEach(async ({ page }) => {
        consoleErrors = [];
        page.on('console', msg => {
            if (msg.type() === 'error') {
                const text = msg.text();
                // Known benign noise during web E2E (asset loads / blocked external resources)
                if (text.includes('Failed to load resource') || text.includes('403')) return;
                consoleErrors.push(text);
            }
        });
        await mockLogin(page);
        await page.goto('/');

        let found = false;
        for (let i = 0; i < 40; i++) {
            found = await page.evaluate(() => (globalThis as any).powersync !== undefined);
            if (found) break;
            await page.waitForTimeout(500);
        }

        if (found) {
            await injectAppData(page);
            await page.waitForTimeout(1000);
        }
    });

    test('Recursive Interaction & Push-All-Buttons Protocol', async ({ page }) => {
        const tabs = ['MANAGE', 'DASHBOARD', 'MORE'];
        const siteMap: string[] = [];

        for (const tab of tabs) {
            const tabBtn = page.getByTestId(`tab-${tab}`);
            if (await tabBtn.isVisible()) {
                await closeBlockingOverlays(page);
                await tabBtn.click({ force: true });
                await page.waitForTimeout(1000);
                siteMap.push(`Tab: ${tab}`);

                const interactiveElements = await page.evaluate(() => {
                    const elements = Array.from(document.querySelectorAll('[data-testid], button, [role="button"], a'));
                    return elements.map(el => ({
                        text: el.textContent?.trim() || 'unnamed',
                        testId: el.getAttribute('data-testid'),
                        isClickable: true
                    }));
                });

                for (const el of interactiveElements.slice(0, 10)) {
                    if (el.testId?.startsWith('tab-')) continue;
                    if (el.testId === 'header-farm-name') continue; // Opens farm switcher modal
                    const locator = el.testId ? page.getByTestId(el.testId) : page.getByText(el.text).first();

                    if (await locator.isVisible()) {
                        try {
                            await closeBlockingOverlays(page);
                            await locator.click({ timeout: 2000, force: true });
                            await page.waitForTimeout(500);
                            siteMap.push(`  -> Interaction "${el.text}"`);
                        } catch (e) {
                            // Ignore interaction failures
                        }
                    }
                }
            }
        }
        await fs.promises.mkdir('test-results', { recursive: true });
        fs.writeFileSync('test-results/site_map.txt', siteMap.join('\n'));
    });

    test('Form Edge Case & Stress Testing', async ({ page }) => {
        // Navigate to Fields
        await page.getByTestId('tab-MANAGE').click();

        // Find the "Add Field" button text or icon
        const addFieldBtn = page.getByText(/Add Field/i).first();
        if (await addFieldBtn.isVisible()) {
            await addFieldBtn.click();

            const nameInput = page.getByPlaceholder('Field Name');
            const acreageInput = page.getByPlaceholder('Acreage');
            const saveBtn = page.getByText('Save').first();

            if (await nameInput.isVisible()) {
                await nameInput.fill('A'.repeat(500));
                await acreageInput.fill('123');
                await saveBtn.click();
                await page.waitForTimeout(500);
            }
        }
    });
});
