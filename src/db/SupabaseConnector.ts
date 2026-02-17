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
            const result = await db.execute('SELECT supabase_anon_key FROM settings WHERE id = ?', ['farm_config']);
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

        const dynamicKey = await this.getDynamicKey();
        const activeKey = dynamicKey || SUPABASE_ANON_KEY;

        if (SUPABASE_URL.includes('YOUR_PROJECT_ID') || activeKey === 'YOUR_ANON_KEY') {
            console.warn('[SupabaseConnector] Using placeholder credentials. Sync will be local-only.');
            return {
                endpoint: SUPABASE_URL,
                token: 'mock-token',
            };
        }

        const { data: { session }, error } = await this.client.auth.getSession();

        if (error) {
            throw new Error(`Failed to fetch session: ${error.message}`);
        }

        return {
            endpoint: SUPABASE_URL,
            token: session?.access_token ?? '',
        };
    }

    async uploadData(database: AbstractPowerSyncDatabase): Promise<void> {
        await this.updateClient();
        const batch = await database.getCrudBatch();
        if (!batch) return;

        try {
            for (const op of batch.crud) {
                const table = this.client.from(op.table);
                let result;

                if (op.op === 'PUT' || op.op === 'PATCH') {
                    result = await table.upsert({ id: op.id, ...op.opData });
                } else if (op.op === 'DELETE') {
                    result = await table.delete().eq('id', op.id);
                }

                if (result?.error) {
                    console.error('[SupabaseConnector] Upload error detail:', result.error);
                    if (SUPABASE_URL.includes('YOUR_PROJECT_ID')) {
                        console.log('[SupabaseConnector] Ignoring upload error due to placeholder credentials.');
                        continue;
                    }
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
