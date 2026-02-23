import { useState, useEffect } from 'react';
import { db } from '../db/powersync';
import { connector } from '../db/SupabaseConnector';
import { useSettings } from './useSettings';

export interface FarmRecord {
    id: string;
    name: string;
    role: string;
}

export const useFarms = () => {
    const [farms, setFarms] = useState<FarmRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const { saveSettings } = useSettings();

    useEffect(() => {
        const abortController = new AbortController();

        // Note: In PowerSync, we sync both tables.
        const unsubscribe = db.watch(
            `SELECT f.id, f.name, m.role 
             FROM farms f 
             JOIN farm_members m ON f.id = m.farm_id`,
            [],
            {
                onResult: (result) => {
                    const rows = result.rows?._array || [];
                    setFarms(prev => {
                        if (JSON.stringify(prev) === JSON.stringify(rows)) return prev;
                        return rows;
                    });
                    setLoading(false);
                },
                onError: (error) => {
                    console.error('[useFarms] Watch error:', error);
                    setLoading(false);
                }
            },
            { signal: abortController.signal }
        );

        return () => {
            abortController.abort();
            if (typeof unsubscribe === 'function') (unsubscribe as any)();
        };
    }, []);

    const switchFarm = async (farmId: string, farmName: string) => {
        await saveSettings({
            farm_id: farmId,
            farm_name: farmName
        });
    };

    const acceptInvite = async (token: string) => {
        const { data, error } = await connector.client.rpc('accept_invite', {
            token_text: token
        });

        if (error) throw error;

        // Data returns as a list because RPC is RETURNS TABLE
        const inviteResult = data && data.length > 0 ? data[0] : null;

        if (inviteResult) {
            await switchFarm(inviteResult.farm_id, inviteResult.farm_name);
        }

        return inviteResult;
    };

    return { farms, loading, switchFarm, acceptInvite };
};
