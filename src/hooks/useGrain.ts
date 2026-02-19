import { useState, useEffect } from 'react';
import { db } from '../db/powersync';
import { v4 as uuidv4 } from 'uuid';
import { useDatabase } from './useDatabase';

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

export interface GrainLot {
    id: string;
    farm_id: string;
    crop_type: string;
    crop_year: number;
    source_field_id: string;
    created_at: string;
}

export interface LotMovement {
    id: string;
    farm_id: string;
    lot_id: string;
    movement_type: 'INTO_BIN' | 'OUT_OF_BIN' | 'DIRECT_TO_TOWN';
    bin_id: string | null;
    destination_name: string | null;
    bushels_net: number;
    moisture?: number;
    test_weight?: number;
    occurred_at: string;
    note?: string;
    source_grain_log_id?: string;
}

export const useGrain = () => {
    const [bins, setBins] = useState<Bin[]>([]);
    const [grainLogs, setGrainLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const { farmId, watchFarmQuery, insertFarmRow, updateFarmRow, deleteFarmRow } = useDatabase();

    useEffect(() => {
        if (!farmId) return;
        const abortController = new AbortController();

        // Watch bins with level calculation (Sum of INTO_BIN - Sum of OUT_OF_BIN)
        watchFarmQuery(
            `SELECT b.*, 
                (SELECT COALESCE(SUM(bushels_net), 0) FROM lot_movements WHERE bin_id = b.id AND movement_type = 'INTO_BIN') - 
                (SELECT COALESCE(SUM(bushels_net), 0) FROM lot_movements WHERE bin_id = b.id AND movement_type = 'OUT_OF_BIN') as current_level
             FROM bins b 
             WHERE b.farm_id = ? `,
            [farmId],
            {
                onResult: (result: any) => {
                    setBins(result.rows?._array || []);
                },
                onError: (e: any) => console.error('Failed to watch bins', e)
            }
        );

        // ... (rest of search/watch remains same)
        return () => abortController.abort();
    }, [farmId]);

    const getOrCreateLot = async (cropType: string, cropYear: number, fieldId: string) => {
        const existing = await db.getAll<GrainLot>(
            'SELECT * FROM grain_lots WHERE crop_type = ? AND crop_year = ? AND source_field_id = ? AND farm_id = ?',
            [cropType, cropYear, fieldId, farmId]
        );

        if (existing.length > 0) return existing[0].id;

        return await insertFarmRow('grain_lots', {
            crop_type: cropType,
            crop_year: cropYear,
            source_field_id: fieldId
        });
    };

    const addGrainLog = async (log: Omit<GrainLog, 'id' | 'start_time'>) => {
        try {
            const now = new Date().toISOString();
            const cropYear = new Date(log.end_time || now).getFullYear();

            // 1. Create the legacy grain_log
            const id = await insertFarmRow('grain_logs', {
                type: log.type,
                bin_id: log.bin_id,
                field_id: log.field_id || null,
                destination_type: log.destination_type,
                destination_name: log.destination_name || null,
                contract_id: log.contract_id || null,
                bushels_net: log.bushels_net,
                moisture: log.moisture,
                notes: log.notes || null,
                start_time: now,
                end_time: log.end_time || now
            });

            // 2. Phase 2: Create Lot and Movement for HARVEST
            if (log.type === 'HARVEST' && log.field_id) {
                const bin = bins.find(b => b.id === log.bin_id);
                const cropType = bin?.crop_type || 'Unknown';
                const lotId = await getOrCreateLot(cropType, cropYear, log.field_id);

                await insertFarmRow('lot_movements', {
                    lot_id: lotId,
                    movement_type: log.bin_id ? 'INTO_BIN' : 'DIRECT_TO_TOWN',
                    bin_id: log.bin_id || null,
                    destination_name: log.destination_name || null,
                    bushels_net: log.bushels_net,
                    moisture: log.moisture,
                    occurred_at: log.end_time || now,
                    source_grain_log_id: id
                });
            }

            // 3. Phase 2: FIFO Allocation for DELIVERY from Bin
            if (log.type === 'DELIVERY' && log.bin_id) {
                let remainingToAllocate = log.bushels_net;

                // Find all lots in this bin with remaining balance
                const lotBalances = await db.getAll<{ lot_id: string, balance: number }>(
                    `SELECT lot_id, 
                        SUM(CASE WHEN movement_type = 'INTO_BIN' THEN bushels_net ELSE 0 END) - 
                        SUM(CASE WHEN movement_type = 'OUT_OF_BIN' THEN bushels_net ELSE 0 END) as balance
                     FROM lot_movements
                     WHERE bin_id = ?
                     GROUP BY lot_id
                     HAVING balance > 0.01
                     ORDER BY MIN(occurred_at) ASC`,
                    [log.bin_id]
                );

                for (const lot of lotBalances) {
                    if (remainingToAllocate <= 0) break;

                    const allocatedFromLot = Math.min(remainingToAllocate, lot.balance);

                    await insertFarmRow('lot_movements', {
                        lot_id: lot.lot_id,
                        movement_type: 'OUT_OF_BIN',
                        bin_id: log.bin_id,
                        destination_name: log.destination_name || null,
                        bushels_net: allocatedFromLot,
                        occurred_at: log.end_time || now,
                        source_grain_log_id: id
                    });

                    remainingToAllocate -= allocatedFromLot;
                }

                if (remainingToAllocate > 0.1) {
                    console.warn(`[FIFO] Delivery of ${log.bushels_net} bu exceeded available bin balance. ${remainingToAllocate} bu unallocated.`);
                }
            }

            // 4. Phase 2: ADJUSTMENT handling
            if (log.type === 'ADJUSTMENT' && log.bin_id) {
                // Adjustments are essentially an INTO_BIN with positive or negative values
                // or we can create a specific movement type. For simplicity and origin tracking,
                // we'll find the most recent lot for this bin or create a 'MANUAL_ADJUST' lot.
                const bin = bins.find(b => b.id === log.bin_id);
                const cropType = bin?.crop_type || 'Unknown';
                const lotId = await getOrCreateLot(cropType, cropYear, 'MANUAL_ADJUST');

                await insertFarmRow('lot_movements', {
                    lot_id: lotId,
                    movement_type: 'INTO_BIN', // Using INTO_BIN with +/- bushels handles level adjust
                    bin_id: log.bin_id,
                    bushels_net: log.bushels_net,
                    occurred_at: log.end_time || now,
                    source_grain_log_id: id,
                    note: 'Manual Level Adjustment'
                });
            }

            return id;
        } catch (error) {
            console.error('Failed to add grain log', error);
            throw error;
        }
    };

    const addBin = async (name: string, capacity: number, crop_type: string, landlord_id?: string | null, landlord_share_pct?: number | null) => {
        try {
            const id = await insertFarmRow('bins', {
                name,
                capacity,
                crop_type,
                landlord_id: landlord_id || null,
                landlord_share_pct: landlord_share_pct || null
            });
            return id;
        } catch (error) {
            console.error('Failed to add bin', error);
            throw error;
        }
    };

    const updateBin = async (id: string, name: string, capacity: number, crop_type: string, landlord_id?: string | null, landlord_share_pct?: number | null) => {
        try {
            await updateFarmRow('bins', id, {
                name,
                capacity,
                crop_type,
                landlord_id: landlord_id || null,
                landlord_share_pct: landlord_share_pct || null
            });
        } catch (error) {
            console.error('Failed to update bin', error);
            throw error;
        }
    };

    const deleteBin = async (id: string) => {
        try {
            await db.writeTransaction(async (tx) => {
                // Delete movements associated with this bin
                await tx.execute('DELETE FROM lot_movements WHERE bin_id = ? AND farm_id = ?', [id, farmId]);
                // Delete the bin itself
                await tx.execute('DELETE FROM bins WHERE id = ? AND farm_id = ?', [id, farmId]);
            });
        } catch (error) {
            console.error('Failed to delete bin', error);
            throw error;
        }
    };

    const deleteGrainLog = async (id: string) => {
        try {
            await db.writeTransaction(async (tx) => {
                // Delete lot movements associated with this log
                await tx.execute('DELETE FROM lot_movements WHERE source_grain_log_id = ? AND farm_id = ?', [id, farmId]);
                // Delete the grain log
                await tx.execute('DELETE FROM grain_logs WHERE id = ? AND farm_id = ?', [id, farmId]);
            });
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
