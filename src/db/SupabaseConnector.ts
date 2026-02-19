import { PowerSyncBackendConnector, AbstractPowerSyncDatabase } from '@powersync/common';
import { supabase } from '../supabase/client';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

// Constants moved to client.ts, but connector needs URL for upload checks
const SUPABASE_URL = 'https://skkbmmxjclpbbijcrgyi.supabase.co';

export class SupabaseConnector implements PowerSyncBackendConnector {
    client = supabase;

    constructor() { }

    /** Unified helper for getting the current session */
    async getSession() {
        const { data: { session } } = await this.client.auth.getSession();
        return session;
    }

    /** Unified helper for getting the current user */
    async getUser() {
        const { data: { user } } = await this.client.auth.getUser();
        return user;
    }

    async ensureInitialized() {
        // No-op for hardcoded config
        return Promise.resolve();
    }

    async fetchCredentials() {
        await this.ensureInitialized();
        const { data: { session }, error } = await this.client.auth.getSession();

        if (error || !session) {
            console.warn('[SupabaseConnector] No active session found.');
            return null;
        }

        return {
            endpoint: SUPABASE_URL,
            token: session.access_token,
        };
    }

    async uploadData(database: AbstractPowerSyncDatabase): Promise<void> {
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
