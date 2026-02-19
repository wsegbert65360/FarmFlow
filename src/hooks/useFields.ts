import { useState, useEffect } from 'react';
import { db } from '../db/powersync';
import { v4 as uuidv4 } from 'uuid';
import { useSettings } from './useSettings';
import { recordAudit } from '../utils/DatabaseUtility';
import * as Location from 'expo-location';

export interface Field {
    id: string;
    name: string;
    acreage: number;
    last_gps_lat?: number;
    last_gps_long?: number;
    distance?: number;
}

export const useFields = () => {
    const [fields, setFields] = useState<Field[]>([]);
    const [loading, setLoading] = useState(true);
    const [userLoc, setUserLoc] = useState<Location.LocationObject | null>(null);
    const { settings } = useSettings();
    const farmId = settings?.farm_id || 'default_farm';

    useEffect(() => {
        const getLoc = async () => {
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
        const abortController = new AbortController();

        db.watch(
            'SELECT * FROM fields WHERE farm_id = ?',
            [farmId],
            {
                onResult: (result) => {
                    setFields(result.rows?._array || []);
                    setLoading(false);
                },
                onError: (error) => {
                    console.error('Failed to watch fields', error);
                    setLoading(false);
                }
            },
            { signal: abortController.signal }
        );

        return () => abortController.abort();
    }, [farmId]);

    const addField = async (name: string, acreage: number, lat?: number, long?: number) => {
        try {
            const id = uuidv4();
            await db.execute(
                'INSERT INTO fields (id, name, acreage, last_gps_lat, last_gps_long, farm_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [id, name, acreage, lat ?? null, long ?? null, farmId, new Date().toISOString()]
            );
            await recordAudit({
                action: 'INSERT',
                tableName: 'fields',
                recordId: id,
                farmId: farmId,
                changes: { name, acreage, lat, long }
            });
            return id;
        } catch (error) {
            console.error('Failed to add field', error);
            throw error;
        }
    };

    const updateField = async (id: string, name: string, acreage: number, lat?: number, long?: number) => {
        try {
            await db.execute(
                'UPDATE fields SET name = ?, acreage = ?, last_gps_lat = ?, last_gps_long = ? WHERE id = ? AND farm_id = ?',
                [name, acreage, lat ?? null, long ?? null, id, farmId]
            );
            await recordAudit({
                action: 'UPDATE',
                tableName: 'fields',
                recordId: id,
                farmId: farmId,
                changes: { name, acreage, lat, long }
            });
        } catch (error) {
            console.error('Failed to update field', error);
            throw error;
        }
    };

    const deleteField = async (id: string) => {
        try {
            await db.execute('DELETE FROM fields WHERE id = ? AND farm_id = ?', [id, farmId]);
            await recordAudit({
                action: 'DELETE',
                tableName: 'fields',
                recordId: id,
                farmId: farmId,
                changes: { id }
            });
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
