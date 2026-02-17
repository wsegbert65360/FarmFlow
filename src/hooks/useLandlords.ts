import { useState, useEffect } from 'react';
import { db } from '../db/powersync';
import { v4 as uuidv4 } from 'uuid';
import { recordAudit } from '../utils/DatabaseUtility';

export interface Landlord {
    id: string;
    name: string;
    email?: string;
    created_at: string;
}

export interface LandlordShare {
    id: string;
    field_id: string;
    landlord_id: string;
    share_percentage: number;
}

export const useLandlords = () => {
    const [landlords, setLandlords] = useState<Landlord[]>([]);
    const [shares, setShares] = useState<LandlordShare[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const abortController = new AbortController();

        // Watch Landlords
        db.watch(
            'SELECT * FROM landlords ORDER BY name ASC',
            [],
            {
                onResult: (result) => setLandlords(result.rows?._array || []),
                onError: (e) => console.error('Failed to watch landlords', e)
            },
            { signal: abortController.signal }
        );

        // Watch Shares
        db.watch(
            'SELECT * FROM landlord_shares',
            [],
            {
                onResult: (result) => setShares(result.rows?._array || []),
                onError: (e) => console.error('Failed to watch landlord_shares', e)
            },
            { signal: abortController.signal }
        );

        setLoading(false);
        return () => abortController.abort();
    }, []);

    const addLandlord = async (name: string, email?: string) => {
        const id = uuidv4();
        await db.execute(
            'INSERT INTO landlords (id, name, email, created_at) VALUES (?, ?, ?, ?)',
            [id, name, email || null, new Date().toISOString()]
        );
        await recordAudit({ action: 'INSERT', tableName: 'landlords', recordId: id, changes: { name, email } });
        return id;
    };

    const setFieldShare = async (fieldId: string, landlordId: string, percentage: number) => {
        const id = uuidv4();
        // Delete existing share for this landlord on this field if any (simplified)
        await db.execute('DELETE FROM landlord_shares WHERE field_id = ? AND landlord_id = ?', [fieldId, landlordId]);

        await db.execute(
            'INSERT INTO landlord_shares (id, field_id, landlord_id, share_percentage, created_at) VALUES (?, ?, ?, ?, ?)',
            [id, fieldId, landlordId, percentage, new Date().toISOString()]
        );
        await recordAudit({ action: 'INSERT', tableName: 'landlord_shares', recordId: id, changes: { fieldId, landlordId, percentage } });
    };

    const removeLandlord = async (id: string) => {
        await db.execute('DELETE FROM landlords WHERE id = ?', [id]);
        await db.execute('DELETE FROM landlord_shares WHERE landlord_id = ?', [id]);
    };

    return {
        landlords,
        shares,
        loading,
        addLandlord,
        setFieldShare,
        removeLandlord
    };
};
