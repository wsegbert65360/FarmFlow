import { useState, useCallback, useEffect } from 'react';
import { db } from '../db/powersync';
import { v4 as uuidv4 } from 'uuid';
import * as FileSystem from 'expo-file-system/legacy';
import { connector } from '../db/SupabaseConnector';

export interface Attachment {
    id: string;
    filename: string;
    type: string;
    size: number;
    hash: string;
    owner_record_id: string;
    local_path: string;
    remote_url?: string;
    status: 'pending' | 'uploading' | 'synced' | 'error';
    created_at: string;
}

export const useAttachments = (ownerId?: string) => {
    const [attachments, setAttachments] = useState<Attachment[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const abortController = new AbortController();
        const query = ownerId
            ? 'SELECT * FROM attachments WHERE owner_record_id = ? ORDER BY created_at DESC'
            : 'SELECT * FROM attachments ORDER BY created_at DESC';
        const params = ownerId ? [ownerId] : [];

        db.watch(
            query,
            params,
            {
                onResult: (result) => {
                    setAttachments(result.rows?._array || []);
                    setLoading(false);
                },
                onError: (error) => {
                    console.error('Failed to watch attachments', error);
                    setLoading(false);
                }
            },
            { signal: abortController.signal }
        );

        return () => abortController.abort();
    }, [ownerId]);

    const addAttachment = async (fileUri: string, type: string, ownerRecordId: string) => {
        const id = uuidv4();
        const info = await FileSystem.getInfoAsync(fileUri);

        if (!info.exists) throw new Error('File does not exist');

        const filename = fileUri.split('/').pop() || 'attachment';
        const localPath = `${FileSystem.documentDirectory}attachments/${id}_${filename}`;

        // Ensure directory exists
        const dir = `${FileSystem.documentDirectory}attachments/`;
        const dirInfo = await FileSystem.getInfoAsync(dir);
        if (!dirInfo.exists) {
            await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
        }

        // Copy to internal storage for persistence
        await FileSystem.copyAsync({ from: fileUri, to: localPath });

        const newAttachment: Omit<Attachment, 'id'> = {
            filename,
            type,
            size: (info as any).size || 0,
            hash: 'TODO_HASH', // We can implement MD5/SHA later for deduplication
            owner_record_id: ownerRecordId,
            local_path: localPath,
            status: 'pending',
            created_at: new Date().toISOString()
        };

        await db.execute(
            `INSERT INTO attachments (id, filename, type, size, hash, owner_record_id, local_path, status, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, newAttachment.filename, newAttachment.type, newAttachment.size, newAttachment.hash, newAttachment.owner_record_id, newAttachment.local_path, newAttachment.status, newAttachment.created_at]
        );

        // Trigger background upload
        processPendingUploads();

        return id;
    };

    const processPendingUploads = useCallback(async () => {
        const pending = await db.execute('SELECT * FROM attachments WHERE status = ? OR status = ?', ['pending', 'error']);

        for (const row of (pending.rows?._array || [])) {
            const attachment = row as Attachment;

            try {
                await db.execute('UPDATE attachments SET status = ? WHERE id = ?', ['uploading', attachment.id]);

                // Upload to Supabase Storage
                const remoteUrl = await connector.uploadFile(
                    'attachments',
                    `${attachment.owner_record_id}/${attachment.id}_${attachment.filename}`,
                    attachment.local_path
                );

                await db.execute(
                    'UPDATE attachments SET status = ?, remote_url = ? WHERE id = ?',
                    ['synced', remoteUrl, attachment.id]
                );
            } catch (error) {
                console.error(`[useAttachments] Failed to upload ${attachment.id}:`, error);
                await db.execute('UPDATE attachments SET status = ? WHERE id = ?', ['error', attachment.id]);
            }
        }
    }, []);

    return {
        attachments,
        loading,
        addAttachment,
        processPendingUploads
    };
};
