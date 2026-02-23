import { useState, useEffect } from 'react';
import { db } from '../db/powersync';
import { useDatabase } from './useDatabase';
import { v4 as uuidv4 } from 'uuid';

export interface RentAgreement {
    id: string;
    farm_id: string;
    landlord_id: string;
    crop_year: number;
    rent_type: 'CASH' | 'SHARE';
    landlord_share_pct?: number;
    cash_rent_per_acre?: number;
    cash_rent_total?: number;
    split_basis: 'BUSHELS' | 'PROCEEDS';
    created_at: string;
    updated_at: string;
}

export interface AgreementField {
    agreement_id: string;
    field_id: string;
    farm_id: string;
}

export const useAgreements = (cropYear?: number) => {
    const [agreements, setAgreements] = useState<RentAgreement[]>([]);
    const [loading, setLoading] = useState(true);
    const { farmId, watchFarmQuery } = useDatabase();

    useEffect(() => {
        if (!farmId) return;

        let query = 'SELECT * FROM rent_agreements WHERE farm_id = ?';
        const params: any[] = [farmId];

        if (cropYear) {
            query += ' AND crop_year = ?';
            params.push(cropYear);
        }

        query += ' ORDER BY crop_year DESC, created_at DESC';

        const unsubscribe = watchFarmQuery(query, params, {
            onResult: (result: any) => {
                const rows = result.rows?._array || [];
                setAgreements(prev => {
                    if (JSON.stringify(prev) === JSON.stringify(rows)) return prev;
                    return rows;
                });
                setLoading(false);
            }
        });

        return () => {
            if (typeof unsubscribe === 'function') unsubscribe();
        };
    }, [farmId, cropYear, watchFarmQuery]);

    const addAgreement = async (data: Omit<RentAgreement, 'id' | 'farm_id' | 'created_at' | 'updated_at'>) => {
        if (!farmId) throw new Error('No active farm ID');
        const id = uuidv4();
        const now = new Date().toISOString();

        await db.execute(
            `INSERT INTO rent_agreements (id, farm_id, landlord_id, crop_year, rent_type, landlord_share_pct, cash_rent_per_acre, cash_rent_total, split_basis, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                id,
                farmId,
                data.landlord_id,
                data.crop_year,
                data.rent_type,
                data.landlord_share_pct || null,
                data.cash_rent_per_acre || null,
                data.cash_rent_total || null,
                data.split_basis || 'BUSHELS',
                now,
                now
            ]
        );
        return id;
    };

    const deleteAgreement = async (id: string) => {
        if (!farmId) return;
        await db.writeTransaction(async (tx) => {
            await tx.execute('DELETE FROM agreement_fields WHERE agreement_id = ? AND farm_id = ?', [id, farmId]);
            await tx.execute('DELETE FROM rent_agreements WHERE id = ? AND farm_id = ?', [id, farmId]);
        });
    };

    const linkFields = async (agreementId: string, fieldIds: string[]) => {
        if (!farmId) return;
        await db.writeTransaction(async (tx) => {
            // Remove existing links for this agreement to reset
            await tx.execute('DELETE FROM agreement_fields WHERE agreement_id = ? AND farm_id = ?', [agreementId, farmId]);

            // Add new links
            for (const fieldId of fieldIds) {
                await tx.execute(
                    'INSERT INTO agreement_fields (agreement_id, field_id, farm_id) VALUES (?, ?, ?)',
                    [agreementId, fieldId, farmId]
                );
            }
        });
    };

    const getAgreementFields = async (agreementId: string) => {
        if (!farmId) return [];
        const result = await db.getAll(
            'SELECT field_id FROM agreement_fields WHERE agreement_id = ? AND farm_id = ?',
            [agreementId, farmId]
        );
        return result.map((r: any) => r.field_id);
    };

    return {
        agreements,
        loading,
        addAgreement,
        deleteAgreement,
        linkFields,
        getAgreementFields
    };
};
