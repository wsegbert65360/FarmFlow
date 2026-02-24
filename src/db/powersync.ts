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

class FarmFlowDatabase extends Dexie {
    db_storage!: DexieTable<{ id: string; data: Uint8Array | string }, string>;

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

            // Handle both binary and legacy base64
            if (entry.data instanceof Uint8Array) {
                return entry.data;
            }

            if (typeof entry.data === 'string') {
                console.log('[PowerSync] Migrating legacy base64 record to binary...');
                return ConversionUtils.base64ToUint8Array(entry.data);
            }

            return null;
        } catch (e) {
            console.warn('[PowerSync] Failed to load persisted DB from IndexedDB', e);
            const legacy = localStorage.getItem('farmflow_db');
            if (legacy) {
                console.log('[PowerSync] Migrating from localStorage to IndexedDB...');
                return ConversionUtils.base64ToUint8Array(legacy);
            }
            return null;
        }
    },
    async writeFile(data: Uint8Array) {
        if (!isWeb) return;
        try {
            // CRITICAL: Put the raw Uint8Array. IndexedDB handles this efficiently.
            await indexedDB.db_storage.put({ id: 'main_db', data });
            localStorage.removeItem('farmflow_db');
        } catch (e) {
            console.error('[PowerSync] Failed to save DB to IndexedDB', e);
        }
    }
};

const MobileFilePersister = {
    async readFile() {
        if (isWeb) return null;
        try {
            const uri = `${FileSystem.documentDirectory}farmflow.db`;
            const info = await FileSystem.getInfoAsync(uri);
            if (!info.exists) return null;

            // On mobile, Base64 is often safer for large file bridging in Expo
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

class ExpoPowerSyncDatabase extends AbstractPowerSyncDatabase {
    private indexRetryCount = 0;
    private indexRetryTimer: ReturnType<typeof setTimeout> | null = null;

    async _initialize(): Promise<void> {
        const db = this.database;

        const extractRows = (result: any): any[] => {
            const rowsArray = result?.rows?._array;
            if (Array.isArray(rowsArray)) return rowsArray;

            const rowsObj = result?.rows;
            if (rowsObj && typeof rowsObj.item === 'function' && typeof rowsObj.length === 'number') {
                return Array.from({ length: rowsObj.length }, (_, i) => rowsObj.item(i));
            }

            if (Array.isArray(rowsObj)) return rowsObj;
            return [];
        };

        const tableExists = async (table: string) => {
            const res = await db.execute(
                `SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`,
                [table]
            );
            return extractRows(res).length > 0;
        };

        const tryCreateIndex = async (table: string, sql: string) => {
            if (!(await tableExists(table))) return false;
            try {
                await db.execute(sql);
                return true;
            } catch (e: any) {
                const msg = String(e?.message || e);
                // Most common cause: schema not created yet on initial boot (web), or drifted columns.
                if (msg.includes('no such table') || msg.includes('no such column')) return false;

                console.warn('[PowerSync] Index initialization skipped or failed:', e);
                return true; // don't retry on unknown errors
            }
        };

        const indices: Array<{ table: string; sql: string }> = [
            { table: 'spray_logs', sql: 'CREATE INDEX IF NOT EXISTS idx_spray_logs_field_time ON spray_logs(field_id, sprayed_at)' },
            { table: 'farms', sql: 'CREATE INDEX IF NOT EXISTS idx_farms_owner ON farms(owner_id)' },
            { table: 'farm_members', sql: 'CREATE INDEX IF NOT EXISTS idx_farm_members_user ON farm_members(user_id)' },
            // NOTE: grain_logs does not have occurred_at; end_time is the chronological column.
            { table: 'grain_logs', sql: 'CREATE INDEX IF NOT EXISTS idx_grain_logs_bin_end_time ON grain_logs(bin_id, end_time)' },
            { table: 'planting_logs', sql: 'CREATE INDEX IF NOT EXISTS idx_planting_logs_field_time ON planting_logs(field_id, planted_at)' },
            { table: 'attachments', sql: 'CREATE INDEX IF NOT EXISTS idx_attachments_owner ON attachments(owner_record_id)' },
            { table: 'invites', sql: 'CREATE INDEX IF NOT EXISTS idx_invites_token ON invites(token)' },
            { table: 'rent_agreements', sql: 'CREATE INDEX IF NOT EXISTS idx_rent_agreements_landlord ON rent_agreements(landlord_id, crop_year)' },
            { table: 'agreement_fields', sql: 'CREATE INDEX IF NOT EXISTS idx_agreement_fields_field ON agreement_fields(field_id)' },
        ];

        let shouldRetry = false;
        for (const idx of indices) {
            const ok = await tryCreateIndex(idx.table, idx.sql);
            if (!ok) shouldRetry = true;
        }

        // Retry quietly a few times to avoid boot-time noise on web.
        if (shouldRetry && this.indexRetryCount < 5 && !this.indexRetryTimer) {
            this.indexRetryCount += 1;
            this.indexRetryTimer = setTimeout(() => {
                this.indexRetryTimer = null;
                this._initialize().catch(() => { });
            }, 750);
        }
    }

    protected openDBAdapter(options: PowerSyncDatabaseOptionsWithSettings): DBAdapter {
        const factory = new SQLJSOpenFactory({
            ...options.database,
            locateFile: (file: string) => {
                if (file.endsWith('.wasm')) {
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
            console.log('[PowerSync] Using web-compatible sync implementation with hydration');

            let hydrationPromise: Promise<void> | null = null;
            let hasHydrated = false;

            const yieldToMain = () => new Promise(resolve => setTimeout(resolve, 0));

            const chunkedInsert = async (table: string, columns: string[], data: any[]) => {
                const chunkSize = 100;
                for (let i = 0; i < data.length; i += chunkSize) {
                    const chunk = data.slice(i, i + chunkSize);
                    await this.writeTransaction(async (tx) => {
                        for (const row of chunk) {
                            const placeholders = columns.map(() => '?').join(', ');
                            const values = columns.map(col => {
                                const val = row[col];
                                if (typeof val === 'boolean') return val ? 1 : 0;
                                return val;
                            });
                            await tx.execute(
                                `INSERT OR REPLACE INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`,
                                values
                            );
                        }
                    });
                    // Yield to main thread after each chunk to keep UI responsive and allow GC
                    await yieldToMain();
                }
            };

            const performHydration = async () => {
                if (hasHydrated) return;
                if (hydrationPromise) {
                    console.log('[PowerSync Hydrator] Hydration already in progress, waiting for existing promise...');
                    return hydrationPromise;
                }

                hydrationPromise = (async () => {
                    try {
                        const user = await (connector as any).getUser();
                        if (!user) {
                            console.warn('[PowerSync Hydrator] No user found for hydration.');
                            return;
                        }

                        console.log(`[PowerSync Hydrator] Starting chunked hydration for user: ${user.id}`);

                        if (user.id === 'dev-guest-user') {
                            console.log('[PowerSync Hydrator] Detected Developer Guest - Injecting Sample Farm...');
                            await this.writeTransaction(async (tx) => {
                                const sampleFarmId = 'sample-farm-123';
                                await tx.execute(
                                    'INSERT OR REPLACE INTO farms (id, name, owner_id, created_at) VALUES (?, ?, ?, ?)',
                                    [sampleFarmId, 'Sample Organic Farm', user.id, new Date().toISOString()]
                                );
                                await tx.execute(
                                    'INSERT OR REPLACE INTO farm_members (id, user_id, farm_id, role, created_at) VALUES (?, ?, ?, ?, ?)',
                                    ['sample-member-1', user.id, sampleFarmId, 'OWNER', new Date().toISOString()]
                                );
                                await tx.execute(
                                    'INSERT OR REPLACE INTO fields (id, name, acreage, farm_id, created_at) VALUES (?, ?, ?, ?, ?)',
                                    ['field-north', 'North Pasture', 80, sampleFarmId, new Date().toISOString()]
                                );
                                await tx.execute(
                                    'INSERT OR REPLACE INTO fields (id, name, acreage, farm_id, created_at) VALUES (?, ?, ?, ?, ?)',
                                    ['field-south', 'South Valley', 120, sampleFarmId, new Date().toISOString()]
                                );
                                await tx.execute(
                                    'INSERT OR REPLACE INTO settings (id, farm_name, state, units, onboarding_completed, farm_id, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
                                    ['farm_config', 'Sample Organic Farm', 'Iowa', 'US', 1, sampleFarmId, new Date().toISOString()]
                                );
                            });
                            console.log('[PowerSync Hydrator] Sample Farm Injected.');
                            hasHydrated = true;
                            return;
                        }

                        // SEQUENTIAL FETCHING
                        // 1. Members
                        const membersRes = await (connector as any).client.from('farm_members').select('*');
                        if (membersRes.data?.length) {
                            await chunkedInsert('farm_members', ['id', 'user_id', 'farm_id', 'role', 'created_at'], membersRes.data);
                        }

                        // 2. Farms
                        const farmsRes = await (connector as any).client.from('farms').select('*');
                        if (farmsRes.data?.length) {
                            await chunkedInsert('farms', ['id', 'name', 'owner_id', 'created_at'], farmsRes.data);
                        }

                        // 3. Fields
                        const fieldsRes = await (connector as any).client.from('fields').select('*');
                        if (fieldsRes.data?.length) {
                            await chunkedInsert('fields', ['id', 'name', 'acreage', 'farm_id', 'created_at'], fieldsRes.data);
                        }

                        // 4. Recipes
                        const recipesRes = await (connector as any).client.from('recipes').select('*');
                        if (recipesRes.data?.length) {
                            await chunkedInsert('recipes', ['id', 'name', 'product_name', 'epa_number', 'rate_per_acre', 'water_rate_per_acre', 'farm_id', 'created_at'], recipesRes.data);
                        }

                        // 5. Settings
                        const settingsRes = await (connector as any).client.from('settings').select('*');
                        if (settingsRes.data?.length) {
                            const settingsData = settingsRes.data;
                            await this.writeTransaction(async (tx) => {
                                for (const s of settingsData) {
                                    await tx.execute(
                                        'INSERT OR REPLACE INTO settings (id, farm_name, state, units, onboarding_completed, farm_id, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
                                        [s.id, s.farm_name, s.state, s.units, s.onboarding_completed ? 1 : 0, s.farm_id, s.updated_at]
                                    );
                                    // Ensure standard config alias exists
                                    await tx.execute(
                                        'INSERT OR REPLACE INTO settings (id, farm_name, state, units, onboarding_completed, farm_id, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
                                        ['farm_config', s.farm_name, s.state, s.units, s.onboarding_completed ? 1 : 0, s.farm_id, s.updated_at]
                                    );
                                }
                            });
                        }

                        hasHydrated = true;
                        console.log('[PowerSync Hydrator] Hydration complete.');
                    } catch (e) {
                        console.error('[PowerSync Hydrator] Hydration failed:', e);
                        throw e;
                    } finally {
                        hydrationPromise = null;
                    }
                })();

                return hydrationPromise;
            };

            (this as any).hydrate = performHydration;

            return {
                connect: async () => {
                    await performHydration();
                },
                disconnect: async () => { },
                dispose: async () => { },
                isConnected: () => true,
                waitForReady: async () => { },
                uploadCrud: async () => {
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
} else {
    dbInstance = new PowerSyncNative({
        schema: AppSchema,
        database: {
            dbFilename: 'farmflow.db',
        },
    });
}

if (typeof globalThis !== 'undefined') {
    (globalThis as any).powersync = dbInstance;
}

export const db = dbInstance;

// Initial connection handled by SyncController
