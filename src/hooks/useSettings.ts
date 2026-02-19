import { useState, useEffect } from 'react';
import { db } from '../db/powersync';
import { v4 as uuidv4 } from 'uuid';

export interface Settings {
    farm_name: string;
    state: string;
    units: 'US' | 'Metric';
    onboarding_completed: boolean;
    default_applicator_name?: string;
    default_applicator_cert?: string;
    farm_id: string;
    farm_join_token?: string;
}

export const useSettings = () => {
    const [settings, setSettings] = useState<Settings | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const abortController = new AbortController();

        db.watch(
            'SELECT * FROM settings WHERE id = ?',
            ['farm_config'],
            {
                onResult: (result) => {
                    const rows = result.rows?._array || [];
                    if (rows.length > 0) {
                        const row = rows[0];
                        setSettings({
                            farm_name: row.farm_name,
                            state: row.state,
                            units: row.units as 'US' | 'Metric',
                            onboarding_completed: Boolean(row.onboarding_completed),
                            default_applicator_name: row.default_applicator_name || '',
                            default_applicator_cert: row.default_applicator_cert || '',
                            farm_id: row.farm_id || '',
                            farm_join_token: row.farm_join_token || '',
                        });
                    }
                    setLoading(false);
                },
                onError: (error) => {
                    console.error('Failed to watch settings', error);
                    setLoading(false);
                }
            },
            { signal: abortController.signal }
        );

        return () => abortController.abort();
    }, []);

    const saveSettings = async (updated: Partial<Settings>) => {
        try {
            const current = settings || {
                farm_name: '',
                state: '',
                units: 'US', // Default to US for this application
                onboarding_completed: false,
                farm_id: uuidv4(),
                default_applicator_name: '',
                default_applicator_cert: '',
                supabase_anon_key: '',
                farm_join_token: ''
            };

            const merged = { ...current, ...updated };

            await db.execute(
                `INSERT OR REPLACE INTO settings (id, farm_name, state, units, onboarding_completed, default_applicator_name, default_applicator_cert, farm_id, farm_join_token, updated_at) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    'farm_config',
                    merged.farm_name,
                    merged.state,
                    merged.units,
                    merged.onboarding_completed ? 1 : 0,
                    merged.default_applicator_name,
                    merged.default_applicator_cert,
                    merged.farm_id,
                    merged.farm_join_token,
                    new Date().toISOString(),
                ]
            );
        } catch (error) {
            console.error('Failed to save settings', error);
            throw error;
        }
    };

    return { settings, loading, saveSettings };
};
