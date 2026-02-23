import { useState, useEffect } from 'react';
import { db } from '../db/powersync';
import { v4 as uuidv4 } from 'uuid';
import { useDatabase } from './useDatabase';

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
    const { farmId, watchFarmQuery, insertFarmRow, updateFarmRow, deleteFarmRow } = useDatabase();

    useEffect(() => {
        if (!farmId) return;
        const abortController = new AbortController();

        // Watch Landlords
        const unsubLandlords = watchFarmQuery(
            'SELECT * FROM landlords WHERE farm_id = ?',
            [farmId],
            {
                onResult: (result: any) => {
                    const rows = result.rows?._array || [];
                    setLandlords(prev => {
                        if (JSON.stringify(prev) === JSON.stringify(rows)) return prev;
                        return rows;
                    });
                },
                onError: (error: any) => console.error('Failed to watch landlords', error)
            }
        );

        // Watch Field Splits
        const unsubSplits = watchFarmQuery(
            'SELECT * FROM landlord_shares WHERE farm_id = ?',
            [farmId],
            {
                onResult: (result: any) => {
                    const rows = result.rows?._array || [];
                    setFieldSplits(prev => {
                        if (JSON.stringify(prev) === JSON.stringify(rows)) return prev;
                        return rows;
                    });
                    setLoading(false);
                },
                onError: (error: any) => console.error('Failed to watch field splits', error)
            }
        );

        return () => {
            abortController.abort();
            unsubLandlords();
            unsubSplits();
        };
    }, [farmId, watchFarmQuery]);

    // ... (addLandlord/addFieldSplit remain same)

    const addLandlord = async (name: string, email: string) => {
        try {
            const id = await insertFarmRow('landlords', {
                name,
                email
            });
            return id;
        } catch (error) {
            console.error('[useLandlords] Failed to add landlord', error);
            throw error;
        }
    };

    const addFieldSplit = async (fieldId: string, landlordId: string, percentage: number) => {
        try {
            await insertFarmRow('landlord_shares', {
                field_id: fieldId,
                landlord_id: landlordId,
                share_percentage: percentage
            });
        } catch (error) {
            console.error('[useLandlords] Failed to add field split', error);
            throw error;
        }
    };

    const deleteSplit = async (id: string) => {
        try {
            await deleteFarmRow('landlord_shares', id);
        } catch (error) {
            console.error('[useLandlords] Failed to delete field split', error);
            throw error;
        }
    };

    const deleteLandlord = async (id: string) => {
        try {
            // 1. Delete associated splits
            // We still use direct execute for batch deletion of splits by landlord_id
            await db.execute('DELETE FROM landlord_shares WHERE landlord_id = ? AND farm_id = ?', [id, farmId]);
            // 2. Delete landlord
            await deleteFarmRow('landlords', id);
        } catch (e) {
            console.error('[useLandlords] Failed to delete landlord', e);
            throw e;
        }
    };

    return { landlords, fieldSplits, loading, addLandlord, addFieldSplit, deleteSplit, deleteLandlord };
};
