import { test, expect } from '@playwright/test';
import { mockLogin, mockFarm } from './auth_mock_helper';

test('Harvest to Bin movement flow', async ({ page }) => {
    await mockLogin(page);
    await page.goto('/');

    // mockFarm has its own wait loop for powersync
    await mockFarm(page);

    // 1. Wait for the mocked field card actions to render
    await expect(page.getByTestId('field-card-harvest-field-1')).toBeVisible({ timeout: 10000 });

    // 2. Interact with the Harvest action directly
    const townButton = page.getByTestId('field-card-harvest-field-1');
    await expect(townButton.getByText('HARVEST')).toBeVisible({ timeout: 5000 });
    await townButton.click();

    // 4. Verify Log Session
    await expect(page.getByText('HARVEST Log')).toBeVisible();

    // 5. Submit a log
    await page.getByPlaceholder('Add notes...').fill('Verification Move');
    await page.getByText('SAVE', { exact: true }).first().click();

    // 6. Verify Success
    await expect(page.getByText('SAVED')).toBeVisible();
});

test('Harvest to Town movement flow', async ({ page }) => {
    await mockLogin(page);
    await page.goto('/');

    await mockFarm(page);

    // 1. Wait for the mocked field card actions to render
    await expect(page.getByTestId('field-card-harvest-to-town-field-1')).toBeVisible({ timeout: 10000 });

    // 2. Interact with the To Town action directly
    const townButton = page.getByTestId('field-card-harvest-to-town-field-1');
    await expect(townButton.getByText('TO TOWN')).toBeVisible({ timeout: 5000 });
    await townButton.click();

    // 3. Verify Log Session
    await expect(page.getByText('HARVEST TO TOWN Log')).toBeVisible();

    // 4. Submit a log
    await page.getByPlaceholder('Bushels').fill('15000');
    await page.getByPlaceholder('Moisture').fill('15.1');
    await page.getByPlaceholder('Add notes...').fill('Verification Town Move');
    await page.getByText('SAVE', { exact: true }).first().click();

    // 5. Verify Success
    await expect(page.getByText('SAVED')).toBeVisible();
});
