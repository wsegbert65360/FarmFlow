import { db } from '../db/powersync';
import { v4 as uuidv4 } from 'uuid';

export interface AuditRecord {
    action: 'INSERT' | 'UPDATE' | 'DELETE';
    tableName: string;
    recordId: string;
    farmId: string;
    changes: any;
    changedBy?: string;
}

export const recordAudit = async (audit: AuditRecord) => {
    try {
        const id = uuidv4();
        await db.execute(
            'INSERT INTO audit_logs (id, action, table_name, record_id, farm_id, changed_by, changes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [
                id,
                audit.action,
                audit.tableName,
                audit.recordId,
                audit.farmId,
                audit.changedBy || 'SYSTEM',
                JSON.stringify(audit.changes),
                new Date().toISOString()
            ]
        );
    } catch (e) {
        console.error('[Audit] Failed to record audit log', e);
    }
};

/**
 * Ensures an operation is idempotent by checking if the record already exists.
 * Useful for retries in unstable network conditions.
 */
/**
 * Formats data for insertion by auto-attaching farm_id and user_id.
 */
export const insertFarmRow = async (
    dbInstance: any,
    table: string,
    data: any,
    farmId: string,
    userId?: string
) => {
    if (!farmId) throw new Error('[DatabaseUtility] farmId is required for insertion');

    const id = data.id || uuidv4();
    const record: any = {
        ...data,
        id,
        farm_id: farmId,
        created_at: data.created_at || new Date().toISOString()
    };

    if (userId && !record.user_id && table === 'farm_members') {
        record.user_id = userId;
    }

    const columns = Object.keys(record);
    const placeholders = columns.map(() => '?').join(', ');
    const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;

    await dbInstance.execute(sql, columns.map((col: string) => record[col]));

    // Auto-audit if it's not an audit log itself
    if (table !== 'audit_logs') {
        await recordAudit({
            action: 'INSERT',
            tableName: table,
            recordId: id,
            farmId: farmId,
            changedBy: userId,
            changes: data
        });
    }

    return id;
};

/**
 * Inserts multiple rows into a farm-scoped table within a single transaction.
 */
export const bulkInsertFarmRows = async (
    dbInstance: any,
    table: string,
    rowsData: any[],
    farmId: string,
    userId?: string
) => {
    if (!farmId) throw new Error('[DatabaseUtility] farmId is required for bulk insertion');
    if (rowsData.length === 0) return [];

    const results: string[] = [];

    await dbInstance.writeTransaction(async (tx: any) => {
        for (const data of rowsData) {
            const id = data.id || uuidv4();
            const record: any = {
                ...data,
                id,
                farm_id: farmId,
                created_at: data.created_at || new Date().toISOString()
            };

            if (userId && !record.user_id && table === 'farm_members') {
                record.user_id = userId;
            }

            const columns = Object.keys(record);
            const placeholders = columns.map(() => '?').join(', ');
            const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;

            await tx.execute(sql, columns.map((col: string) => record[col]));

            // Auto-audit (using transaction context if possible, but recordAudit uses global db.execute)
            // For now, let's keep auditing outside or pass tx to recordAudit
            if (table !== 'audit_logs') {
                await recordAudit({
                    action: 'INSERT',
                    tableName: table,
                    recordId: id,
                    farmId: farmId,
                    changedBy: userId,
                    changes: data
                });
            }
            results.push(id);
        }
    });

    return results;
};

/**
 * Updates a row in a farm-scoped table.
 * Enforces farm_id scoping.
 */
export const updateFarmRow = async (
    dbInstance: any,
    table: string,
    id: string,
    data: any,
    farmId: string,
    userId?: string
) => {
    if (!farmId) throw new Error('[DatabaseUtility] farmId is required for update');

    const columns = Object.keys(data);
    const setClause = columns.map(col => `${col} = ?`).join(', ');
    const params = [...columns.map(col => data[col]), id, farmId];

    await dbInstance.execute(
        `UPDATE ${table} SET ${setClause} WHERE id = ? AND farm_id = ?`,
        params
    );

    // Auto-audit
    await recordAudit({
        action: 'UPDATE',
        tableName: table,
        recordId: id,
        farmId: farmId,
        changedBy: userId,
        changes: data
    });
};

/**
 * Deletes a row from a farm-scoped table.
 * Enforces farm_id scoping.
 */
export const deleteFarmRow = async (
    dbInstance: any,
    table: string,
    id: string,
    farmId: string,
    userId?: string
) => {
    if (!farmId) throw new Error('[DatabaseUtility] farmId is required for deletion');

    await dbInstance.execute(
        `DELETE FROM ${table} WHERE id = ? AND farm_id = ?`,
        [id, farmId]
    );

    // Auto-audit
    await recordAudit({
        action: 'DELETE',
        tableName: table,
        recordId: id,
        farmId: farmId,
        changedBy: userId,
        changes: { id }
    });
};

/**
 * Wraps db.watch to ensure farm_id is present in the query and params.
 */
export const watchFarmQuery = (
    dbInstance: any,
    sql: string,
    params: any[],
    farmId: string,
    options: any
) => {
    if (!farmId) throw new Error('[DatabaseUtility] farmId is required for watching results');

    const lowerSql = sql.toLowerCase();
    if (!lowerSql.includes('farm_id')) {
        throw new Error(`[DatabaseUtility] watchFarmQuery SQL must include farm_id filter: ${sql}`);
    }

    if (!params.includes(farmId)) {
        throw new Error(`[DatabaseUtility] watchFarmQuery params must include active farm_id.`);
    }

    return dbInstance.watch(sql, params, options);
};

export const executeIdempotent = async (
    checkQuery: string,
    params: any[],
    operation: () => Promise<string | void>
): Promise<string | void> => {
    const existing = await db.execute(checkQuery, params);
    const rows = existing.rows?._array || (existing.rows && existing.rows.length > 0 ? [existing.rows.item(0)] : []);
    if (rows.length > 0) {
        console.warn('[Idempotency] Operation skipped: record already exists.');
        return rows[0].id;
    }
    return await operation();
};
