import { test, expect } from '@playwright/test';
import { mockLogin, mockFarm } from './auth_mock_helper';

test('Harvest to Town movement flow', async ({ page }) => {
    await mockLogin(page);
    await page.goto('/');

    // mockFarm has its own wait loop for powersync
    await mockFarm(page);

    // 1. Verify Field-First Navigation
    await expect(page.getByText('Your Fields')).toBeVisible();

    // 2. Open Field Actions
    const fieldCard = page.getByTestId(/field-item-/).first();
    await fieldCard.click();

    // 3. Verify Pretty Buttons & Harvest to Town action
    const townButton = page.getByTestId('action-harvest-to-town');
    await expect(townButton).toBeVisible();
    await expect(townButton.getByText('Harvest to Town')).toBeVisible();
    await townButton.click();

    // 4. Verify Log Session
    await expect(page.getByText('HARVEST TO TOWN Log')).toBeVisible();

    // 5. Submit a log
    await page.getByPlaceholder('Add notes...').fill('Verification Move');
    await page.getByText('SAVE', { exact: true }).first().click();

    // 6. Verify Success
    await expect(page.getByText('SAVED')).toBeVisible();
});
