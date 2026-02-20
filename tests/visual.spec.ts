import { test, expect, Page } from '@playwright/test';

async function mockLogin(page: Page) {
    const projectId = 'skkbmmxjclpbbijcrgyi';
    const mockSession = {
        access_token: 'mock-token',
        refresh_token: 'mock-refresh',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        user: { id: 'mock-user-id', email: 'test@example.com' },
    };

    await page.addInitScript((data) => {
        window.localStorage.setItem(`sb-${data.projectId}-auth-token`, JSON.stringify(data.session));
    }, { projectId, session: mockSession });
}

test.describe('Visual Regression', () => {
    test.beforeEach(async ({ page }) => {
        await mockLogin(page);
    });

    test('Dashboard responsive design', async ({ page }) => {
        await page.goto('/');
        // Capture snapshot for comparison
        await expect(page).toHaveScreenshot('dashboard.png');
    });

    test('Vault list responsiveness', async ({ page }) => {
        await page.goto('/vault');
        await expect(page).toHaveScreenshot('vault-list.png');
    });
});
