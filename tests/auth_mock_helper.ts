import { Page } from '@playwright/test';

export async function mockLogin(page: Page) {
    const projectId = 'skkbmmxjclpbbijcrgyi'; // From original vault.spec.ts
    const mockSession = {
        access_token: 'mock-token',
        refresh_token: 'mock-refresh',
        expires_at: Math.floor(Date.now() / 1000) + 360000,
        user: {
            id: 'mock-user-id',
            email: 'test@example.com',
        },
    };

    await page.addInitScript((data) => {
        (window as any).E2E_TESTING = true;
        window.localStorage.setItem(`sb-${data.projectId}-auth-token`, JSON.stringify(data.session));
    }, { projectId, session: mockSession });
}

export async function mockFarm(page: Page) {
    await page.evaluate(async () => {
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
    });
}
