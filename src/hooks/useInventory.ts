import { useState, useEffect } from 'react';
import { db } from '../db/powersync';
import { useDatabase } from './useDatabase';

export interface InventoryItem {
    id: string;
    product_name: string;
    quantity_on_hand: number;
    unit: string;
    farm_id: string;
}

export const useInventory = () => {
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const { farmId, watchFarmQuery, insertFarmRow, updateFarmRow } = useDatabase();

    useEffect(() => {
        if (!farmId) return;
        const abortController = new AbortController();

        watchFarmQuery(
            'SELECT * FROM inventory WHERE farm_id = ?',
            [farmId],
            {
                onResult: (result: any) => {
                    setInventory(result.rows?._array || []);
                    setLoading(false);
                },
                onError: (error: any) => {
                    console.error('Failed to watch inventory', error);
                    setLoading(false);
                }
            }
        );

        return () => abortController.abort();
    }, [farmId]);

    const updateQuantity = async (productName: string, newQuantity: number) => {
        const existing = inventory.find(i => i.product_name === productName);
        try {
            if (existing) {
                await updateFarmRow('inventory', existing.id, { quantity_on_hand: newQuantity });
            } else {
                await insertFarmRow('inventory', {
                    product_name: productName,
                    quantity_on_hand: newQuantity,
                    unit: 'Units'
                });
            }
        } catch (error) {
            console.error('[useInventory] Failed to update quantity', error);
            throw error;
        }
    };

    const atRiskCount = inventory.filter(i => i.quantity_on_hand < 0).length;

    return { inventory, atRiskCount, loading, updateQuantity };
};
