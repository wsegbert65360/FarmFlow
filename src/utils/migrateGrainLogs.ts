import { PowerSyncDatabase } from '@powersync/react-native';
import { v4 as uuidv4 } from 'uuid';

export const migrateGrainLogsToMovements = async (db: PowerSyncDatabase, farmId: string) => {
    console.log(`[Migration] Starting grain_logs migration for farm: ${farmId}`);

    const logs = await db.getAll<any>(
        'SELECT * FROM grain_logs WHERE farm_id = ? ORDER BY start_time ASC',
        [farmId]
    );

    const lotCache: Record<string, string> = {}; // key: cropType-cropYear-fieldId

    await db.writeTransaction(async (tx) => {
        for (const log of logs) {
            // Check if already migrated
            const existing = await tx.getAll(
                'SELECT id FROM lot_movements WHERE source_grain_log_id = ?',
                [log.id]
            );
            if (existing.length > 0) continue;

            const cropYear = new Date(log.end_time || log.start_time).getFullYear();

            // For HARVEST logs
            if (log.type === 'HARVEST') {
                let fieldId = log.field_id;
                let cropType = 'Unknown';

                if (log.bin_id) {
                    const bin = await tx.getOptional<any>('SELECT crop_type FROM bins WHERE id = ?', [log.bin_id]);
                    cropType = bin?.crop_type || 'Unknown';
                }

                if (!fieldId) {
                    fieldId = 'UNKNOWN_SOURCE';
                }

                const lotKey = `${cropType}-${cropYear}-${fieldId}`;
                let lotId = lotCache[lotKey];

                if (!lotId) {
                    // Check DB for existing lot
                    const existingLot = await tx.getOptional<any>(
                        'SELECT id FROM grain_lots WHERE crop_type = ? AND crop_year = ? AND source_field_id = ? AND farm_id = ?',
                        [cropType, cropYear, fieldId, farmId]
                    );

                    if (existingLot) {
                        lotId = existingLot.id;
                    } else {
                        lotId = uuidv4();
                        await tx.execute(
                            'INSERT INTO grain_lots (id, farm_id, crop_type, crop_year, source_field_id, created_at) VALUES (?, ?, ?, ?, ?, ?)',
                            [lotId, farmId, cropType, cropYear, fieldId, log.start_time]
                        );
                    }
                    lotCache[lotKey] = lotId;
                }

                await tx.execute(
                    `INSERT INTO lot_movements (
                        id, farm_id, lot_id, movement_type, bin_id, destination_name, 
                        bushels_net, moisture, occurred_at, source_grain_log_id
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        uuidv4(), farmId, lotId, log.bin_id ? 'INTO_BIN' : 'DIRECT_TO_TOWN',
                        log.bin_id || null, log.destination_name || null,
                        log.bushels_net, log.moisture, log.end_time || log.start_time, log.id
                    ]
                );
            }

            // For DELIVERY logs - This is tricky to migrate accurately without knowing which lots were in which bins
            // For simplicity in migration, we attribute to the oldest lot for that crop type in that bin
            if (log.type === 'DELIVERY' && log.bin_id) {
                const oldestLot = await tx.getOptional<any>(
                    `SELECT lot_id FROM lot_movements 
                     WHERE bin_id = ? AND movement_type = 'INTO_BIN' 
                     ORDER BY occurred_at ASC LIMIT 1`,
                    [log.bin_id]
                );

                if (oldestLot) {
                    await tx.execute(
                        `INSERT INTO lot_movements (
                            id, farm_id, lot_id, movement_type, bin_id, destination_name, 
                            bushels_net, moisture, occurred_at, source_grain_log_id
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [
                            uuidv4(), farmId, oldestLot.lot_id, 'OUT_OF_BIN',
                            log.bin_id, log.destination_name || null,
                            log.bushels_net, log.moisture, log.end_time || log.start_time, log.id
                        ]
                    );
                }
            }
        }
    });

    console.log(`[Migration] Completed grain_logs migration for farm: ${farmId}`);
};
