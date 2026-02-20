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

// @deprecated - Inventory tracking disabled in Phase 10
export const useInventory = () => {
    // Return empty/safe defaults so any remaining consumers don't crash
    return {
        inventory: [] as InventoryItem[],
        atRiskCount: 0,
        loading: false,
        updateQuantity: async () => { }
    };
};
