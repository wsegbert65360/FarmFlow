import { useState, useEffect } from 'react';
import { db } from '../db/powersync';
import { v4 as uuidv4 } from 'uuid';
import { useSettings } from './useSettings';
import { recordAudit } from '../utils/DatabaseUtility';

export interface Bin {
    id: string;
    name: string;
    capacity: number;
    crop_type: string;
    landlord_id?: string | null;
    landlord_share_pct?: number | null;
    current_level?: number;
}

export interface GrainLog {
    id: string;
    type: 'HARVEST' | 'DELIVERY' | 'ADJUSTMENT';
    bin_id: string;
    field_id: string | null;
    destination_type: 'BIN' | 'ELEVATOR';
    destination_name: string | null;
    contract_id?: string | null;
    bushels_net: number;
    moisture: number;
    notes?: string | null;
    start_time: string;
    end_time: string | null;
}

export const useGrain = () => {
    const [bins, setBins] = useState<Bin[]>([]);
    const [grainLogs, setGrainLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const { settings, loading: settingsLoading } = useSettings();
    const farmId = settings?.farm_id;

    useEffect(() => {
        if (!farmId || settingsLoading) return;
        const abortController = new AbortController();

        // Watch bins with level calculation
        db.watch(
            `SELECT b.*, COALESCE((SELECT SUM(bushels_net) FROM grain_logs WHERE bin_id = b.id), 0) as current_level
             FROM bins b 
             WHERE b.farm_id = ? `,
            [farmId],
            {
                onResult: (result) => {
                    setBins(result.rows?._array || []);
                },
                onError: (e) => console.error('Failed to watch bins', e)
            },
            { signal: abortController.signal }
        );

        // Watch grain_logs with joins
        db.watch(
            `SELECT gl.*, b.name as bin_name, f.name as field_name, c.destination_name as cont_dest
             FROM grain_logs gl
             LEFT JOIN bins b ON gl.bin_id = b.id
             LEFT JOIN fields f ON gl.field_id = f.id
             LEFT JOIN contracts c ON gl.contract_id = c.id
             WHERE gl.farm_id = ?
    ORDER BY gl.start_time DESC`,
            [farmId],
            {
                onResult: (result) => {
                    setGrainLogs(result.rows?._array || []);
                    setLoading(false);
                },
                onError: (e) => console.error('Failed to watch grain_logs', e)
            },
            { signal: abortController.signal }
        );

        return () => abortController.abort();
    }, [farmId]);

    const addGrainLog = async (log: Omit<GrainLog, 'id' | 'start_time'>) => {
        if (!farmId) throw new Error('No farm selected');
        try {
            const id = uuidv4();
            const now = new Date().toISOString();
            await db.execute(
                `INSERT INTO grain_logs(
        id, type, bin_id, field_id, destination_type, destination_name,
        contract_id, bushels_net, moisture, notes, start_time, end_time,
        farm_id, created_at
    ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    id, log.type, log.bin_id, log.field_id || null, log.destination_type, log.destination_name || null,
                    log.contract_id || null, log.bushels_net, log.moisture, log.notes || null, now, log.end_time || now,
                    farmId, now
                ]
            );
            await recordAudit({ action: 'INSERT', tableName: 'grain_logs', recordId: id, farmId: farmId, changes: log });
            return id;
        } catch (error) {
            console.error('Failed to add grain log', error);
            throw error;
        }
    };

    const addBin = async (name: string, capacity: number, crop_type: string, landlord_id?: string | null, landlord_share_pct?: number | null) => {
        if (!farmId) throw new Error('No farm selected');
        try {
            const id = uuidv4();
            await db.execute(
                'INSERT INTO bins (id, name, capacity, crop_type, landlord_id, landlord_share_pct, farm_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [id, name, capacity, crop_type, landlord_id || null, landlord_share_pct || null, farmId, new Date().toISOString()]
            );
            await recordAudit({ action: 'INSERT', tableName: 'bins', recordId: id, farmId: farmId, changes: { name, capacity, crop_type, landlord_id, landlord_share_pct } });
            return id;
        } catch (error) {
            console.error('Failed to add bin', error);
            throw error;
        }
    };

    const updateBin = async (id: string, name: string, capacity: number, crop_type: string, landlord_id?: string | null, landlord_share_pct?: number | null) => {
        if (!farmId) throw new Error('No farm selected');
        try {
            await db.execute(
                'UPDATE bins SET name = ?, capacity = ?, crop_type = ?, landlord_id = ?, landlord_share_pct = ? WHERE id = ? AND farm_id = ?',
                [name, capacity, crop_type, landlord_id || null, landlord_share_pct || null, id, farmId]
            );
            await recordAudit({ action: 'UPDATE', tableName: 'bins', recordId: id, farmId: farmId, changes: { name, capacity, crop_type, landlord_id, landlord_share_pct } });
        } catch (error) {
            console.error('Failed to update bin', error);
            throw error;
        }
    };

    const deleteBin = async (id: string) => {
        if (!farmId) throw new Error('No farm selected');
        try {
            await db.execute('DELETE FROM bins WHERE id = ? AND farm_id = ?', [id, farmId]);
            await recordAudit({ action: 'DELETE', tableName: 'bins', recordId: id, farmId: farmId, changes: { id } });
        } catch (error) {
            console.error('Failed to delete bin', error);
            throw error;
        }
    };

    const deleteGrainLog = async (id: string) => {
        if (!farmId) throw new Error('No farm selected');
        try {
            await db.execute('DELETE FROM grain_logs WHERE id = ? AND farm_id = ?', [id, farmId]);
            await recordAudit({ action: 'DELETE', tableName: 'grain_logs', recordId: id, farmId: farmId, changes: { id } });
        } catch (error) {
            console.error('Failed to delete grain log', error);
            throw error;
        }
    };

    return {
        bins,
        grainLogs,
        loading,
        addGrainLog,
        addBin,
        updateBin,
        deleteBin,
        deleteGrainLog
    };
};
