import { useState, useEffect } from 'react';
import { db } from '../db/powersync';
import { useDatabase } from './useDatabase';

/**
 * Aggregates all seasonal operational data for a specific field.
 * Enforces strict farm_id scoping.
 */
export const fetchFieldSeasonalData = async (fieldId: string, farmId: string) => {
    // Aggregated query for all logs matching this field
    const sprayLogs = await db.getAll(
        `SELECT sl.*, r.name as recipe_name, r.water_rate_per_acre
         FROM spray_logs sl
         LEFT JOIN recipes r ON sl.recipe_id = r.id
         WHERE sl.field_id = ? AND sl.farm_id = ?
         ORDER BY sl.start_time DESC`,
        [fieldId, farmId]
    );

    // Fetch items for those spray logs
    const sprayLogIds = sprayLogs.map((l: any) => l.id);
    let sprayItems: any[] = [];
    if (sprayLogIds.length > 0) {
        const placeholders = sprayLogIds.map(() => '?').join(',');
        sprayItems = await db.getAll(
            `SELECT ri.* 
             FROM recipe_items ri
             JOIN recipes r ON ri.recipe_id = r.id
             JOIN spray_logs sl ON sl.recipe_id = r.id
             WHERE sl.id IN (${placeholders}) AND ri.farm_id = ?`,
            [...sprayLogIds, farmId]
        );
    }

    const plantingLogs = await db.getAll(
        `SELECT pl.*, sv.brand, sv.variety_name, sv.type as seed_type
         FROM planting_logs pl
         LEFT JOIN seed_varieties sv ON pl.seed_id = sv.id
         WHERE pl.field_id = ? AND pl.farm_id = ?
         ORDER BY pl.start_time DESC`,
        [fieldId, farmId]
    );

    const grainLogs = await db.getAll(
        `SELECT gl.*, b.name as bin_name
         FROM grain_logs gl
         LEFT JOIN bins b ON gl.bin_id = b.id
         WHERE gl.field_id = ? AND gl.farm_id = ?
         ORDER BY gl.start_time DESC`,
        [fieldId, farmId]
    );

    const auditLogs = await db.getAll(
        `SELECT * FROM audit_logs 
         WHERE farm_id = ? AND record_id IN (
            SELECT id FROM spray_logs WHERE field_id = ? AND farm_id = ?
            UNION
            SELECT id FROM planting_logs WHERE field_id = ? AND farm_id = ?
            UNION
            SELECT id FROM grain_logs WHERE field_id = ? AND farm_id = ?
         )
         ORDER BY created_at DESC`,
        [farmId, fieldId, farmId, fieldId, farmId, fieldId, farmId]
    );

    // Fetch landlord shares for this field
    const shares = await db.getAll(
        `SELECT ls.*, l.name as landlord_name
         FROM landlord_shares ls
         JOIN landlords l ON ls.landlord_id = l.id
         WHERE ls.field_id = ? AND ls.farm_id = ?`,
        [fieldId, farmId]
    );

    return {
        sprayLogs: sprayLogs.map((l: any) => ({
            ...l,
            items: sprayItems.filter((i: any) => l.recipe_id === i.recipe_id)
        })),
        plantingLogs,
        grainLogs,
        auditLogs,
        shares
    };
};

export const useFieldReport = (fieldId: string | null) => {
    const [reportData, setReportData] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const { farmId } = useDatabase();

    const fetchReportData = async () => {
        if (!farmId || !fieldId) return;
        setLoading(true);
        try {
            const data = await fetchFieldSeasonalData(fieldId, farmId);
            setReportData(data);
        } catch (error) {
            console.error('[useFieldReport] Failed to fetch data', error);
        } finally {
            setLoading(false);
        }
    };

    return { fetchReportData, reportData, loading };
};
