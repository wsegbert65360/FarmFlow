import { useState, useEffect } from 'react';
import { db } from '../db/powersync';
import { v4 as uuidv4 } from 'uuid';
import { useSettings } from './useSettings';
import { recordAudit } from '../utils/DatabaseUtility';

export interface Contract {
    id: string;
    commodity: string;
    total_bushels: number;
    price_per_bushel: number;
    delivery_deadline: string;
    destination_name: string;
    delivered_bushels: number;
}

export const useContracts = () => {
    const [contracts, setContracts] = useState<Contract[]>([]);
    const [loading, setLoading] = useState(true);
    const { settings } = useSettings();
    const farmId = settings?.farm_id || 'default_farm';

    useEffect(() => {
        const abortController = new AbortController();

        const query = `
            SELECT 
                c.*,
                COALESCE((SELECT SUM(bushels_net) FROM grain_logs WHERE contract_id = c.id), 0) as delivered_bushels
            FROM contracts c
            WHERE c.farm_id = ?
        `;

        db.watch(
            query,
            [farmId],
            {
                onResult: (result) => {
                    setContracts(result.rows?._array || []);
                    setLoading(false);
                },
                onError: (error) => {
                    console.error('Failed to watch contracts', error);
                    setLoading(false);
                }
            },
            { signal: abortController.signal }
        );

        return () => abortController.abort();
    }, [farmId]);

    const addContract = async (contract: Omit<Contract, 'id' | 'delivered_bushels'>) => {
        const id = uuidv4();
        await db.execute(
            `INSERT INTO contracts (id, commodity, total_bushels, price_per_bushel, delivery_deadline, destination_name, farm_id, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, contract.commodity, contract.total_bushels, contract.price_per_bushel, contract.delivery_deadline, contract.destination_name, farmId, new Date().toISOString()]
        );
        await recordAudit({ action: 'INSERT', tableName: 'contracts', recordId: id, farmId: farmId, changes: contract });
        return id;
    };

    const updateContract = async (id: string, contract: Partial<Contract>) => {
        await db.execute(
            `UPDATE contracts 
             SET commodity = ?, total_bushels = ?, price_per_bushel = ?, delivery_deadline = ?, destination_name = ?
             WHERE id = ? AND farm_id = ?`,
            [contract.commodity, contract.total_bushels, contract.price_per_bushel, contract.delivery_deadline, contract.destination_name, id, farmId]
        );
        await recordAudit({ action: 'UPDATE', tableName: 'contracts', recordId: id, farmId: farmId, changes: contract });
    };

    const deleteContract = async (id: string) => {
        await db.execute('DELETE FROM contracts WHERE id = ? AND farm_id = ?', [id, farmId]);
        await recordAudit({ action: 'DELETE', tableName: 'contracts', recordId: id, farmId: farmId, changes: { id } });
    };

    return { contracts, loading, addContract, updateContract, deleteContract };
};
