import { useMemo } from 'react';
import { Field } from '../hooks/useFields';
import { Bin } from '../hooks/useGrain';
import { GrainLog } from '../hooks/useGrain';
import { InventoryItem } from '../hooks/useInventory';
import { Landlord, FieldSplit } from '../hooks/useLandlords';

/**
 * Performance-optimized selectors for derivation logic.
 * These ensure that components only re-render when the specific derived data changes.
 */

export const useFieldSelectors = (fields: Field[]) => {
    return useMemo(() => {
        return {
            totalAcreage: fields.reduce((sum, f) => sum + (f.acreage || 0), 0),
            fieldCount: fields.length,
            nearbyFields: fields.filter(f => (f.distance || Infinity) < 5), // within 5 miles
        };
    }, [fields]);
};

export const useGrainSelectors = (bins: Bin[], logs: GrainLog[]) => {
    return useMemo(() => {
        const totalCapacity = bins.reduce((sum, b) => sum + (b.capacity || 0), 0);
        const currentTotalLevel = bins.reduce((sum, b) => sum + (b.current_level || 0), 0);

        return {
            totalCapacity,
            currentTotalLevel,
            utilizationPercent: totalCapacity > 0 ? (currentTotalLevel / totalCapacity) * 100 : 0,
            activeBins: bins.filter(b => (b.current_level || 0) > 0),
        };
    }, [bins, logs]);
};

export const useInventorySelectors = (inventory: InventoryItem[]) => {
    return useMemo(() => {
        return {
            atRiskItems: inventory.filter(i => i.quantity_on_hand < 0),
            totalStockValue: 0, // Placeholder for price integration later
        };
    }, [inventory]);
};

export const useComplianceSelectors = (logs: GrainLog[], shares: FieldSplit[], landlords: Landlord[]) => {
    return useMemo(() => {
        const results: Record<string, { totalBushels: number; shares: Record<string, number> }> = {};

        logs.forEach(log => {
            const fieldId = log.field_id || 'UNKNOWN';
            if (!results[fieldId]) {
                results[fieldId] = { totalBushels: 0, shares: {} };
            }
            results[fieldId].totalBushels += log.bushels_net;

            // Calculate shares for this field
            const fieldShares = shares.filter(s => s.field_id === fieldId);
            fieldShares.forEach(share => {
                // share_percentage is a decimal (e.g. 0.5 for 50%)
                const amount = log.bushels_net * share.share_percentage;
                results[fieldId].shares[share.landlord_id] = (results[fieldId].shares[share.landlord_id] || 0) + amount;
            });
        });

        // Summary across all fields
        const landlordTotals: Record<string, number> = {};
        Object.values(results).forEach(field => {
            Object.entries(field.shares).forEach(([landlordId, amount]) => {
                landlordTotals[landlordId] = (landlordTotals[landlordId] || 0) + amount;
            });
        });

        return {
            fieldSplits: results,
            landlordTotals,
            totalFarmerNet: logs.reduce((sum, log) => sum + log.bushels_net, 0) - Object.values(landlordTotals).reduce((sum, amt) => sum + amt, 0)
        };
    }, [logs, shares, landlords]);
};
