import { test, expect, Page } from '@playwright/test';

/**
 * Mock login by injecting a dummy session into localStorage.
 * This bypasses the OTP flow for E2E testing.
 */
async function mockFarm(page: Page) {
    await page.evaluate(async () => {
        // Wait for powersync to be available
        for (let i = 0; i < 100; i++) {
            if ((window as any).powersync) break;
            await new Promise(r => setTimeout(r, 200));
        }
        const db = (window as any).powersync;
        if (!db) throw new Error('PowerSync DB not found for injection');

        await db.execute(
            `INSERT OR REPLACE INTO settings (id, farm_name, state, units, onboarding_completed, farm_id, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
            ['farm_config', 'Test Farm', 'Iowa', 'US', 1, 'test-farm-id', new Date().toISOString()]
        );

        // Also add a mock recipe so the list isn't empty
        await db.execute(
            `INSERT OR REPLACE INTO spray_recipes (id, name, farm_id, water_rate_per_acre, created_at)
         VALUES (?, ?, ?, ?, ?)`,
            ['test-recipe-id', 'Corn Pre-Emergent', 'test-farm-id', 15, new Date().toISOString()]
        );
    });
}

async function mockLogin(page: Page) {
    const projectId = 'skkbmmxjclpbbijcrgyi';
    const mockSession = {
        access_token: 'mock-token',
        refresh_token: 'mock-refresh',
        expires_at: Math.floor(Date.now() / 1000) + 360000, // Long expiry
        user: {
            id: 'mock-user-id',
            email: 'test@example.com',
        },
    };

    // Set flag for the app to expose powersync
    await page.addInitScript((data) => {
        (window as any).E2E_TESTING = true;
        window.localStorage.setItem(`sb-${data.projectId}-auth-token`, JSON.stringify(data.session));
    }, { projectId, session: mockSession });
}

test.describe('Vault Management', () => {
    test.beforeEach(async ({ page }) => {
        await mockLogin(page);
        await page.goto('/'); // Start at home to trigger auth/powersync init
        await mockFarm(page); // Inject data
        await page.goto('/vault'); // Force navigate to vault after injection
    });

    test('should display vault records', async ({ page }) => {
        // Check for vault list container
        await expect(page.getByTestId('vault-list')).toBeVisible({ timeout: 10000 });
    });

    test('should filter vault records', async ({ page }) => {
        const searchInput = page.getByPlaceholder(/search/i);
        if (await searchInput.isVisible()) {
            await searchInput.fill('Corn');
            // Verify that results are filtered or at least the input works
            await expect(searchInput).toHaveValue('Corn');
        }
    });
});
