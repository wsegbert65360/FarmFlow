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
}

class SyncController {
    private state: SyncState = {
        mode: 'LOCAL_ONLY',
        pendingWrites: 0,
        pendingUploads: 0,
        lastSyncedAt: null,
        lastError: null,
        isConnected: false,
    };
    private listeners: ((state: SyncState) => void)[] = [];
    private errorLog: string[] = [];
    private networkUnsubscribe: (() => void) | null = null;
    private dbUnsubscribe: (() => void) | null = null;
    private initialized = false;

    constructor() {
        // Initial network check
        this.networkUnsubscribe = addEventListener(this.handleNetworkChange);
    }

    init(userId: string) {
        if (this.initialized) return;
        this.initialized = true;

        // Listen to PowerSync status
        this.dbUnsubscribe = db.registerListener({
            statusChanged: (status: any) => {
                this.updateState({
                    lastSyncedAt: status.lastSyncedAt || this.state.lastSyncedAt,
                    lastError: status.uploadError?.message || status.downloadError?.message || null,
                    pendingUploads: status.uploading ? 1 : 0, // Simplified, PowerSync doesn't expose exact count easily in status
                    isConnected: status.connected,
                });
                this.deriveMode();
            }
        });

        // Initial sync trigger
        this.sync();
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
            this.errorLog.unshift(`[${timestamp}] ${updates.lastError}`);
            if (this.errorLog.length > 50) this.errorLog.pop();
        }
        this.state = { ...this.state, ...updates };
        this.notify();
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
        if (!this.state.isConnected) return;
        try {
            await db.connect(connector);
        } catch (e: any) {
            this.updateState({ lastError: e.message });
        }
    }

    reset() {
        if (this.dbUnsubscribe) this.dbUnsubscribe();
        db.disconnect();
        this.initialized = false;
        this.updateState({
            mode: 'LOCAL_ONLY',
            pendingWrites: 0,
            pendingUploads: 0,
            lastSyncedAt: null,
            lastError: null
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
