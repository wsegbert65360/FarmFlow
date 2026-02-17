import { useState, useEffect } from 'react';
import { db } from '../db/powersync';
import { v4 as uuidv4 } from 'uuid';
import { useSettings } from './useSettings';

export interface Attachment {
    id: string;
    filename: string;
    type: string;
    size: number;
    hash: string;
    owner_record_id: string;
    local_path: string;
    remote_url: string;
    status: string;
    farm_id: string;
}

export const useAttachments = (ownerRecordId?: string) => {
    const [attachments, setAttachments] = useState<Attachment[]>([]);
    const [loading, setLoading] = useState(true);
    const { settings } = useSettings();
    const farmId = settings?.farm_id || 'default_farm';

    useEffect(() => {
        const abortController = new AbortController();

        let query = 'SELECT * FROM attachments WHERE farm_id = ?';
        let params: any[] = [farmId];

        if (ownerRecordId) {
            query += ' AND owner_record_id = ?';
            params.push(ownerRecordId);
        }

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
    }, [ownerRecordId, farmId]);

    const addAttachment = async (attachment: Partial<Attachment>) => {
        const id = uuidv4();
        await db.execute(
            'INSERT INTO attachments (id, filename, type, size, hash, owner_record_id, local_path, remote_url, status, farm_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                id,
                attachment.filename || '',
                attachment.type || '',
                attachment.size || 0,
                attachment.hash || '',
                attachment.owner_record_id || '',
                attachment.local_path || '',
                attachment.remote_url || '',
                attachment.status || 'pending',
                farmId,
                new Date().toISOString()
            ]
        );
        return id;
    };

    return { attachments, loading, addAttachment };
};
