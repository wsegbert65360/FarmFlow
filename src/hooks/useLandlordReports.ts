import { useState, useCallback } from 'react';
import { db } from '../db/powersync';
import { useDatabase } from './useDatabase';
import { RentAgreement } from './useAgreements';
import { GrainLot, LotMovement } from './useGrain';

export interface LandlordSettlementData {
    agreement: RentAgreement;
    fields: {
        id: string;
        name: string;
        acreage: number;
    }[];
    deliveries: {
        lotId: string;
        fieldName: string;
        destination: string;
        totalBushels: number;
        landlordBushels: number;
        date: string;
    }[];
    storage: {
        lotId: string;
        fieldName: string;
        landlordRemainingBushels: number;
    }[];
    totals: {
        cashDue: number;
        totalLandlordBushels: number;
        totalStorageBushels: number;
    };
}

export const useLandlordReports = () => {
    const { farmId } = useDatabase();

    const getLandlordSeasonSummary = useCallback(async (landlordId: string, cropYear: number): Promise<LandlordSettlementData[]> => {
        if (!farmId) return [];

        // 1. Fetch all agreements for this landlord and year
        const agreements = await db.getAll<RentAgreement>(
            'SELECT * FROM rent_agreements WHERE landlord_id = ? AND crop_year = ? AND farm_id = ?',
            [landlordId, cropYear, farmId]
        );

        const settlementData: LandlordSettlementData[] = [];

        for (const ag of agreements) {
            // 2. Fetch linked fields for this agreement
            const fields = await db.getAll<any>(
                `SELECT f.id, f.name, f.acreage 
                 FROM fields f
                 JOIN agreement_fields af ON f.id = af.field_id
                 WHERE af.agreement_id = ? AND af.farm_id = ?`,
                [ag.id, farmId]
            );

            // 3. Fetch all lots for these fields and year
            const fieldIds = fields.map(f => f.id);
            if (fieldIds.length === 0) {
                settlementData.push({
                    agreement: ag,
                    fields: [],
                    deliveries: [],
                    storage: [],
                    totals: { cashDue: ag.rent_type === 'CASH' ? (ag.cash_rent_total || 0) : 0, totalLandlordBushels: 0, totalStorageBushels: 0 }
                });
                continue;
            }

            const placeholders = fieldIds.map(() => '?').join(',');
            const lots = await db.getAll<GrainLot>(
                `SELECT * FROM grain_lots WHERE source_field_id IN (${placeholders}) AND crop_year = ? AND farm_id = ?`,
                [...fieldIds, cropYear, farmId]
            );

            const lotIds = lots.map(l => l.id);
            if (lotIds.length === 0) {
                settlementData.push({
                    agreement: ag,
                    fields,
                    deliveries: [],
                    storage: [],
                    totals: {
                        cashDue: ag.rent_type === 'CASH' ? (ag.cash_rent_total || (ag.cash_rent_per_acre ? ag.cash_rent_per_acre * fields.reduce((s, f) => s + (f.acreage || 0), 0) : 0)) : 0,
                        totalLandlordBushels: 0,
                        totalStorageBushels: 0
                    }
                });
                continue;
            }

            // 4. Fetch movements for these lots
            const lotPlaceholders = lotIds.map(() => '?').join(',');
            const movements = await db.getAll<LotMovement>(
                `SELECT * FROM lot_movements WHERE lot_id IN (${lotPlaceholders}) AND farm_id = ? ORDER BY occurred_at ASC`,
                [...lotIds, farmId]
            );

            // 5. Calculate Split & Storage
            const deliveries: LandlordSettlementData['deliveries'] = [];
            const storageMap: Record<string, number> = {}; // lotId -> current_balance

            const sharePct = ag.rent_type === 'SHARE' ? (ag.landlord_share_pct || 0) : 0;

            movements.forEach(m => {
                const lot = lots.find(l => l.id === m.lot_id);
                const fieldName = fields.find(f => f.id === lot?.source_field_id)?.name || 'Unknown';

                if (m.movement_type === 'INTO_BIN' || m.movement_type === 'DIRECT_TO_TOWN') {
                    if (m.movement_type === 'DIRECT_TO_TOWN') {
                        deliveries.push({
                            lotId: m.lot_id,
                            fieldName,
                            destination: m.destination_name || 'Town',
                            totalBushels: m.bushels_net,
                            landlordBushels: m.bushels_net * (sharePct / 100),
                            date: m.occurred_at
                        });
                    } else {
                        storageMap[m.lot_id] = (storageMap[m.lot_id] || 0) + m.bushels_net;
                    }
                } else if (m.movement_type === 'OUT_OF_BIN') {
                    storageMap[m.lot_id] = (storageMap[m.lot_id] || 0) - m.bushels_net;
                    deliveries.push({
                        lotId: m.lot_id,
                        fieldName,
                        destination: m.destination_name || 'Town',
                        totalBushels: m.bushels_net,
                        landlordBushels: m.bushels_net * (sharePct / 100),
                        date: m.occurred_at
                    });
                }
            });

            const storage: LandlordSettlementData['storage'] = Object.entries(storageMap)
                .filter(([_, balance]) => balance > 0.1)
                .map(([lotId, balance]) => ({
                    lotId,
                    fieldName: fields.find(f => f.id === lots.find(l => l.id === lotId)?.source_field_id)?.name || 'Unknown',
                    landlordRemainingBushels: balance * (sharePct / 100)
                }));

            const totalLandlordBushels = deliveries.reduce((s, d) => s + d.landlordBushels, 0);
            const totalStorageBushels = storage.reduce((s, st) => s + st.landlordRemainingBushels, 0);

            let cashDue = 0;
            if (ag.rent_type === 'CASH') {
                cashDue = ag.cash_rent_total || (ag.cash_rent_per_acre ? ag.cash_rent_per_acre * fields.reduce((s, f) => s + (f.acreage || 0), 0) : 0);
            }

            settlementData.push({
                agreement: ag,
                fields,
                deliveries,
                storage,
                totals: { cashDue, totalLandlordBushels, totalStorageBushels }
            });
        }

        return settlementData;
    }, [farmId]);

    return { getLandlordSeasonSummary };
};
