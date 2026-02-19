import { useState, useEffect } from 'react';
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
}

export const useFields = () => {
    const [fields, setFields] = useState<Field[]>([]);
    const [loading, setLoading] = useState(true);
    const [userLoc, setUserLoc] = useState<Location.LocationObject | null>(null);
    const { farmId, insertFarmRow, updateFarmRow, deleteFarmRow, watchFarmQuery } = useDatabase();

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
        if (!farmId) return;
        const abortController = new AbortController();

        watchFarmQuery(
            'SELECT * FROM fields WHERE farm_id = ?',
            [farmId],
            {
                onResult: (result: any) => {
                    setFields(result.rows?._array || []);
                    setLoading(false);
                },
                onError: (error: any) => {
                    console.error('Failed to watch fields', error);
                    setLoading(false);
                }
            }
        );

        return () => abortController.abort();
    }, [farmId]);

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
