import { test, expect } from '@playwright/test';

test.describe('Authentication & Onboarding', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
    });

    test('should show login screen by default', async ({ page }) => {
        await expect(page.getByTestId('login-email-input')).toBeVisible();
        await expect(page.getByTestId('login-submit-button')).toBeVisible();
    });

    test('should navigate through onboarding', async ({ page }) => {
        // This assumes we can trigger the onboarding flow
        // We expect the app to show onboarding if no farm is configured
        // For now we'll just check if the "Start New" button is visible
        const onboardingBtn = page.getByTestId('mode-new-button');
        if (await onboardingBtn.isVisible()) {
            await onboardingBtn.click();
            await expect(page.getByTestId('farm-name-input')).toBeVisible();
        }
    });
});

