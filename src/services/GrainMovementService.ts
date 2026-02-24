import { db } from '../db/powersync';
import { insertFarmRow } from '../utils/DatabaseUtility';
import { v4 as uuidv4 } from 'uuid';

export type GrainLogType = 'HARVEST' | 'HARVEST_TO_TOWN' | 'DELIVERY' | 'ADJUSTMENT';

export interface HarvestParams {
    type: GrainLogType;
    fieldId: string;
    binId?: string;
    bushels: number;
    moisture: number;
    destinationName?: string;
    cropType: string;
    cropYear: number;
    farmId: string;
    notes?: string;
}

export class GrainMovementService {
    private static firstRow<T>(result: any): T | null {
        const rowsArray = result?.rows?._array;
        if (Array.isArray(rowsArray) && rowsArray.length > 0) return rowsArray[0] as T;

        // Some adapters expose rows as an object with length + item(i)
        const rowsObj = result?.rows;
        if (rowsObj && typeof rowsObj.item === 'function' && typeof rowsObj.length === 'number' && rowsObj.length > 0) {
            return rowsObj.item(0) as T;
        }

        // Fallback
        if (Array.isArray(rowsObj) && rowsObj.length > 0) return rowsObj[0] as T;
        return null;
    }

    /**
     * Executes a harvest operation atomically.
     * Wraps legacy logs and new movement logic in a single transaction.
     */
    static async recordHarvest(params: HarvestParams): Promise<string> {
        return await db.writeTransaction(async (tx) => {
            try {
                const now = new Date().toISOString();
                const logId = uuidv4();

                if (params.type === 'HARVEST' && !params.binId) {
                    throw new Error('[GrainMovementService] HARVEST requires a binId');
                }

                // 1. Create the legacy grain_log
                const grainLogId = await insertFarmRow(tx, 'grain_logs', {
                    id: logId,
                    type: params.type,
                    bin_id: params.binId || null,
                    field_id: params.fieldId,
                    destination_type: params.type === 'HARVEST_TO_TOWN' ? 'ELEVATOR' : 'BIN',
                    destination_name: params.destinationName || null,
                    bushels_net: params.bushels,
                    moisture: params.moisture,
                    notes: params.notes || null,
                    start_time: now,
                    end_time: now
                }, params.farmId);

                // 2. Manage Lot (Get or Create)
                let lotId: string;
                const lotResult = await tx.execute(
                    'SELECT id FROM grain_lots WHERE source_field_id = ? AND crop_year = ? AND farm_id = ? LIMIT 1',
                    [params.fieldId, params.cropYear, params.farmId]
                );
                const existingLot = GrainMovementService.firstRow<{ id: string }>(lotResult);

                if (existingLot) {
                    lotId = existingLot.id;
                } else {
                    lotId = uuidv4();
                    await insertFarmRow(tx, 'grain_lots', {
                        id: lotId,
                        crop_type: params.cropType,
                        crop_year: params.cropYear,
                        source_field_id: params.fieldId
                    }, params.farmId);
                }

                // 3. Record Movement
                const movementToken = params.type === 'HARVEST_TO_TOWN' ? uuidv4().substring(0, 8).toUpperCase() : null;

                await insertFarmRow(tx, 'lot_movements', {
                    lot_id: lotId,
                    movement_type: params.type === 'HARVEST_TO_TOWN' ? 'DIRECT_TO_TOWN' : 'INTO_BIN',
                    bin_id: params.binId || null,
                    destination_name: params.type === 'HARVEST_TO_TOWN' ? (params.destinationName || 'Town Elevator') : null,
                    bushels_net: params.bushels,
                    moisture: params.moisture,
                    occurred_at: now,
                    source_grain_log_id: grainLogId,
                    status: params.type === 'HARVEST_TO_TOWN' ? 'SOLD' : 'STATIONARY',
                    movement_token: movementToken
                }, params.farmId);

                console.log(`[GrainMovementService] Atomically recorded ${params.type} for field ${params.fieldId}`);
                return grainLogId;

            } catch (error) {
                console.error('[GrainMovementService] Atomic transaction failed. Rolling back.', error);
                throw error; // Re-throw to trigger PowerSync transaction rollback
            }
        });
    }
}
