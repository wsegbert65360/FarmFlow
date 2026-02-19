import { db } from '../db/powersync';
import { AppSchema } from '../db/powersync';
import { connector } from '../db/SupabaseConnector';
import { Platform } from 'react-native';

/**
 * SyncUtility: Manual data pull from Supabase for web/non-native environments.
 * 
 * On web (iPhone Safari, desktop browsers), PowerSync's streaming sync is a no-op.
 * This utility directly fetches from Supabase REST API and inserts into local SQLite.
 * 
 * IMPORTANT: Not all local schema tables exist in Supabase. The initial migration only
 * created: events, fields, recipes, seed_varieties, spray_logs, planting_logs, bins,
 * grain_logs, contracts, inventory, settings. Tables like farm_members, recipe_items,
 * attachments, audit_logs, landlords, landlord_shares were added locally but may or
 * may not have been created in Supabase yet.
 */

/** Build a map of table -> column names from the static AppSchema */
const SCHEMA_COLUMNS: Record<string, string[]> = {};
for (const table of AppSchema.tables) {
    SCHEMA_COLUMNS[table.name] = table.columns.map((c: any) => c.name);
}

export const SyncUtility = {
    /**
     * On web, native streaming sync doesn't work. Always return false for web.
     */
    isNativeStreamingAvailable: (): boolean => {
        return Platform.OS !== 'web';
    },

    /**
     * Bootstrap a fresh device by discovering the user's farm from Supabase.
     * 
     * Strategy: Try settings first (always exists in Supabase). If that fails
     * or has no farm_id, try querying fields to discover a farm_id.
     */
    bootstrapDevice: async (userId: string): Promise<string | null> => {
        console.log('[SyncUtility] === BOOTSTRAP START ===');
        console.log('[SyncUtility] User ID:', userId);
        console.log('[SyncUtility] Platform:', Platform.OS);

        try {
            let farmId: string | null = null;

            // Strategy 1: Try to get settings from Supabase directly
            // The settings table always exists (initial migration)
            console.log('[SyncUtility] Step 1: Querying settings from Supabase...');
            try {
                const { data: allSettings, error: settingsError } = await connector.client
                    .from('settings')
                    .select('*')
                    .limit(10);

                console.log('[SyncUtility] Settings query result:',
                    JSON.stringify(allSettings?.length || 0), 'rows',
                    'error:', JSON.stringify(settingsError));

                if (!settingsError && allSettings && allSettings.length > 0) {
                    // Take the first settings row with a farm_id, or just the first row
                    const withFarmId = allSettings.find((s: any) => s.farm_id);
                    const settingsRow = withFarmId || allSettings[0];
                    farmId = settingsRow.farm_id || null;

                    console.log('[SyncUtility] Found settings row:', JSON.stringify(settingsRow));

                    // Insert settings locally
                    const settingsCols = SCHEMA_COLUMNS['settings'] || [];
                    const filtered = filterBySchema(settingsRow, settingsCols);
                    filtered.id = 'farm_config'; // Force local ID
                    if ('onboarding_completed' in filtered) {
                        filtered.onboarding_completed = filtered.onboarding_completed ? 1 : 0;
                    }
                    await upsertRow('settings', filtered);
                    console.log('[SyncUtility] Settings inserted locally.');
                }
            } catch (e: any) {
                console.warn('[SyncUtility] Settings query failed:', e?.message || e);
            }

            // Strategy 2: If no farm_id from settings, try farm_members (might exist)
            if (!farmId) {
                console.log('[SyncUtility] Step 1b: No farm_id from settings, trying farm_members...');
                try {
                    const { data: members, error: memberError } = await connector.client
                        .from('farm_members')
                        .select('*')
                        .eq('user_id', userId)
                        .limit(1);

                    if (!memberError && members && members.length > 0) {
                        farmId = members[0].farm_id;
                        console.log('[SyncUtility] Found farm_id from farm_members:', farmId);

                        // Also save members locally
                        const memberCols = SCHEMA_COLUMNS['farm_members'] || [];
                        for (const m of members) {
                            await upsertRow('farm_members', filterBySchema(m, memberCols));
                        }
                    }
                } catch (e: any) {
                    // farm_members table might not exist in Supabase — that's expected
                    console.log('[SyncUtility] farm_members table not available:', e?.message);
                }
            }

            // Strategy 3: If still no farm_id, try to discover from fields
            if (!farmId) {
                console.log('[SyncUtility] Step 1c: Trying to discover from fields table...');
                try {
                    const { data: fields, error: fieldsError } = await connector.client
                        .from('fields')
                        .select('*')
                        .limit(1);

                    if (!fieldsError && fields && fields.length > 0 && fields[0].farm_id) {
                        farmId = fields[0].farm_id;
                        console.log('[SyncUtility] Discovered farm_id from fields:', farmId);
                    }
                } catch (e: any) {
                    console.log('[SyncUtility] Fields discovery failed:', e?.message);
                }
            }

            if (!farmId) {
                console.log('[SyncUtility] No farm data found in Supabase. User needs to onboard first.');
                return null;
            }

            console.log('[SyncUtility] Step 2: Pulling all farm data for farm_id:', farmId);

            // Pull all data tables that exist in the initial Supabase migration
            await SyncUtility.pullAllFarmData(farmId);

            console.log('[SyncUtility] === BOOTSTRAP COMPLETE ===');
            return farmId;
        } catch (err: any) {
            console.error('[SyncUtility] === BOOTSTRAP FAILED ===', err?.message || err);
            throw err;
        }
    },

    /**
     * Pull all data tables from Supabase for a given farm.
     * Only queries tables known to exist in Supabase from the initial migration.
     * Newer tables (recipe_items, attachments, etc.) are tried but failures are tolerated.
     */
    pullAllFarmData: async (farmId: string) => {
        if (!farmId) return;

        // Tables from the initial Supabase migration (guaranteed to exist)
        const coreTables = [
            'fields', 'recipes', 'seed_varieties',
            'spray_logs', 'planting_logs', 'bins', 'grain_logs',
            'contracts', 'inventory'
        ];

        // Tables that may or may not exist in Supabase (added later locally)
        const optionalTables = [
            'recipe_items', 'farm_members', 'landlords', 'landlord_shares', 'attachments'
        ];

        let totalRows = 0;

        // Helper: pull a table, optionally filtering by farm_id
        const pullTable = async (tableName: string, hasFarmId: boolean, required: boolean) => {
            try {
                const schemaCols = SCHEMA_COLUMNS[tableName];
                if (!schemaCols || schemaCols.length === 0) {
                    console.log(`[SyncUtility] No local schema for ${tableName}, skipping.`);
                    return;
                }

                let query = connector.client.from(tableName).select('*');
                if (hasFarmId) {
                    query = query.eq('farm_id', farmId);
                }
                const { data, error } = await query;

                if (error) {
                    if (required) {
                        console.error(`[SyncUtility] ${tableName}: error:`, error.message);
                    } else {
                        console.log(`[SyncUtility] ${tableName}: not available in Supabase (expected, table may not exist)`);
                    }
                    return;
                }

                if (data && data.length > 0) {
                    console.log(`[SyncUtility] ${tableName}: inserting ${data.length} rows`);
                    for (const row of data) {
                        await upsertRow(tableName, filterBySchema(row, schemaCols));
                    }
                    totalRows += data.length;
                } else {
                    console.log(`[SyncUtility] ${tableName}: 0 rows in Supabase`);
                }
            } catch (err: any) {
                if (required) {
                    console.error(`[SyncUtility] ${tableName}: error:`, err?.message || err);
                } else {
                    console.log(`[SyncUtility] ${tableName}: skipped (${err?.message})`);
                }
            }
        };

        // Core tables with farm_id filter
        // Note: Some old tables (before multi-farm) might not have farm_id column in Supabase
        for (const t of coreTables) {
            // Try with farm_id filter first, fall back to no filter
            await pullTable(t, true, true).catch(async () => {
                console.log(`[SyncUtility] ${t}: retrying without farm_id filter...`);
                await pullTable(t, false, true);
            });
        }

        // Optional tables (may not exist in Supabase)
        for (const t of optionalTables) {
            await pullTable(t, true, false);
        }

        console.log(`[SyncUtility] Pull complete. Total rows synced: ${totalRows}`);
    },

    /**
     * Push ALL local data from PowerSync SQLite up to Supabase.
     * Returns { pushed, errors, debugLog } for diagnostic purposes.
     */
    pushAllLocalData: async (): Promise<{ pushed: number; errors: string[]; debugLog: string }> => {
        console.log('[SyncUtility] === PUSH TO CLOUD START ===');

        const allTables = [
            'settings', 'fields', 'recipes', 'recipe_items', 'seed_varieties',
            'spray_logs', 'planting_logs', 'bins', 'grain_logs',
            'contracts', 'inventory', 'farm_members', 'landlords',
            'landlord_shares', 'attachments'
        ];

        let totalPushed = 0;
        const errors: string[] = [];
        let debugLog = '';

        // Check auth status first
        const { data: { session } } = await connector.client.auth.getSession();
        debugLog += `Auth: ${session ? 'yes, user=' + session.user.id.substring(0, 8) : 'NO SESSION'}\n`;

        for (const tableName of allTables) {
            try {
                const rows = await db.getAll(`SELECT * FROM ${tableName}`);
                const validCols = SCHEMA_COLUMNS[tableName] || [];

                if (rows.length === 0) {
                    debugLog += `${tableName}: 0 local\n`;
                    continue;
                }

                debugLog += `${tableName}: ${rows.length} local → `;
                let tableSuccess = 0;

                for (const row of rows) {
                    // WHITELIST: only include columns defined in AppSchema
                    const cleaned: Record<string, any> = {};
                    for (const col of validCols) {
                        if (col in (row as any)) {
                            cleaned[col] = (row as any)[col];
                        }
                    }

                    if (!cleaned.id) continue;

                    // Convert boolean-like integers for Postgres
                    if ('onboarding_completed' in cleaned) {
                        cleaned.onboarding_completed = Boolean(cleaned.onboarding_completed);
                    }

                    const { error } = await connector.client
                        .from(tableName)
                        .upsert(cleaned, { onConflict: 'id' });

                    if (error) {
                        errors.push(`${tableName}/${cleaned.id}: ${error.message}`);
                        debugLog += `ERR `;
                    } else {
                        tableSuccess++;
                        totalPushed++;
                    }
                }
                debugLog += `${tableSuccess} ok\n`;
            } catch (e: any) {
                errors.push(`${tableName}: ${e?.message}`);
                debugLog += `${tableName}: EXCEPTION\n`;
            }
        }

        debugLog += `\nTotal: ${totalPushed} ok, ${errors.length} err`;
        if (errors.length > 0) {
            debugLog += `\n1st err: ${errors[0]}`;
        }
        console.log(`[SyncUtility] === PUSH COMPLETE: ${totalPushed} rows, ${errors.length} errors ===`);
        return { pushed: totalPushed, errors, debugLog };
    },

    /**
     * Centralized Full Sync: Pushes local data, then Pulls/Bootstraps from cloud.
     * This is the "safe" way to ensure cloud and local are in sync for non-native platforms.
     */
    performFullSync: async (userId: string): Promise<{ success: boolean; pushed: number; message: string }> => {
        console.log('[SyncUtility] Starting Full Sync...');
        try {
            // 1. Push any local "offline" changes first
            const pushResult = await SyncUtility.pushAllLocalData();

            // 2. Refresh/Bootstrap local state from cloud
            const farmId = await SyncUtility.bootstrapDevice(userId);

            if (!farmId) {
                return {
                    success: false,
                    pushed: pushResult.pushed,
                    message: 'Authenticated, but no farm data found. Please complete onboarding.'
                };
            }

            return {
                success: true,
                pushed: pushResult.pushed,
                message: `Sync successful. Pushed ${pushResult.pushed} rows.`
            };
        } catch (err: any) {
            console.error('[SyncUtility] Full sync failed:', err);
            return {
                success: false,
                pushed: 0,
                message: err.message || 'Synchronization failed.'
            };
        }
    }
};

/** Filter a Supabase row to only include columns that exist in the local schema. */
function filterBySchema(row: Record<string, any>, schemaCols: string[]): Record<string, any> {
    const result: Record<string, any> = {};
    for (const col of schemaCols) {
        if (col in row) {
            result[col] = row[col];
        }
    }
    return result;
}

/** Upsert a single row into a local table. */
async function upsertRow(tableName: string, filtered: Record<string, any>) {
    const columns = Object.keys(filtered);
    if (columns.length === 0) return;

    const placeholders = columns.map(() => '?').join(', ');
    const values = columns.map(c => {
        const v = filtered[c];
        if (v === undefined) return null;
        if (v === true) return 1;
        if (v === false) return 0;
        return v;
    });

    try {
        await db.execute(
            `INSERT OR REPLACE INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`,
            values
        );
    } catch (e: any) {
        console.error(`[SyncUtility] INSERT into ${tableName} failed:`, e?.message || e);
        console.error(`[SyncUtility]   cols: ${columns.join(', ')}, vals:`, values);
    }
}
