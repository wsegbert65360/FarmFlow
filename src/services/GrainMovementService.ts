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
    notes?: string;
}

export class GrainMovementService {
    /**
     * Executes a harvest operation atomically.
     * Wraps legacy logs and new movement logic in a single transaction.
     */
    static async recordHarvest(params: HarvestParams): Promise<string> {
        return await db.writeTransaction(async (tx) => {
            try {
                const now = new Date().toISOString();
                const logId = uuidv4();

                // 1. Create the legacy grain_log
                await insertFarmRow('grain_logs', {
                    id: logId,
                    type: params.type,
                    bin_id: params.binId || null,
                    field_id: params.fieldId,
                    destination_type: params.type === 'HARVEST_TO_TOWN' ? 'TOWN' : 'BIN',
                    destination_name: params.destinationName || null,
                    bushels_net: params.bushels,
                    moisture: params.moisture,
                    notes: params.notes || null,
                    start_time: now,
                    end_time: now
                });

                // 2. Manage Lot (Get or Create)
                let lotId: string;
                const existingLot = await db.get<{ id: string }>(
                    'SELECT id FROM grain_lots WHERE source_field_id = ? AND crop_year = ? LIMIT 1',
                    [params.fieldId, params.cropYear]
                );

                if (existingLot) {
                    lotId = existingLot.id;
                } else {
                    lotId = uuidv4();
                    await insertFarmRow('grain_lots', {
                        id: lotId,
                        crop_type: params.cropType,
                        crop_year: params.cropYear,
                        source_field_id: params.fieldId
                    });
                }

                // 3. Record Movement
                const movementToken = params.type === 'HARVEST_TO_TOWN' ? uuidv4().substring(0, 8).toUpperCase() : null;

                await insertFarmRow('lot_movements', {
                    lot_id: lotId,
                    movement_type: params.type === 'HARVEST_TO_TOWN' ? 'DIRECT_TO_TOWN' : 'INTO_BIN',
                    bin_id: params.binId || null,
                    destination_name: params.type === 'HARVEST_TO_TOWN' ? (params.destinationName || 'Town Elevator') : null,
                    bushels_net: params.bushels,
                    moisture: params.moisture,
                    occurred_at: now,
                    source_grain_log_id: logId,
                    status: params.type === 'HARVEST_TO_TOWN' ? 'IN_TRANSIT' : 'STATIONARY',
                    movement_token: movementToken
                });

                console.log(`[GrainMovementService] Atomically recorded ${params.type} for field ${params.fieldId}`);
                return logId;

            } catch (error) {
                console.error('[GrainMovementService] Atomic transaction failed. Rolling back.', error);
                throw error; // Re-throw to trigger PowerSync transaction rollback
            }
        });
    }
}
