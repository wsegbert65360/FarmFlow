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
export const executeIdempotent = async (
    checkQuery: string,
    params: any[],
    operation: () => Promise<string | void>
): Promise<string | void> => {
    const existing = await db.execute(checkQuery, params);
    if (existing.rows && existing.rows.length > 0) {
        console.warn('[Idempotency] Operation skipped: record already exists.');
        return existing.rows.item(0).id;
    }
    return await operation();
};
