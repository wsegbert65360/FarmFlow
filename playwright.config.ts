import { defineConfig, devices } from '@playwright/test';

// Ensure HOME environment variable is available on Windows CI/runners.
// Some tooling (Playwright / Firefox) expects a valid HOME directory and
// can fail when it's not set. Map HOME -> USERPROFILE when necessary to
// keep visual tools stable on Windows machines.
if (process.platform === 'win32' && !process.env.HOME && process.env.USERPROFILE) {
  process.env.HOME = process.env.USERPROFILE;
}

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
