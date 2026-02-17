import { useState, useEffect } from 'react';
import { db } from '../db/powersync';
import { useSettings } from './useSettings';

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
    const { settings } = useSettings();
    const farmId = settings?.farm_id || 'default_farm';

    useEffect(() => {
        const abortController = new AbortController();

        db.watch(
            'SELECT * FROM inventory WHERE farm_id = ?',
            [farmId],
            {
                onResult: (result) => {
                    setInventory(result.rows?._array || []);
                    setLoading(false);
                },
                onError: (error) => {
                    console.error('Failed to watch inventory', error);
                    setLoading(false);
                }
            },
            { signal: abortController.signal }
        );

        return () => abortController.abort();
    }, [farmId]);

    const updateQuantity = async (productName: string, newQuantity: number) => {
        await db.execute(
            'INSERT OR REPLACE INTO inventory (id, product_name, quantity_on_hand, unit, farm_id) VALUES ((SELECT id FROM inventory WHERE product_name = ? AND farm_id = ?), ?, ?, ?, ?)',
            [productName, farmId, productName, newQuantity, 'Units', farmId]
        );
    };

    const atRiskCount = inventory.filter(i => i.quantity_on_hand < 0).length;

    return { inventory, atRiskCount, loading, updateQuantity };
};
