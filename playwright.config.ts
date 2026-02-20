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
        baseURL: 'http://localhost:8082',
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
        command: 'npx cross-env CI=1 npx expo start --web --port 8082',
        url: 'http://localhost:8082',
        reuseExistingServer: !process.env.CI,
        timeout: 120 * 1000,
    },
});
