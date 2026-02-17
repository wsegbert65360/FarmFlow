import { useState, useEffect, useMemo } from 'react';
import { db } from '../db/powersync';
import * as Location from 'expo-location';
import { v4 as uuidv4 } from 'uuid';
import { useFieldSelectors } from '../db/selectors';

export interface Field {
    id: string;
    name: string;
    acreage: number;
    last_gps_lat: number | null;
    last_gps_long: number | null;
    distance?: number;
}

export const useFields = () => {
    const [rawFields, setRawFields] = useState<Field[]>([]);
    const [loading, setLoading] = useState(true);
    const [userLoc, setUserLoc] = useState<Location.LocationObject | null>(null);

    // 1. Initial location capture
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

    // 2. Watch database for changes
    useEffect(() => {
        const abortController = new AbortController();

        db.watch(
            'SELECT * FROM fields',
            [],
            {
                onResult: (result) => {
                    setRawFields(result.rows?._array || []);
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
    }, []);

    // 3. Derive sorted fields (Smart Context)
    const fields = useMemo(() => {
        const fieldList = rawFields.map((f: Field) => {
            if (userLoc && f.last_gps_lat && f.last_gps_long) {
                const dist = calculateDistance(
                    userLoc.coords.latitude,
                    userLoc.coords.longitude,
                    f.last_gps_lat,
                    f.last_gps_long
                );
                return { ...f, distance: dist };
            }
            return { ...f, distance: Infinity };
        });

        // Sort by distance (proximity)
        return fieldList.sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
    }, [rawFields, userLoc]);

    // 4. Reactive Selector Layer
    const selectors = useFieldSelectors(fields);

    const addField = async (name: string, acreage: number) => {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            let lat = null;
            let long = null;
            if (status === 'granted') {
                const loc = await Location.getCurrentPositionAsync({});
                lat = loc.coords.latitude;
                long = loc.coords.longitude;
            }

            const id = uuidv4();
            await db.execute(
                'INSERT INTO fields (id, name, acreage, last_gps_lat, last_gps_long, created_at) VALUES (?, ?, ?, ?, ?, ?)',
                [id, name, acreage, lat, long, new Date().toISOString()]
            );
        } catch (error) {
            console.error('Failed to add field', error);
            throw error;
        }
    };

    return { fields, loading, addField, selectors };
};

// Haversine formula for distance calculation (Miles)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 3958.8; // Miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}
