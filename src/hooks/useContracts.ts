import { useState, useEffect } from 'react';
import { db } from '../db/powersync';
import { v4 as uuidv4 } from 'uuid';
import { useDatabase } from './useDatabase';

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
    const { farmId, watchFarmQuery, insertFarmRow, updateFarmRow, deleteFarmRow } = useDatabase();

    useEffect(() => {
        if (!farmId) return;
        const abortController = new AbortController();

        const query = `
            SELECT 
                c.*,
                COALESCE((SELECT SUM(bushels_net) FROM grain_logs WHERE contract_id = c.id), 0) as delivered_bushels
            FROM contracts c
            WHERE c.farm_id = ?
        `;

        const unsubscribe = watchFarmQuery(
            query,
            [farmId],
            {
                onResult: (result: any) => {
                    const rows = result.rows?._array || [];
                    setContracts(prev => {
                        if (JSON.stringify(prev) === JSON.stringify(rows)) return prev;
                        return rows;
                    });
                    setLoading(false);
                },
                onError: (error: any) => {
                    console.error('Failed to watch contracts', error);
                    setLoading(false);
                }
            }
        );

        return () => {
            abortController.abort();
            unsubscribe();
        };
    }, [farmId, watchFarmQuery]);

    const addContract = async (contract: Omit<Contract, 'id' | 'delivered_bushels'>) => {
        try {
            const id = await insertFarmRow('contracts', {
                commodity: contract.commodity,
                total_bushels: contract.total_bushels,
                price_per_bushel: contract.price_per_bushel,
                delivery_deadline: contract.delivery_deadline,
                destination_name: contract.destination_name
            });
            return id;
        } catch (error) {
            console.error('[useContracts] Failed to add contract', error);
            throw error;
        }
    };

    const updateContract = async (id: string, contract: Partial<Contract>) => {
        try {
            await updateFarmRow('contracts', id, {
                commodity: contract.commodity,
                total_bushels: contract.total_bushels,
                price_per_bushel: contract.price_per_bushel,
                delivery_deadline: contract.delivery_deadline,
                destination_name: contract.destination_name
            });
        } catch (error) {
            console.error('[useContracts] Failed to update contract', error);
            throw error;
        }
    };

    const deleteContract = async (id: string) => {
        try {
            await deleteFarmRow('contracts', id);
        } catch (error) {
            console.error('[useContracts] Failed to delete contract', error);
            throw error;
        }
    };

    return { contracts, loading, addContract, updateContract, deleteContract };
};
