import { test, expect } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || '/';

test.describe('Developer Login Procedure', () => {
    test('should log in and complete onboarding', async ({ page }) => {
        test.setTimeout(60000);
        try {
            // 1. Navigate to the app
            await page.goto(BASE_URL);

            // 2. Wait for the login screen
            const loginBtn = page.getByText('Developer Quick-Login (No Password)');
            await expect(loginBtn).toBeVisible({ timeout: 15000 });

            // 3. Click the button
            console.log('[Test] Clicking Developer Quick-Login button...');
            await loginBtn.click();

            // 4. Verify login button disappears
            await expect(loginBtn).not.toBeVisible({ timeout: 10000 });
            console.log('[Test] Login successful, redirecting...');

            // 5. Detect Onboarding or Dashboard
            // New users land on "Welcome to FarmFlow"
            const welcomeText = page.getByText(/Welcome to FarmFlow/i);
            const isWelcome = await welcomeText.isVisible({ timeout: 15000 }).catch(() => false);

            if (isWelcome) {
                console.log('[Test] Landing on Onboarding. Completing setup...');
                // Fill out onboarding
                await page.getByPlaceholder(/e\.g\. Miller Family Farms/i).fill('Test Dev Farm');
                await page.getByPlaceholder(/e\.g\. Iowa/i).fill('Dev State');
                await page.getByText('Start Farming').click();
                console.log('[Test] Clicked Start Farming.');
            }

            // 6. Final verification: supabase auth token persisted
            const storageKey = 'sb-skkbmmxjclpbbijcrgyi-auth-token';
            await page.waitForFunction((key) => !!window.localStorage.getItem(key), storageKey, { timeout: 30000 });
            console.log('[Test] Dashboard reached successfully!');

        } catch (e) {
            console.error('[Test] Test failed. Capturing screenshot...');
            if (!page.isClosed()) {
                await page.screenshot({ path: 'login-onboarding-failure.png', fullPage: true });
            }
            throw e;
        }
    });

    test('should handle session clearing and retry', async ({ page }) => {
        test.setTimeout(60000);
        try {
            await page.goto(BASE_URL);

            const resetButton = page.getByText('Reset App (Clear Local State)');
            if (await resetButton.isVisible()) {
                await resetButton.click();
                await page.waitForTimeout(3000);
            }

            await page.getByText('Developer Quick-Login (No Password)').click();

            // Just check for Welcome or Fields
            await expect(page.locator('body')).toContainText(/Welcome|Fields/i, { timeout: 30000 });
            console.log('[Test] Retry successful.');
        } catch (e) {
            await page.screenshot({ path: 'retry-failure.png', fullPage: true });
            throw e;
        }
    });
});
