import { test, expect } from '@playwright/test';

test('verify dashboard polish', async ({ page }) => {
    // 1. Navigate to app
    await page.goto('http://localhost:8081');

    // 2. Go to Dashboard Tab
    await page.getByTestId('tab-DASHBOARD').click();
    await expect(page.getByText('Capacity').first()).toBeVisible();

    // 3. Screenshot Dashboard Top (Bins)
    await page.screenshot({ path: 'test-results/dashboard_polish_bins.png' });

    // 4. Go to Manage -> Fields to see Field List
    const manageTab = page.getByTestId('tab-MANAGE');
    if (await manageTab.isVisible()) {
        await manageTab.click();
    } else {
        await page.getByTestId('tab-MORE').click();
        await page.getByText('Manage Farm').click();
    }
    await page.getByText('Fields').click();

    await expect(page.getByText('Your Fields')).toBeVisible();

    // 5. Screenshot Field List
    await page.screenshot({ path: 'test-results/dashboard_polish_fields.png' });
});
