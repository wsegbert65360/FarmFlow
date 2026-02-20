import { test, expect, Page } from '@playwright/test';
import { mockLogin, mockFarm } from './auth_mock_helper';

test.describe('Visual Regression', () => {
    test.beforeEach(async ({ page }) => {
        await mockLogin(page);
    });

    test('Dashboard responsive design', async ({ page }) => {
        await page.goto('/');
        await mockFarm(page);
        // Capture snapshot for comparison
        await expect(page).toHaveScreenshot('dashboard.png');
    });

    test('Vault list responsiveness', async ({ page }) => {
        await page.goto('/');
        await mockFarm(page);

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
        await page.getByTestId('manage-vault-btn').click({ force: true });
        await expect(page.getByTestId('vault-list')).toBeVisible();
        await page.waitForTimeout(1000); // Allow Safari to render/animate

        await expect(page).toHaveScreenshot('vault-list.png');
    });
});
