import {
    AbstractPowerSyncDatabase,
    AbstractStreamingSyncImplementation,
    BucketStorageAdapter,
    DBAdapter,
    PowerSyncBackendConnector,
    PowerSyncDatabaseOptionsWithSettings,
    type RequiredAdditionalConnectionOptions,
    SqliteBucketStorage
} from '@powersync/common';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import { SQLJSOpenFactory } from '@powersync/adapter-sql-js';
import Dexie, { type Table as DexieTable } from 'dexie';
import { connector } from './SupabaseConnector';
import { AppSchema } from './schema';
export { AppSchema };

let ReactNativeRemote: any;
let ReactNativeStreamingSyncImplementation: any;
let PowerSyncNative: any;

if (Platform.OS !== 'web') {
    try {
        const native = require('@powersync/react-native');
        ReactNativeRemote = native.ReactNativeRemote;
        ReactNativeStreamingSyncImplementation = native.ReactNativeStreamingSyncImplementation;
        PowerSyncNative = native.PowerSyncDatabase;
    } catch (e) {
        console.warn('Native PowerSync modules not found');
    }
}

const isWeb = Platform.OS === 'web';
const isExpoGo = Constants.appOwnership === 'expo';

// --- Global Helpers for Persistence ---

/**
 * Consolidated binary conversion helpers to resolve duplicated logic
 */
const ConversionUtils = {
    uint8ArrayToBase64: (data: Uint8Array): string => {
        let binary = '';
        const bytes = new Uint8Array(data);
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    },
    base64ToUint8Array: (base64: string): Uint8Array => {
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes;
    }
};

/**
 * Professional IndexedDB persistence for the Web backend.
 * Extends storage capacity far beyond localStorage limits.
 */
class FarmFlowDatabase extends Dexie {
    db_storage!: DexieTable<{ id: string; data: string }, string>;

    constructor() {
        super('FarmFlowStore');
        this.version(1).stores({
            db_storage: 'id'
        });
    }
}

const indexedDB = new FarmFlowDatabase();

const WebIndexedDBPersister = {
    async readFile() {
        if (!isWeb) return null;
        try {
            const entry = await indexedDB.db_storage.get('main_db');
            if (!entry) return null;
            return ConversionUtils.base64ToUint8Array(entry.data);
        } catch (e) {
            console.warn('[PowerSync] Failed to load persisted DB from IndexedDB', e);
            // Fallback to localStorage for legacy migration if needed
            const legacy = localStorage.getItem('farmflow_db');
            if (legacy) {
                console.log('[PowerSync] Migrating from localStorage to IndexedDB...');
                return ConversionUtils.base64ToUint8Array(legacy);
            }
            return null;
        }
    },
    async writeFile(data: any) {
        if (!isWeb) return;
        try {
            const base64 = ConversionUtils.uint8ArrayToBase64(data);
            await indexedDB.db_storage.put({ id: 'main_db', data: base64 });
            // Clean up legacy storage once written to IndexedDB
            localStorage.removeItem('farmflow_db');
        } catch (e) {
            console.error('[PowerSync] Failed to save DB to IndexedDB', e);
        }
    }
};

/**
 * Mobile-only persistence for SQL.js using expo-file-system.
 * Used when running in Expo Go without native modules.
 */
const MobileFilePersister = {
    async readFile() {
        if (isWeb) return null;
        try {
            const uri = `${FileSystem.documentDirectory}farmflow.db`;
            const info = await FileSystem.getInfoAsync(uri);
            if (!info.exists) return null;

            const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
            return ConversionUtils.base64ToUint8Array(base64);
        } catch (e) {
            console.warn('[PowerSync] Failed to load persisted DB from mobile storage', e);
            return null;
        }
    },
    async writeFile(data: Uint8Array) {
        if (isWeb) return;
        try {
            const uri = `${FileSystem.documentDirectory}farmflow.db`;
            const base64 = ConversionUtils.uint8ArrayToBase64(data);
            await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });
            console.log('[PowerSync] Database persisted to mobile storage');
        } catch (e) {
            console.error('[PowerSync] Failed to save DB to mobile storage', e);
        }
    }
};

/**
 * Expo Go compatible implementation that avoids native modules and web workers.
 */
class ExpoPowerSyncDatabase extends AbstractPowerSyncDatabase {
    async _initialize(): Promise<void> {
        try {
            // Optimized indices for Phase 3 query patterns
            await this.execute('CREATE INDEX IF NOT EXISTS idx_spray_logs_field_time ON spray_logs(field_id, start_time)');
            await this.execute('CREATE INDEX IF NOT EXISTS idx_farms_owner ON farms(owner_id)');
            await this.execute('CREATE INDEX IF NOT EXISTS idx_invites_token ON invites(token)');
            await this.execute('CREATE INDEX IF NOT EXISTS idx_farm_members_user ON farm_members(user_id)');
            await this.execute('CREATE INDEX IF NOT EXISTS idx_grain_logs_bin_time ON grain_logs(bin_id, start_time)');
            await this.execute('CREATE INDEX IF NOT EXISTS idx_planting_logs_field_time ON planting_logs(field_id, planted_at)');
            await this.execute('CREATE INDEX IF NOT EXISTS idx_attachments_owner ON attachments(owner_record_id)');
            await this.execute('CREATE INDEX IF NOT EXISTS idx_rent_agreements_landlord ON rent_agreements(landlord_id, crop_year)');
            await this.execute('CREATE INDEX IF NOT EXISTS idx_agreement_fields_field ON agreement_fields(field_id)');
            console.log('[PowerSync] Indices initialized.');
        } catch (e) {
            console.warn('[PowerSync] Index initialization skipped or failed (might be first run):', e);
        }
    }

    protected openDBAdapter(options: PowerSyncDatabaseOptionsWithSettings): DBAdapter {
        console.log('[PowerSync] Opening SQL.js DB Adapter');
        const factory = new SQLJSOpenFactory({
            ...options.database,
            locateFile: (file: string) => {
                if (file.endsWith('.wasm')) {
                    // On web, we serve this at the root
                    return '/sql-wasm.wasm';
                }
                return file;
            },
            persister: isWeb ? WebIndexedDBPersister : MobileFilePersister
        } as any);
        return factory.openDB();
    }

    protected generateBucketStorageAdapter(): BucketStorageAdapter {
        return new SqliteBucketStorage(this.database, this.logger);
    }

    protected generateSyncStreamImplementation(
        connector: PowerSyncBackendConnector,
        options: RequiredAdditionalConnectionOptions
    ): AbstractStreamingSyncImplementation {
        if (isWeb || !ReactNativeRemote || !ReactNativeStreamingSyncImplementation) {
            console.log('[PowerSync] Using web-compatible mock sync implementation');
            return {
                connect: async () => {
                    console.log('[PowerSync Mock] Connect called');
                    // In a real web implementation, we would start an upload loop here.
                },
                disconnect: async () => { },
                dispose: async () => { },
                isConnected: () => false, // Default to false on web until real auth/sync is added
                waitForReady: async () => { },
                uploadCrud: async () => {
                    console.log('[PowerSync Mock] Propagating changes to Supabase...');
                    await connector.uploadData(this);
                }
            } as any;
        }

        const remote = new ReactNativeRemote(connector, this.logger);

        return new ReactNativeStreamingSyncImplementation({
            ...options,
            adapter: this.bucketStorageAdapter,
            remote,
            uploadCrud: async () => {
                await this.waitForReady();
                await connector.uploadData(this);
            },
            identifier: this.database.name,
            logger: this.logger
        });
    }
}

let dbInstance: AbstractPowerSyncDatabase;

if (isWeb || isExpoGo) {
    dbInstance = new ExpoPowerSyncDatabase({
        schema: AppSchema,
        database: {
            dbFilename: 'farmflow.db',
        },
    });

    // On Web, SQL.js data is in-memory by default. 
    // We can add a simple persistence hook here if needed, 
    // but for now, we'll focus on getting it to render.
} else {
    // Native implementation
    dbInstance = new PowerSyncNative({
        schema: AppSchema,
        database: {
            dbFilename: 'farmflow.db',
        },
    });
}

// Expose for E2E testing
if (typeof globalThis !== 'undefined') {
    (globalThis as any).powersync = dbInstance;
}

export const db = dbInstance;

// Start synchronization
db.connect(connector).catch((e: any) => console.error('PowerSync connect error:', e));
