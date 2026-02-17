import { useState, useEffect } from 'react';
import { db } from '../db/powersync';

export interface InventoryItem {
    id: string;
    product_name: string;
    quantity_on_hand: number;
    unit: string;
}

export const useInventory = () => {
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [atRiskCount, setAtRiskCount] = useState(0);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        const abortController = new AbortController();

        db.watch(
            'SELECT * FROM inventory',
            [],
            {
                onResult: (result) => {
                    const items = result.rows?._array || [];
                    setInventory(items);
                    const negatives = items.filter((i: InventoryItem) => i.quantity_on_hand < 0).length;
                    setAtRiskCount(negatives);
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
    }, []);

    return { inventory, atRiskCount, loading };
};
