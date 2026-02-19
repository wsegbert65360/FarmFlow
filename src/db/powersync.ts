import {
    AbstractPowerSyncDatabase,
    AbstractStreamingSyncImplementation,
    BucketStorageAdapter,
    DBAdapter,
    PowerSyncBackendConnector,
    PowerSyncDatabaseOptionsWithSettings,
    type RequiredAdditionalConnectionOptions,
    Schema,
    Table,
    Column,
    ColumnType,
    SqliteBucketStorage
} from '@powersync/common';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import { SQLJSOpenFactory } from '@powersync/adapter-sql-js';
import Dexie, { type Table as DexieTable } from 'dexie';
import { connector } from './SupabaseConnector';

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

// 1. Define the Local Schema (matches Postgres projections)
export const AppSchema = new Schema([
    new Table({
        name: 'farms',
        columns: [
            new Column({ name: 'id', type: ColumnType.TEXT }),
            new Column({ name: 'name', type: ColumnType.TEXT }),
            new Column({ name: 'owner_id', type: ColumnType.TEXT }),
            new Column({ name: 'created_at', type: ColumnType.TEXT }),
        ],
    }),
    new Table({
        name: 'invites',
        columns: [
            new Column({ name: 'id', type: ColumnType.TEXT }),
            new Column({ name: 'farm_id', type: ColumnType.TEXT }),
            new Column({ name: 'token', type: ColumnType.TEXT }),
            new Column({ name: 'role', type: ColumnType.TEXT }),
            new Column({ name: 'expires_at', type: ColumnType.TEXT }),
            new Column({ name: 'created_at', type: ColumnType.TEXT }),
        ],
    }),
    new Table({
        name: 'fields',
        columns: [
            new Column({ name: 'id', type: ColumnType.TEXT }),
            new Column({ name: 'name', type: ColumnType.TEXT }),
            new Column({ name: 'acreage', type: ColumnType.REAL }),
            new Column({ name: 'last_gps_lat', type: ColumnType.REAL }),
            new Column({ name: 'last_gps_long', type: ColumnType.REAL }),
            new Column({ name: 'farm_id', type: ColumnType.TEXT }),
            new Column({ name: 'created_at', type: ColumnType.TEXT }),
        ],
    }),
    new Table({
        name: 'recipes',
        columns: [
            new Column({ name: 'id', type: ColumnType.TEXT }),
            new Column({ name: 'name', type: ColumnType.TEXT }),
            new Column({ name: 'product_name', type: ColumnType.TEXT }), // Legacy support
            new Column({ name: 'epa_number', type: ColumnType.TEXT }),  // Legacy support
            new Column({ name: 'rate_per_acre', type: ColumnType.REAL }), // Legacy support
            new Column({ name: 'water_rate_per_acre', type: ColumnType.REAL }),
            new Column({ name: 'phi_days', type: ColumnType.INTEGER }),
            new Column({ name: 'rei_hours', type: ColumnType.INTEGER }),
            new Column({ name: 'farm_id', type: ColumnType.TEXT }),
            new Column({ name: 'created_at', type: ColumnType.TEXT }),
        ],
    }),
    new Table({
        name: 'recipe_items',
        columns: [
            new Column({ name: 'id', type: ColumnType.TEXT }),
            new Column({ name: 'recipe_id', type: ColumnType.TEXT }),
            new Column({ name: 'product_name', type: ColumnType.TEXT }),
            new Column({ name: 'epa_number', type: ColumnType.TEXT }),
            new Column({ name: 'rate', type: ColumnType.REAL }),
            new Column({ name: 'unit', type: ColumnType.TEXT }), // Gal, oz, lbs, pt, qt
            new Column({ name: 'farm_id', type: ColumnType.TEXT }),
            new Column({ name: 'created_at', type: ColumnType.TEXT }),
        ],
    }),
    new Table({
        name: 'seed_varieties',
        columns: [
            new Column({ name: 'id', type: ColumnType.TEXT }),
            new Column({ name: 'brand', type: ColumnType.TEXT }),
            new Column({ name: 'variety_name', type: ColumnType.TEXT }),
            new Column({ name: 'type', type: ColumnType.TEXT }),
            new Column({ name: 'default_population', type: ColumnType.REAL }),
            new Column({ name: 'farm_id', type: ColumnType.TEXT }),
            new Column({ name: 'created_at', type: ColumnType.TEXT }),
        ],
    }),
    new Table({
        name: 'spray_logs',
        columns: [
            new Column({ name: 'id', type: ColumnType.TEXT }),
            new Column({ name: 'field_id', type: ColumnType.TEXT }),
            new Column({ name: 'recipe_id', type: ColumnType.TEXT }),
            new Column({ name: 'sprayed_at', type: ColumnType.TEXT }),
            new Column({ name: 'weather_source', type: ColumnType.TEXT }),
            new Column({ name: 'voided_at', type: ColumnType.TEXT }),
            new Column({ name: 'void_reason', type: ColumnType.TEXT }),
            new Column({ name: 'replaces_log_id', type: ColumnType.TEXT }),
            new Column({ name: 'total_gallons', type: ColumnType.REAL }),
            new Column({ name: 'total_product', type: ColumnType.REAL }),
            new Column({ name: 'weather_temp', type: ColumnType.REAL }),
            new Column({ name: 'weather_wind_speed', type: ColumnType.REAL }),
            new Column({ name: 'weather_wind_dir', type: ColumnType.TEXT }),
            new Column({ name: 'weather_humidity', type: ColumnType.REAL }),
            new Column({ name: 'target_crop', type: ColumnType.TEXT }),
            new Column({ name: 'target_pest', type: ColumnType.TEXT }),
            new Column({ name: 'applicator_name', type: ColumnType.TEXT }),
            new Column({ name: 'applicator_cert', type: ColumnType.TEXT }),
            new Column({ name: 'acres_treated', type: ColumnType.REAL }),
            new Column({ name: 'phi_days', type: ColumnType.INTEGER }),
            new Column({ name: 'rei_hours', type: ColumnType.INTEGER }),
            new Column({ name: 'notes', type: ColumnType.TEXT }),
            new Column({ name: 'farm_id', type: ColumnType.TEXT }),
            new Column({ name: 'created_at', type: ColumnType.TEXT }),
            new Column({ name: 'updated_at', type: ColumnType.TEXT }),
            new Column({ name: 'start_time', type: ColumnType.TEXT }),
            new Column({ name: 'end_time', type: ColumnType.TEXT }),
        ],
    }),
    new Table({
        name: 'spray_log_items',
        columns: [
            new Column({ name: 'id', type: ColumnType.TEXT }),
            new Column({ name: 'farm_id', type: ColumnType.TEXT }),
            new Column({ name: 'spray_log_id', type: ColumnType.TEXT }),
            new Column({ name: 'product_name', type: ColumnType.TEXT }),
            new Column({ name: 'epa_number', type: ColumnType.TEXT }),
            new Column({ name: 'rate', type: ColumnType.REAL }),
            new Column({ name: 'rate_unit', type: ColumnType.TEXT }),
            new Column({ name: 'total_amount', type: ColumnType.REAL }),
            new Column({ name: 'total_unit', type: ColumnType.TEXT }),
            new Column({ name: 'sort_order', type: ColumnType.INTEGER }),
            new Column({ name: 'created_at', type: ColumnType.TEXT }),
            new Column({ name: 'updated_at', type: ColumnType.TEXT }),
        ],
    }),
    new Table({
        name: 'planting_logs',
        columns: [
            new Column({ name: 'id', type: ColumnType.TEXT }),
            new Column({ name: 'field_id', type: ColumnType.TEXT }),
            new Column({ name: 'seed_id', type: ColumnType.TEXT }),
            new Column({ name: 'population', type: ColumnType.REAL }),
            new Column({ name: 'depth', type: ColumnType.REAL }),
            new Column({ name: 'start_time', type: ColumnType.TEXT }),
            new Column({ name: 'end_time', type: ColumnType.TEXT }),
            new Column({ name: 'notes', type: ColumnType.TEXT }),
            new Column({ name: 'farm_id', type: ColumnType.TEXT }),
            new Column({ name: 'voided_at', type: ColumnType.TEXT }),
            new Column({ name: 'void_reason', type: ColumnType.TEXT }),
            new Column({ name: 'replaces_log_id', type: ColumnType.TEXT }),
            new Column({ name: 'planted_at', type: ColumnType.TEXT }),
            new Column({ name: 'created_at', type: ColumnType.TEXT }),
        ],
    }),
    new Table({
        name: 'bins',
        columns: [
            new Column({ name: 'id', type: ColumnType.TEXT }),
            new Column({ name: 'name', type: ColumnType.TEXT }),
            new Column({ name: 'capacity', type: ColumnType.REAL }),
            new Column({ name: 'crop_type', type: ColumnType.TEXT }),
            new Column({ name: 'landlord_id', type: ColumnType.TEXT }),
            new Column({ name: 'landlord_share_pct', type: ColumnType.REAL }),
            new Column({ name: 'farm_id', type: ColumnType.TEXT }),
            new Column({ name: 'created_at', type: ColumnType.TEXT }),
        ],
    }),
    new Table({
        name: 'grain_logs',
        columns: [
            new Column({ name: 'id', type: ColumnType.TEXT }),
            new Column({ name: 'type', type: ColumnType.TEXT }),
            new Column({ name: 'field_id', type: ColumnType.TEXT }),
            new Column({ name: 'bin_id', type: ColumnType.TEXT }),
            new Column({ name: 'destination_type', type: ColumnType.TEXT }),
            new Column({ name: 'destination_name', type: ColumnType.TEXT }),
            new Column({ name: 'contract_id', type: ColumnType.TEXT }),
            new Column({ name: 'bushels_net', type: ColumnType.REAL }),
            new Column({ name: 'moisture', type: ColumnType.REAL }),
            new Column({ name: 'start_time', type: ColumnType.TEXT }),
            new Column({ name: 'end_time', type: ColumnType.TEXT }),
            new Column({ name: 'notes', type: ColumnType.TEXT }),
            new Column({ name: 'farm_id', type: ColumnType.TEXT }),
            new Column({ name: 'created_at', type: ColumnType.TEXT }),
        ],
    }),
    new Table({
        name: 'contracts',
        columns: [
            new Column({ name: 'id', type: ColumnType.TEXT }),
            new Column({ name: 'commodity', type: ColumnType.TEXT }),
            new Column({ name: 'total_bushels', type: ColumnType.REAL }),
            new Column({ name: 'price_per_bushel', type: ColumnType.REAL }),
            new Column({ name: 'delivery_deadline', type: ColumnType.TEXT }),
            new Column({ name: 'destination_name', type: ColumnType.TEXT }),
            new Column({ name: 'farm_id', type: ColumnType.TEXT }),
            new Column({ name: 'created_at', type: ColumnType.TEXT }),
        ],
    }),
    new Table({
        name: 'farm_members',
        columns: [
            new Column({ name: 'id', type: ColumnType.TEXT }),
            new Column({ name: 'user_id', type: ColumnType.TEXT }),
            new Column({ name: 'farm_id', type: ColumnType.TEXT }),
            new Column({ name: 'role', type: ColumnType.TEXT }),
            new Column({ name: 'created_at', type: ColumnType.TEXT }),
        ],
    }),
    new Table({
        name: 'inventory',
        columns: [
            new Column({ name: 'id', type: ColumnType.TEXT }),
            new Column({ name: 'product_name', type: ColumnType.TEXT }),
            new Column({ name: 'quantity_on_hand', type: ColumnType.REAL }),
            new Column({ name: 'unit', type: ColumnType.TEXT }),
            new Column({ name: 'farm_id', type: ColumnType.TEXT }),
            new Column({ name: 'created_at', type: ColumnType.TEXT }),
        ],
    }),
    new Table({
        name: 'settings',
        columns: [
            new Column({ name: 'id', type: ColumnType.TEXT }),
            new Column({ name: 'farm_name', type: ColumnType.TEXT }),
            new Column({ name: 'state', type: ColumnType.TEXT }),
            new Column({ name: 'units', type: ColumnType.TEXT }),
            new Column({ name: 'onboarding_completed', type: ColumnType.INTEGER }), // 0 or 1 for boolean
            new Column({ name: 'default_applicator_name', type: ColumnType.TEXT }),
            new Column({ name: 'default_applicator_cert', type: ColumnType.TEXT }),
            new Column({ name: 'farm_id', type: ColumnType.TEXT }),
            new Column({ name: 'supabase_anon_key', type: ColumnType.TEXT }),
            new Column({ name: 'farm_join_token', type: ColumnType.TEXT }),
            new Column({ name: 'updated_at', type: ColumnType.TEXT }),
        ],
    }),
    new Table({
        name: 'attachments',
        columns: [
            new Column({ name: 'id', type: ColumnType.TEXT }),
            new Column({ name: 'filename', type: ColumnType.TEXT }),
            new Column({ name: 'type', type: ColumnType.TEXT }),
            new Column({ name: 'size', type: ColumnType.INTEGER }),
            new Column({ name: 'hash', type: ColumnType.TEXT }),
            new Column({ name: 'owner_record_id', type: ColumnType.TEXT }),
            new Column({ name: 'local_path', type: ColumnType.TEXT }),
            new Column({ name: 'remote_url', type: ColumnType.TEXT }),
            new Column({ name: 'status', type: ColumnType.TEXT }),
            new Column({ name: 'farm_id', type: ColumnType.TEXT }),
            new Column({ name: 'created_at', type: ColumnType.TEXT }),
        ],
    }),
    new Table({
        name: 'audit_logs',
        columns: [
            new Column({ name: 'id', type: ColumnType.TEXT }),
            new Column({ name: 'action', type: ColumnType.TEXT }), // INSERT, UPDATE, DELETE
            new Column({ name: 'table_name', type: ColumnType.TEXT }),
            new Column({ name: 'record_id', type: ColumnType.TEXT }),
            new Column({ name: 'changed_by', type: ColumnType.TEXT }),
            new Column({ name: 'changes', type: ColumnType.TEXT }), // JSON string
            new Column({ name: 'farm_id', type: ColumnType.TEXT }),
            new Column({ name: 'created_at', type: ColumnType.TEXT }),
        ],
    }),
    new Table({
        name: 'landlords',
        columns: [
            new Column({ name: 'id', type: ColumnType.TEXT }),
            new Column({ name: 'name', type: ColumnType.TEXT }),
            new Column({ name: 'email', type: ColumnType.TEXT }),
            new Column({ name: 'farm_id', type: ColumnType.TEXT }),
            new Column({ name: 'created_at', type: ColumnType.TEXT }),
        ],
    }),
    new Table({
        name: 'landlord_shares',
        columns: [
            new Column({ name: 'id', type: ColumnType.TEXT }),
            new Column({ name: 'field_id', type: ColumnType.TEXT }),
            new Column({ name: 'landlord_id', type: ColumnType.TEXT }),
            new Column({ name: 'share_percentage', type: ColumnType.REAL }),
            new Column({ name: 'farm_id', type: ColumnType.TEXT }),
            new Column({ name: 'created_at', type: ColumnType.TEXT }),
        ],
    }),
    new Table({
        name: 'rent_agreements',
        columns: [
            new Column({ name: 'id', type: ColumnType.TEXT }),
            new Column({ name: 'farm_id', type: ColumnType.TEXT }),
            new Column({ name: 'landlord_id', type: ColumnType.TEXT }),
            new Column({ name: 'crop_year', type: ColumnType.INTEGER }),
            new Column({ name: 'rent_type', type: ColumnType.TEXT }),
            new Column({ name: 'landlord_share_pct', type: ColumnType.REAL }),
            new Column({ name: 'cash_rent_per_acre', type: ColumnType.REAL }),
            new Column({ name: 'cash_rent_total', type: ColumnType.REAL }),
            new Column({ name: 'split_basis', type: ColumnType.TEXT }),
            new Column({ name: 'created_at', type: ColumnType.TEXT }),
            new Column({ name: 'updated_at', type: ColumnType.TEXT }),
        ],
    }),
    new Table({
        name: 'agreement_fields',
        columns: [
            new Column({ name: 'agreement_id', type: ColumnType.TEXT }),
            new Column({ name: 'field_id', type: ColumnType.TEXT }),
            new Column({ name: 'farm_id', type: ColumnType.TEXT }),
        ],
    }),
    new Table({
        name: 'grain_lots',
        columns: [
            new Column({ name: 'id', type: ColumnType.TEXT }),
            new Column({ name: 'farm_id', type: ColumnType.TEXT }),
            new Column({ name: 'crop_type', type: ColumnType.TEXT }),
            new Column({ name: 'crop_year', type: ColumnType.INTEGER }),
            new Column({ name: 'source_field_id', type: ColumnType.TEXT }),
            new Column({ name: 'created_at', type: ColumnType.TEXT }),
            new Column({ name: 'updated_at', type: ColumnType.TEXT }),
        ],
    }),
    new Table({
        name: 'lot_movements',
        columns: [
            new Column({ name: 'id', type: ColumnType.TEXT }),
            new Column({ name: 'farm_id', type: ColumnType.TEXT }),
            new Column({ name: 'lot_id', type: ColumnType.TEXT }),
            new Column({ name: 'movement_type', type: ColumnType.TEXT }),
            new Column({ name: 'bin_id', type: ColumnType.TEXT }),
            new Column({ name: 'destination_name', type: ColumnType.TEXT }),
            new Column({ name: 'bushels_net', type: ColumnType.REAL }),
            new Column({ name: 'moisture', type: ColumnType.REAL }),
            new Column({ name: 'test_weight', type: ColumnType.REAL }),
            new Column({ name: 'occurred_at', type: ColumnType.TEXT }),
            new Column({ name: 'note', type: ColumnType.TEXT }),
            new Column({ name: 'source_grain_log_id', type: ColumnType.TEXT }),
            new Column({ name: 'created_at', type: ColumnType.TEXT }),
            new Column({ name: 'updated_at', type: ColumnType.TEXT }),
        ],
    }),
    new Table({
        name: 'inventory_adjustments',
        columns: [
            new Column({ name: 'id', type: ColumnType.TEXT }),
            new Column({ name: 'farm_id', type: ColumnType.TEXT }),
            new Column({ name: 'product_name', type: ColumnType.TEXT }),
            new Column({ name: 'amount', type: ColumnType.REAL }),
            new Column({ name: 'reason', type: ColumnType.TEXT }),
            new Column({ name: 'reference_id', type: ColumnType.TEXT }),
            new Column({ name: 'created_at', type: ColumnType.TEXT }),
            new Column({ name: 'updated_at', type: ColumnType.TEXT }),
        ],
    }),
]);

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

export const db = dbInstance;

// Start synchronization
db.connect(connector).catch((e: any) => console.error('PowerSync connect error:', e));
