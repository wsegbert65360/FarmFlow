import { useState, useEffect } from 'react';
import { db } from '../db/powersync';

export interface Settings {
    farm_name: string;
    state: string;
    units: 'US' | 'Metric';
    onboarding_completed: boolean;
    default_applicator_name: string;
    default_applicator_cert: string;
    supabase_anon_key: string;
}

export const useSettings = () => {
    const [settings, setSettings] = useState<Settings | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const abortController = new AbortController();

        // Safety timeout to prevent infinite loading spinner
        const timeout = setTimeout(() => {
            console.warn('[useSettings] Loading timeout reached. Forcing loading false.');
            setLoading(false);
        }, 5000);

        db.watch(
            'SELECT * FROM settings WHERE id = ?',
            ['farm_config'],
            {
                onResult: (result) => {
                    clearTimeout(timeout);
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
                            supabase_anon_key: row.supabase_anon_key || '',
                        });
                    }
                    setLoading(false);
                },
                onError: (error) => {
                    clearTimeout(timeout);
                    console.error('Failed to watch settings', error);
                    setLoading(false);
                }
            },
            { signal: abortController.signal }
        );

        return () => {
            clearTimeout(timeout);
            abortController.abort();
        };
    }, []);

    const saveSettings = async (newSettings: Partial<Settings>) => {
        try {
            const current = settings || { farm_name: '', state: '', units: 'US', onboarding_completed: false };
            const updated = { ...current, ...newSettings } as Settings;
            await db.execute(
                `INSERT OR REPLACE INTO settings (id, farm_name, state, units, onboarding_completed, default_applicator_name, default_applicator_cert, supabase_anon_key, updated_at) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    'farm_config',
                    updated.farm_name,
                    updated.state,
                    updated.units,
                    updated.onboarding_completed ? 1 : 0,
                    updated.default_applicator_name || '',
                    updated.default_applicator_cert || '',
                    updated.supabase_anon_key || '',
                    new Date().toISOString(),
                ]
            );
            // No manual setSettings needed! The watch will trigger the update.
        } catch (error) {
            console.error('Failed to save settings', error);
            throw error;
        }
    };

    return { settings, loading, saveSettings };
};
