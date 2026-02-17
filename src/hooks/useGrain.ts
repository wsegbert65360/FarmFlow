import { useState, useEffect } from 'react';
import { db } from '../db/powersync';
import { v4 as uuidv4 } from 'uuid';
import { useGrainSelectors } from '../db/selectors';
import { recordAudit } from '../utils/DatabaseUtility';

export interface Bin {
    id: string;
    name: string;
    capacity: number;
    crop_type: string;
    current_level?: number;
}

export interface GrainLog {
    id: string;
    type: 'HARVEST' | 'DELIVERY';
    field_id?: string;
    bin_id?: string;
    destination_type: 'BIN' | 'ELEVATOR';
    destination_name?: string;
    bushels_net: number;
    moisture: number;
    notes?: string;
    start_time: string;
}

export const useGrain = () => {
    const [bins, setBins] = useState<Bin[]>([]);
    const [rawLogs, setRawLogs] = useState<GrainLog[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const abortController = new AbortController();

        // Watch Bins with current level
        const binQuery = `
            SELECT 
                b.*, 
                COALESCE((SELECT SUM(bushels_net) FROM grain_logs WHERE bin_id = b.id AND type = 'HARVEST'), 0) -
                COALESCE((SELECT SUM(bushels_net) FROM grain_logs WHERE bin_id = b.id AND type = 'DELIVERY'), 0) as current_level
            FROM bins b
        `;

        db.watch(
            binQuery,
            [],
            {
                onResult: (result) => {
                    setBins(result.rows?._array || []);
                    setLoading(false);
                },
                onError: (error) => {
                    console.error('Failed to watch bins', error);
                    setLoading(false);
                }
            },
            { signal: abortController.signal }
        );

        // Watch Logs for reactive stats
        db.watch(
            'SELECT * FROM grain_logs ORDER BY start_time DESC LIMIT 100',
            [],
            {
                onResult: (result) => {
                    setRawLogs(result.rows?._array || []);
                },
                onError: (error) => console.error('Failed to watch grain_logs', error)
            },
            { signal: abortController.signal }
        );

        return () => abortController.abort();
    }, []);

    // Reactive Selector Layer
    const selectors = useGrainSelectors(bins, rawLogs);

    const addGrainLog = async (log: Omit<GrainLog, 'id' | 'start_time'>) => {
        const id = uuidv4();
        await db.execute(
            `INSERT INTO grain_logs (id, type, field_id, bin_id, destination_type, destination_name, bushels_net, moisture, notes, start_time, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, log.type, log.field_id, log.bin_id, log.destination_type, log.destination_name, log.bushels_net, log.moisture, log.notes || null, new Date().toISOString(), new Date().toISOString()]
        );

        // Record Audit Trail
        await recordAudit({
            action: 'INSERT',
            tableName: 'grain_logs',
            recordId: id,
            changes: log
        });

        return id;
    };

    const createBin = async (name: string, capacity: number, cropType: string) => {
        const id = uuidv4();
        await db.execute(
            'INSERT INTO bins (id, name, capacity, crop_type, created_at) VALUES (?, ?, ?, ?, ?)',
            [id, name, capacity, cropType, new Date().toISOString()]
        );
    };

    const updateBin = async (id: string, name: string, capacity: number, cropType: string) => {
        await db.execute(
            'UPDATE bins SET name = ?, capacity = ?, crop_type = ? WHERE id = ?',
            [name, capacity, cropType, id]
        );
    };

    const deleteBin = async (id: string) => {
        await db.execute('DELETE FROM bins WHERE id = ?', [id]);
    };

    return { bins, grainLogs: rawLogs, loading, addGrainLog, createBin, updateBin, deleteBin, selectors };
};
