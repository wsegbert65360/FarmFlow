import { PowerSyncBackendConnector, AbstractPowerSyncDatabase } from '@powersync/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

// TODO: Replace with your actual Supabase credentials
const SUPABASE_URL = 'https://skkbmmxjclpbbijcrgyi.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY';

export class SupabaseConnector implements PowerSyncBackendConnector {
    client: SupabaseClient;

    constructor() {
        this.client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }

    async getDynamicKey(): Promise<string | null> {
        try {
            // We use the shared db instance. Since PowerSync might not be fully 
            // initialized yet when this is first called, we've carefully placed this 
            // inside fetchCredentials which is called on-demand.
            const { db } = await import('./powersync');
            const result = await db.execute('SELECT supabase_anon_key, farm_join_token FROM settings WHERE id = ?', ['farm_config']);
            return result.rows?._array[0]?.supabase_anon_key || null;
        } catch (e) {
            console.error('[SupabaseConnector] Failed to fetch dynamic key:', e);
            return null;
        }
    }

    async updateClient() {
        const dynamicKey = await this.getDynamicKey();
        const activeKey = dynamicKey || SUPABASE_ANON_KEY;

        // Update client only if necessary or just always to be safe
        this.client = createClient(SUPABASE_URL, activeKey);
    }

    async fetchCredentials() {
        await this.updateClient();

        const { db } = await import('./powersync');
        const settingsRes = await db.execute('SELECT farm_join_token, farm_id FROM settings WHERE id = ?', ['farm_config']);
        const row = settingsRes.rows?._array[0];
        const joinToken = row?.farm_join_token;

        // If no join token and not the primary development project, assume local-only
        if (!joinToken && !SUPABASE_URL.includes('skkbmmxjclpbbijcrgy')) {
            return null;
        }

        const { data: { session }, error } = await this.client.auth.getSession();

        if (error || !session) {
            // In a production app, we might trigger a sign-in or use the joinToken 
            // to exchange for a temporary session. For now, fallback to joinToken if available.
            return {
                endpoint: SUPABASE_URL,
                token: joinToken || '',
            };
        }

        return {
            endpoint: SUPABASE_URL,
            token: session.access_token,
        };
    }

    async uploadData(database: AbstractPowerSyncDatabase): Promise<void> {
        await this.updateClient();
        const batch = await database.getCrudBatch();
        if (!batch) return;

        // Get current farm_id for RLS safety if needed
        const { db } = await import('./powersync');
        const settingsRes = await db.execute('SELECT farm_id FROM settings WHERE id = ?', ['farm_config']);
        const currentFarmId = settingsRes.rows?._array[0]?.farm_id;

        try {
            for (const op of batch.crud) {
                const table = this.client.from(op.table);
                let result;

                if (op.op === 'PUT' || op.op === 'PATCH') {
                    // Inject farm_id if missing from local opData, ensuring RLS passes
                    const data = { ...op.opData };
                    if (currentFarmId && !data.farm_id) {
                        data.farm_id = currentFarmId;
                    }
                    result = await table.upsert({ id: op.id, ...data });
                } else if (op.op === 'DELETE') {
                    result = await table.delete().eq('id', op.id);
                }

                if (result?.error) {
                    console.error(`[SupabaseConnector] Upload error for ${op.table}:`, result.error);
                    throw new Error(`Failed to upload ${op.op} to ${op.table}: ${result.error.message}`);
                }
            }

            await batch.complete();
        } catch (e: any) {
            console.error('[SupabaseConnector] Data upload failed:', e);
            throw e;
        }
    }

    async uploadFile(bucket: string, path: string, localPath: string): Promise<string> {
        await this.updateClient();
        if (SUPABASE_URL.includes('YOUR_PROJECT_ID')) {
            console.warn('[SupabaseConnector] Skipping file upload due to placeholder credentials.');
            return `mock-url://${bucket}/${path}`;
        }

        try {
            let fileBody;
            if (Platform.OS === 'web') {
                // In web, we'd typically have a File/Blob, but if we're following the hook's localPath, 
                // it might be a blob URL or we might need to fetch it.
                const response = await fetch(localPath);
                fileBody = await response.blob();
            } else {
                // Native: read base64 and convert to arrayBuffer
                const base64 = await FileSystem.readAsStringAsync(localPath, { encoding: FileSystem.EncodingType.Base64 });
                fileBody = this.base64ToArrayBuffer(base64);
            }

            const { data, error } = await this.client.storage
                .from(bucket)
                .upload(path, fileBody, { upsert: true });

            if (error) throw error;

            const { data: { publicUrl } } = this.client.storage
                .from(bucket)
                .getPublicUrl(path);

            return publicUrl;
        } catch (e: any) {
            console.error('[SupabaseConnector] File upload failed:', e);
            throw e;
        }
    }

    private base64ToArrayBuffer(base64: string) {
        const binaryString = atob(base64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes.buffer;
    }
}

export const connector = new SupabaseConnector();
