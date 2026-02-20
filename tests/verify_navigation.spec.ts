import { test, expect } from '@playwright/test';
import { mockLogin, mockFarm } from './auth_mock_helper';

test('verify navigation architecture', async ({ page }) => {
    // 1. Setup mock auth
    await mockLogin(page);

    // 2. Navigate to app
    await page.goto('/');

    // 3. Setup mock farm data
    await mockFarm(page);

    // 4. Wait for Tab Bar buttons (LOG is always visible)
    const logTab = page.getByTestId('tab-LOG');
    await expect(logTab).toBeVisible();
    await expect(page.getByTestId('tab-HISTORY')).toBeVisible();
    await expect(page.getByTestId('tab-DASHBOARD')).toBeVisible();

    // 5. Navigate to Settings (Responsive)
    const moreTab = page.getByTestId('tab-MORE');
    const settingsTab = page.getByTestId('tab-SETTINGS');

    // Wait for layout to settle
    await Promise.race([
        moreTab.waitFor({ state: 'visible', timeout: 10000 }).catch(() => { }),
        settingsTab.waitFor({ state: 'visible', timeout: 10000 }).catch(() => { })
    ]);

    if (await moreTab.isVisible()) {
        // MOBILE FLOW
        await moreTab.click({ force: true });
        await expect(page.getByTestId('more-manage-btn')).toBeVisible({ timeout: 10000 });
        await expect(page.getByTestId('more-settings-btn')).toBeVisible({ timeout: 10000 });
        await page.getByTestId('more-settings-btn').click({ force: true });
    } else {
        // DESKTOP FLOW
        await expect(settingsTab).toBeVisible({ timeout: 10000 });
        await settingsTab.click({ force: true });
    }

    // 6. Wait for Settings content
    await expect(page.getByText('Sign Out')).toBeVisible();

    // 7. Back to home
    if (await moreTab.isVisible()) {
        await page.getByTestId('more-back-btn').click();
        await expect(page.getByTestId('more-manage-btn')).toBeVisible();
        await page.getByTestId('tab-LOG').click();
    } else {
        await logTab.click();
    }

    // Verify we are back
    await expect(page.getByText('New Log Entry')).toBeVisible();
});
