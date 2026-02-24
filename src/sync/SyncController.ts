import { db } from '../db/powersync';
import { connector } from '../db/SupabaseConnector';
import { NetInfoState, addEventListener } from '@react-native-community/netinfo';

export type SyncMode = 'LOCAL_ONLY' | 'OFFLINE' | 'SYNCING' | 'SYNCED' | 'ERROR';

export interface SyncState {
    mode: SyncMode;
    pendingWrites: number;
    pendingUploads: number;
    lastSyncedAt: Date | null;
    lastError: string | null;
    isConnected: boolean;
    isHydrated: boolean;
}

class SyncController {
    private state: SyncState = {
        mode: 'LOCAL_ONLY',
        pendingWrites: 0,
        pendingUploads: 0,
        lastSyncedAt: null,
        lastError: null,
        isConnected: false,
        isHydrated: false,
    };
    private listeners: ((state: SyncState) => void)[] = [];
    private networkUnsubscribe: (() => void) | null = null;
    private errorLog: string[] = [];
    private dbUnsubscribe: (() => void) | null = null;
    private initialized = false;
    private syncingPromise: Promise<void> | null = null;
    private userId: string | null = null;

    constructor() {
        // Initial network check
        this.networkUnsubscribe = addEventListener(this.handleNetworkChange);
    }

    init(userId: string) {
        if (this.initialized && this.userId === userId) return;
        this.initialized = true;
        this.userId = userId;

        console.log(`[SyncController] Initializing for user: ${userId}`);
        // Listen to PowerSync status
        if (this.dbUnsubscribe) this.dbUnsubscribe();
        this.dbUnsubscribe = db.registerListener({
            statusChanged: (status: any) => {
                console.log('[SyncController] DB Status Change:', status.connected ? 'Connected' : 'Disconnected', status.lastSyncedAt ? `Last Sync: ${status.lastSyncedAt}` : '');
                this.updateState({
                    lastSyncedAt: status.lastSyncedAt || this.state.lastSyncedAt,
                    lastError: status.uploadError?.message || status.downloadError?.message || null,
                    pendingUploads: status.uploading ? 1 : 0,
                    isConnected: status.connected,
                });
                this.deriveMode();
            }
        });

        // Initial sync trigger
        this.sync().catch(e => console.error('[SyncController] Initial sync failed:', e));
    }

    private handleNetworkChange = (state: NetInfoState) => {
        this.updateState({ isConnected: !!state.isConnected });
        this.deriveMode();
    };

    private deriveMode() {
        let newMode: SyncMode = 'LOCAL_ONLY';

        if (!this.state.isConnected) {
            newMode = 'OFFLINE';
        } else if (this.state.pendingUploads > 0 || this.state.lastError) {
            newMode = this.state.lastError ? 'ERROR' : 'SYNCING';
        } else if (this.state.lastSyncedAt) {
            newMode = 'SYNCED';
        }

        // Check pending writes (approximate via pendingUploads for now, or db.getValidStatus() if available)
        // For accurate pending writes, we'd need to query the upload queue table, which is advanced.
        // We'll trust the status 'uploading' flag for SYNCING state.

        if (this.state.mode !== newMode) {
            this.updateState({ mode: newMode });
        }
    }

    private updateState(updates: Partial<SyncState>) {
        if (updates.lastError) {
            const timestamp = new Date().toISOString();
            this.errorLog.unshift(`[${timestamp}] ${updates.lastError} `);
            if (this.errorLog.length > 50) this.errorLog.pop();
        }
        this.state = { ...this.state, ...updates };
        this.notifyThrottled();
    }

    private throttleTimer: NodeJS.Timeout | null = null;
    private notifyThrottled() {
        if (this.throttleTimer) return;
        this.throttleTimer = setTimeout(() => {
            this.notify();
            this.throttleTimer = null;
        }, 500); // Throttle UI updates to 2x per second during high activity
    }

    subscribe(listener: (state: SyncState) => void) {
        this.listeners.push(listener);
        listener(this.state);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    private notify() {
        this.listeners.forEach(l => l(this.state));
    }

    async sync() {
        const isE2E = typeof globalThis !== 'undefined' && !!(globalThis as any).E2E_TESTING;
        if (isE2E) {
            // Playwright/E2E runs use the in-browser PowerSync DB seeded by test helpers.
            // Avoid connecting to Supabase / remote sync to prevent console noise and flaky network coupling.
            this.updateState({ mode: 'LOCAL_ONLY', isHydrated: true, lastError: null });
            return;
        }

        if (!this.state.isConnected) {
            console.log('[SyncController] Skipping sync: Offline');
            return;
        }
        if (this.syncingPromise) {
            console.log('[SyncController] Sync already in progress, waiting...');
            return this.syncingPromise;
        }

        this.syncingPromise = (async () => {
            try {
                console.log('[SyncController] Starting sync process...');
                await db.connect(connector);

                // On web, we force a manual hydration sweep
                if (typeof window !== 'undefined' && (db as any).hydrate) {
                    console.log('[SyncController] Awaiting manual hydration sweep...');
                    try {
                        await (db as any).hydrate();
                        console.log('[SyncController] Manual hydration sweep complete.');
                        this.updateState({ isHydrated: true });
                    } catch (hydrateError: any) {
                        console.error('[SyncController] Hydration sweep error:', hydrateError);
                        // Still mark as hydrated so UI can show whatever it has
                        this.updateState({ lastError: `Hydration: ${hydrateError.message}`, isHydrated: true });
                    }
                } else {
                    this.updateState({ isHydrated: true });
                }
            } catch (e: any) {
                console.error('[SyncController] Sync process failed:', e);
                this.updateState({ lastError: e.message, isHydrated: true });
            }
        })();

        try {
            await this.syncingPromise;
        } finally {
            this.syncingPromise = null;
        }
    }

    reset() {
        console.log('[SyncController] Resetting SyncController state and PowerSync connection.');
        if (this.dbUnsubscribe) this.dbUnsubscribe();
        db.disconnect();
        this.initialized = false;
        this.updateState({
            mode: 'LOCAL_ONLY',
            pendingWrites: 0,
            pendingUploads: 0,
            lastSyncedAt: null,
            lastError: null,
            isHydrated: false
        });
        this.errorLog = [];
    }

    getState() {
        return this.state;
    }

    getErrorLog() {
        return [...this.errorLog];
    }
}

export const syncController = new SyncController();
