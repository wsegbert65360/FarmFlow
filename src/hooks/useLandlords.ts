import { useState, useEffect } from 'react';
import { db } from '../db/powersync';
import { v4 as uuidv4 } from 'uuid';
import { useSettings } from './useSettings';
import { recordAudit } from '../utils/DatabaseUtility';

export interface Landlord {
    id: string;
    name: string;
    email: string;
}

export interface FieldSplit {
    id: string;
    field_id: string;
    landlord_id: string;
    share_percentage: number;
}

export const useLandlords = () => {
    const [landlords, setLandlords] = useState<Landlord[]>([]);
    const [fieldSplits, setFieldSplits] = useState<FieldSplit[]>([]);
    const [loading, setLoading] = useState(true);
    const { settings, loading: settingsLoading } = useSettings();
    const farmId = settings?.farm_id;

    useEffect(() => {
        if (!farmId || settingsLoading) return;
        const abortController = new AbortController();

        // Watch Landlords
        db.watch(
            'SELECT * FROM landlords WHERE farm_id = ?',
            [farmId],
            {
                onResult: (result) => setLandlords(result.rows?._array || []),
                onError: (error) => console.error('Failed to watch landlords', error)
            },
            { signal: abortController.signal }
        );

        // Watch Splits
        db.watch(
            'SELECT * FROM landlord_shares WHERE farm_id = ?',
            [farmId],
            {
                onResult: (result) => {
                    setFieldSplits(result.rows?._array || []);
                    setLoading(false);
                },
                onError: (error) => {
                    console.error('Failed to watch landlord_shares', error);
                    setLoading(false);
                }
            },
            { signal: abortController.signal }
        );

        return () => abortController.abort();
    }, [farmId]);

    const addLandlord = async (name: string, email: string) => {
        if (!farmId) throw new Error('No farm selected');
        const id = uuidv4();
        await db.execute(
            'INSERT INTO landlords (id, name, email, farm_id, created_at) VALUES (?, ?, ?, ?, ?)',
            [id, name, email, farmId, new Date().toISOString()]
        );
        await recordAudit({ action: 'INSERT', tableName: 'landlords', recordId: id, farmId: farmId, changes: { name, email } });
        return id;
    };

    const addFieldSplit = async (fieldId: string, landlordId: string, percentage: number) => {
        if (!farmId) throw new Error('No farm selected');
        const id = uuidv4();
        await db.execute(
            'INSERT INTO landlord_shares (id, field_id, landlord_id, share_percentage, farm_id, created_at) VALUES (?, ?, ?, ?, ?, ?)',
            [id, fieldId, landlordId, percentage, farmId, new Date().toISOString()]
        );
        await recordAudit({ action: 'INSERT', tableName: 'landlord_shares', recordId: id, farmId: farmId, changes: { fieldId, landlordId, percentage } });
    };

    const deleteSplit = async (id: string) => {
        if (!farmId) throw new Error('No farm selected');
        await db.execute('DELETE FROM landlord_shares WHERE id = ? AND farm_id = ?', [id, farmId]);
        await recordAudit({ action: 'DELETE', tableName: 'landlord_shares', recordId: id, farmId: farmId, changes: { id } });
    };

    const deleteLandlord = async (id: string) => {
        if (!farmId) throw new Error('No farm selected');
        try {
            // 1. Delete associated splits
            await db.execute('DELETE FROM landlord_shares WHERE landlord_id = ? AND farm_id = ?', [id, farmId]);
            // 2. Delete landlord
            await db.execute('DELETE FROM landlords WHERE id = ? AND farm_id = ?', [id, farmId]);

            await recordAudit({
                action: 'DELETE',
                tableName: 'landlords',
                recordId: id,
                farmId: farmId,
                changes: { deleted: true }
            });
        } catch (e) {
            console.error('[useLandlords] Failed to delete landlord', e);
            throw e;
        }
    };

    return { landlords, fieldSplits, loading, addLandlord, addFieldSplit, deleteSplit, deleteLandlord };
};
