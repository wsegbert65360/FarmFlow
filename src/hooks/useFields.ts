import { useState, useEffect } from 'react';
import { Platform } from 'react-native';
import { db } from '../db/powersync';
import { v4 as uuidv4 } from 'uuid';
import { useSettings } from './useSettings';
import { recordAudit } from '../utils/DatabaseUtility';
import * as Location from 'expo-location';
import { useDatabase } from './useDatabase';

export interface Field {
    id: string;
    name: string;
    acreage: number;
    last_gps_lat?: number;
    last_gps_long?: number;
    distance?: number;
    // Metadata for card
    crop?: string;
    variety?: string;
    planted_date?: string;
    sync_status?: 'SYNCED' | 'PENDING';
}

export const useFields = () => {
    const [fields, setFields] = useState<Field[]>([]);
    const [loading, setLoading] = useState(true);
    const [userLoc, setUserLoc] = useState<Location.LocationObject | null>(null);
    const { farmId, insertFarmRow, updateFarmRow, deleteFarmRow, watchFarmQuery } = useDatabase();

    useEffect(() => {
        const getLoc = async () => {
            // Web (and many test runners) may not support Permissions API used by expo-location.
            if (Platform.OS === 'web') return;
            try {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status === 'granted') {
                    const loc = await Location.getLastKnownPositionAsync({});
                    if (loc) setUserLoc(loc);
                    else {
                        const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
                        setUserLoc(current);
                    }
                }
            } catch (e) {
                console.warn('[useFields] Location access failed', e);
            }
        };
        getLoc();
    }, []);

    useEffect(() => {
        if (!farmId) return;
        const abortController = new AbortController();

        const unsubscribe = watchFarmQuery(
            `SELECT 
                f.*,
                latest_pl.variety_name as variety,
                latest_pl.brand as brand,
                latest_pl.start_time as planted_date,
                latest_pl.seed_type as crop
             FROM fields f
             LEFT JOIN (
                SELECT pl.field_id, pl.start_time, sv.variety_name, sv.brand, sv.type as seed_type
                FROM planting_logs pl
                JOIN seed_varieties sv ON pl.seed_id = sv.id
                WHERE (pl.field_id, pl.start_time) IN (
                    SELECT field_id, MAX(start_time)
                    FROM planting_logs
                    GROUP BY field_id
                )
             ) latest_pl ON f.id = latest_pl.field_id
             WHERE f.farm_id = ?
             ORDER BY f.name ASC`,
            [farmId],
            {
                onResult: (result: any) => {
                    const rows = result.rows?._array || [];
                    const mapped = rows.map((r: any) => ({
                        ...r,
                        sync_status: 'SYNCED'
                    }));

                    setFields(prev => {
                        if (JSON.stringify(prev) === JSON.stringify(mapped)) return prev;
                        return mapped;
                    });
                    setLoading(false);
                },
                onError: (error: any) => {
                    console.error('Failed to watch fields', error);
                    setLoading(false);
                }
            }
        );

        return () => {
            abortController.abort();
            unsubscribe();
        };
    }, [farmId, watchFarmQuery]);

    const addField = async (name: string, acreage: number, lat?: number, long?: number) => {
        try {
            const id = await insertFarmRow('fields', {
                name,
                acreage,
                last_gps_lat: lat ?? null,
                last_gps_long: long ?? null
            });
            return id;
        } catch (error) {
            console.error('Failed to add field', error);
            throw error;
        }
    };

    const updateField = async (id: string, name: string, acreage: number, lat?: number, long?: number) => {
        try {
            await updateFarmRow('fields', id, {
                name,
                acreage,
                last_gps_lat: lat ?? null,
                last_gps_long: long ?? null
            });
        } catch (error) {
            console.error('Failed to update field', error);
            throw error;
        }
    };

    const deleteField = async (id: string) => {
        try {
            if (!farmId) throw new Error('Cannot delete field without active farm context.');
            const harvestCount = await db.get<{ count: number }>(
                'SELECT COUNT(id) as count FROM grain_logs WHERE field_id = ? AND farm_id = ?',
                [id, farmId]
            );
            const count = harvestCount?.count ?? 0;
            if (Number(count) > 0) {
                throw new Error('This field has existing harvest records and cannot be deleted.');
            }
            await deleteFarmRow('fields', id);
        } catch (error) {
            console.error('Failed to delete field', error);
            throw error;
        }
    };

    return {
        fields,
        loading,
        addField,
        updateField,
        deleteField
    };
};
