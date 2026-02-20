import { useState, useEffect, useCallback, useMemo } from 'react';
import { db } from '../db/powersync';
import { connector } from '../db/SupabaseConnector';
import { useSettings } from './useSettings';
import { insertFarmRow as rawInsert, bulkInsertFarmRows as rawBulkInsert, watchFarmQuery as rawWatch, updateFarmRow as rawUpdate, deleteFarmRow as rawDelete } from '../utils/DatabaseUtility';

/**
 * useDatabase Hook
 * 
 * Provides a thin wrapper around PowerSync that auto-attaches
 * the active farm_id and user_id to all operations.
 */
export const useDatabase = () => {
    const { settings } = useSettings();
    const [userId, setUserId] = useState<string | null>(null);
    const farmId = settings?.farm_id;

    useEffect(() => {
        let isMounted = true;
        connector.getUser().then(user => {
            if (isMounted) setUserId(user?.id || null);
        });
        return () => { isMounted = false; };
    }, []);

    const insertFarmRow = useCallback(async (table: string, data: any) => {
        if (!farmId) throw new Error('[useDatabase] Cannot insert: No active farm selected.');
        return rawInsert(db, table, data, farmId, userId || undefined);
    }, [farmId, userId]);

    const bulkInsertFarmRows = useCallback(async (table: string, rowsData: any[]) => {
        if (!farmId) throw new Error('[useDatabase] Cannot bulk insert: No active farm selected.');
        return rawBulkInsert(db, table, rowsData, farmId, userId || undefined);
    }, [farmId, userId]);

    const updateFarmRow = useCallback(async (table: string, id: string, data: any) => {
        if (!farmId) throw new Error('[useDatabase] Cannot update: No active farm selected.');
        return rawUpdate(db, table, id, data, farmId, userId || undefined);
    }, [farmId, userId]);

    const deleteFarmRow = useCallback(async (table: string, id: string) => {
        if (!farmId) throw new Error('[useDatabase] Cannot delete: No active farm selected.');
        return rawDelete(db, table, id, farmId, userId || undefined);
    }, [farmId, userId]);

    const watchFarmQuery = useCallback((sql: string, params: any[], options: any) => {
        if (!farmId) {
            return () => { };
        }
        return rawWatch(db, sql, params, farmId, options);
    }, [farmId]);

    const isContextLoaded = !!farmId && !!userId;

    return useMemo(() => ({
        insertFarmRow,
        bulkInsertFarmRows,
        updateFarmRow,
        deleteFarmRow,
        watchFarmQuery,
        farmId,
        userId,
        isContextLoaded
    }), [insertFarmRow, bulkInsertFarmRows, updateFarmRow, deleteFarmRow, watchFarmQuery, farmId, userId, isContextLoaded]);
};
