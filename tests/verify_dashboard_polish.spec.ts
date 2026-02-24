import { test, expect } from '@playwright/test';
import { mockLogin, mockFarm } from './auth_mock_helper';

test('verify dashboard polish', async ({ page }) => {
    // 1. Setup mock auth
    await mockLogin(page);

    // 2. Navigate to app
    await page.goto('/');

    // 3. Setup mock farm data
    await mockFarm(page);

    // 2. Go to Dashboard Tab
    await page.getByTestId('tab-DASHBOARD').click();
    await expect(page.getByText('Grain Storage').first()).toBeVisible();

    // 3. Screenshot Dashboard Top (Bins)
    await page.screenshot({ path: 'test-results/dashboard_polish_bins.png' });

    // 4. Return to Fields (Manage) and verify a Field Card is present
    await page.getByTestId('tab-MANAGE').click();
    await expect(page.getByText('North 40')).toBeVisible();

    // 5. Screenshot Field List
    await page.screenshot({ path: 'test-results/dashboard_polish_fields.png' });
});
