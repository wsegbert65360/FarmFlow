import { test, expect } from '@playwright/test';

test('verify navigation architecture', async ({ page }) => {
    // 1. Navigate to app
    await page.goto('http://localhost:8081');

    // 2. Wait for Log tab (default) or Dashboard
    await expect(page.getByText('Log')).toBeVisible();
    await expect(page.getByText('History')).toBeVisible();
    await expect(page.getByText('Dash')).toBeVisible();
    await expect(page.getByText('More')).toBeVisible();

    // 3. Screenshot Dashboard/Tabs
    await page.screenshot({ path: 'test-results/navigation_tabs.png' });

    // 4. Navigate to More
    await page.getByText('More').click();
    await expect(page.getByText('Manage Farm')).toBeVisible();
    await expect(page.getByText('Settings')).toBeVisible();

    // 5. Screenshot More Menu
    await page.screenshot({ path: 'test-results/navigation_more_menu.png' });

    // 6. Navigate to Settings
    await page.getByText('Settings').first().click(); // .first() in case of ambiguity

    // 7. Wait for Settings content (Theme preference is usually there)
    await expect(page.getByText('Theme')).toBeVisible();

    // 8. Screenshot Settings
    await page.screenshot({ path: 'test-results/navigation_settings.png' });

    // 9. Back to More
    await page.getByText('‹ More').click();
    await expect(page.getByText('Manage Farm')).toBeVisible();
});
