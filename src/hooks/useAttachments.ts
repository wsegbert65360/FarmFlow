import { useState, useEffect } from 'react';
import { db } from '../db/powersync';
import { v4 as uuidv4 } from 'uuid';
import { useDatabase } from './useDatabase';

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
    const { farmId, watchFarmQuery, insertFarmRow, deleteFarmRow } = useDatabase();

    useEffect(() => {
        if (!farmId) return;
        const abortController = new AbortController();

        let query = 'SELECT * FROM attachments WHERE farm_id = ?';
        let params: any[] = [farmId];

        if (ownerRecordId) {
            query += ' AND owner_record_id = ?';
            params.push(ownerRecordId);
        }

        watchFarmQuery(
            query,
            params,
            {
                onResult: (result: any) => {
                    setAttachments(result.rows?._array || []);
                    setLoading(false);
                },
                onError: (error: any) => {
                    console.error('Failed to watch attachments', error);
                    setLoading(false);
                }
            }
        );

        return () => abortController.abort();
    }, [ownerRecordId, farmId]);

    const addAttachment = async (attachment: Partial<Attachment>) => {
        try {
            const id = await insertFarmRow('attachments', {
                filename: attachment.filename || '',
                type: attachment.type || '',
                size: attachment.size || 0,
                hash: attachment.hash || '',
                owner_record_id: attachment.owner_record_id || '',
                local_path: attachment.local_path || '',
                remote_url: attachment.remote_url || '',
                status: attachment.status || 'pending'
            });
            return id;
        } catch (error) {
            console.error('[useAttachments] Failed to add attachment', error);
            throw error;
        }
    };

    const deleteAttachment = async (id: string) => {
        try {
            await deleteFarmRow('attachments', id);
        } catch (error) {
            console.error('[useAttachments] Failed to delete attachment', error);
            throw error;
        }
    };

    return { attachments, loading, addAttachment, deleteAttachment };
};
