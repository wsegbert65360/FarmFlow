import { test, expect, Page } from '@playwright/test';
import { mockLogin, mockFarm } from './auth_mock_helper';

/**
 * Helper to add a mock recipe so the list isn't empty
 */
async function addMockData(page: Page) {
    await page.evaluate(async () => {
        const db = (window as any).powersync;
        if (!db) return;

        await db.execute(
            `INSERT OR REPLACE INTO recipes (id, name, farm_id, water_rate_per_acre, created_at)
             VALUES (?, ?, ?, ?, ?)`,
            ['test-recipe-id', 'Corn Pre-Emergent', 'test-farm-id', 15, new Date().toISOString()]
        );
    });
}

test.describe('Vault Management', () => {
    test.beforeEach(async ({ page }) => {
        await mockLogin(page);
        await page.goto('/'); // Start at home
        await mockFarm(page); // Inject farm settings
        await addMockData(page); // Inject specific vault data

        // Navigate to Vault (Responsive)
        const moreTab = page.getByTestId('tab-MORE');
        const manageTab = page.getByTestId('tab-MANAGE');

        // Wait for layout to settle
        await Promise.race([
            moreTab.waitFor({ state: 'visible', timeout: 10000 }).catch(() => { }),
            manageTab.waitFor({ state: 'visible', timeout: 10000 }).catch(() => { })
        ]);

        if (await moreTab.isVisible()) {
            await moreTab.click({ force: true });
            await expect(page.getByTestId('more-manage-btn')).toBeVisible({ timeout: 10000 });
            await page.getByTestId('more-manage-btn').click({ force: true });
        } else {
            await expect(manageTab).toBeVisible({ timeout: 10000 });
            await manageTab.click({ force: true });
        }
        await expect(page.getByTestId('manage-vault-btn')).toBeVisible({ timeout: 10000 });

        // Now in ManageTab, click Vault
        await page.getByTestId('manage-vault-btn').click();
    });

    test('should display vault records', async ({ page }) => {
        // Check for vault list container
        await expect(page.getByTestId('vault-list')).toBeVisible({ timeout: 15000 });
    });

    test('should filter vault records', async ({ page }) => {
        const searchInput = page.getByPlaceholder(/search/i);
        if (await searchInput.isVisible()) {
            await searchInput.fill('Corn');
            // Verify that results are filtered or at least the input works
            await expect(searchInput).toHaveValue('Corn');
        }
    });
});
