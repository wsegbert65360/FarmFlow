import { test, expect } from '@playwright/test';
import { mockLogin, mockFarm } from './auth_mock_helper';

test.describe('Visual Regression', () => {
    test.beforeEach(async ({ page }) => {
        await mockLogin(page);
    });

    test('Dashboard responsive design', async ({ page }) => {
        await page.goto('/');
        await mockFarm(page);

        // Weather widget should be visible on all platforms
        await expect(page.getByTestId('weather-widget')).toBeVisible();

        // Responsive element checks
        const viewport = page.viewportSize();
        const isDesktop = viewport && viewport.width > 768;

        if (!isDesktop) {
            // Mobile specific
            await expect(page.getByTestId('floating-action-button')).toBeVisible();
            await expect(page.getByTestId('tab-MANAGE')).toBeVisible();
        } else {
            // Desktop specific
            await expect(page.getByTestId('tab-MANAGE')).toBeVisible();
            // Sidebar is usually always visible or handled by ResponsiveLayout
        }

        await expect(page).toHaveScreenshot('dashboard.png');
    });

    test('More menu responsiveness', async ({ page }) => {
        await page.goto('/');
        await mockFarm(page);

        const moreTab = page.getByTestId('tab-MORE');
        await expect(moreTab).toBeVisible();
        await moreTab.click();

        await expect(page.getByTestId('more-title')).toBeVisible();
        await expect(page.getByTestId('more-manage-btn')).toBeVisible();

        await expect(page).toHaveScreenshot('more-menu.png');
    });
});
