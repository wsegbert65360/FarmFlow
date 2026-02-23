import { test, expect } from '@playwright/test';
import { mockLogin, mockFarm } from './auth_mock_helper';

test('verify navigation architecture', async ({ page }) => {
    // 1. Setup mock auth
    await mockLogin(page);

    // 2. Navigate to app
    await page.goto('/');

    // 3. Setup mock farm data
    await mockFarm(page);

    // 4. Wait for Tab Bar buttons
    const manageTab = page.getByTestId('tab-MANAGE');
    const dashboardTab = page.getByTestId('tab-DASHBOARD');
    const moreTab = page.getByTestId('tab-MORE');

    await expect(manageTab).toBeVisible();
    await expect(dashboardTab).toBeVisible();
    await expect(moreTab).toBeVisible();

    // 5. Verify Fields (Manage) content
    await manageTab.click();
    await expect(page.getByTestId('weather-widget')).toBeVisible();
    await expect(page.getByText(/Good to/i)).toBeVisible();

    // 6. Navigate to Grain (Dashboard)
    await dashboardTab.click();
    // Assuming dashboard has some text we can verify
    // await expect(page.getByText('Grain Inventory')).toBeVisible(); 

    // 7. Navigate to More
    await moreTab.click();
    // Look for more-specific buttons inside the More tab
    await expect(page.getByTestId('more-title')).toBeVisible();
    await expect(page.getByTestId('more-manage-btn')).toBeVisible();
    await expect(page.getByTestId('more-settings-btn')).toBeVisible();
});
