import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for FarmFlow Expo Web
 */
export default defineConfig({
    testDir: './tests',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: 'html',
    use: {
        baseURL: 'http://localhost:8084',
        trace: 'on-first-retry',
    },

    projects: [
        {
            name: 'Mobile Safari',
            use: { ...devices['iPhone 12'] },
        },
        {
            name: 'Tablet Safari',
            use: { ...devices['iPad (gen 7)'] },
        },
        {
            name: 'Desktop Chrome',
            use: { ...devices['Desktop Chrome'] },
        },
    ],

    /* Run local dev server before starting tests */
    webServer: {
        command: 'npx serve dist -l 8084',
        url: 'http://localhost:8084',
        reuseExistingServer: true,
        timeout: 120 * 1000,
    },
});
