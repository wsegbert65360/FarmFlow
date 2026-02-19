import { useState, useEffect } from 'react';
import { db } from '../db/powersync';
import { v4 as uuidv4 } from 'uuid';
import { useDatabase } from './useDatabase';

export interface SeedVariety {
    id: string;
    brand: string;
    variety_name: string;
    type: string;
    default_population: number;
}

export interface PlantingLog {
    id: string;
    field_id: string;
    seed_id: string;
    population: number;
    depth: number;
    planted_at: string;
    voided_at?: string;
    void_reason?: string;
    replaces_log_id?: string;
    start_time?: string; // Deprecated
    end_time?: string | null; // Deprecated
}

export const usePlanting = () => {
    const [seeds, setSeeds] = useState<SeedVariety[]>([]);
    const [plantingLogs, setPlantingLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const { farmId, watchFarmQuery, insertFarmRow, updateFarmRow, deleteFarmRow } = useDatabase();

    useEffect(() => {
        if (!farmId) return;
        const abortController = new AbortController();

        // Watch seeds
        watchFarmQuery(
            'SELECT * FROM seed_varieties WHERE farm_id = ?',
            [farmId],
            {
                onResult: (result: any) => setSeeds(result.rows?._array || []),
                onError: (e: any) => console.error('Failed to watch seeds', e)
            }
        );

        // ... (rest of watch remains same)
        return () => abortController.abort();
    }, [farmId]);

    const addPlantingLog = async (params: {
        fieldId: string;
        seedId: string;
        population: number;
        depth: number;
        notes?: string;
        plantedAt?: string;
        replacesLogId?: string;
        voidReason?: string;
    }) => {
        try {
            // 0. If replacing, void the old one first
            if (params.replacesLogId) {
                await voidPlantingLog(params.replacesLogId, params.voidReason || 'Replaced by correction');
            }

            // No automated inventory deduction (Phase 1 req)
            const id = await insertFarmRow('planting_logs', {
                field_id: params.fieldId,
                seed_id: params.seedId,
                population: params.population,
                depth: params.depth,
                planted_at: params.plantedAt || new Date().toISOString(),
                replaces_log_id: params.replacesLogId || null,
                // Keep deprecated fields for now to avoid breaking strictly typed legacy views if any, 
                // but aim to null them or match planted_at
                start_time: params.plantedAt || new Date().toISOString(),
                end_time: null,
                notes: params.notes || null,
            });

            return id;
        } catch (error) {
            console.error('Failed to add planting log', error);
            throw error;
        }
    };

    const voidPlantingLog = async (id: string, reason: string) => {
        try {
            await updateFarmRow('planting_logs', id, {
                voided_at: new Date().toISOString(),
                void_reason: reason
            });
        } catch (error) {
            console.error('Failed to void planting log', error);
            throw error;
        }
    };

    const addSeed = async (seed: Omit<SeedVariety, 'id'>) => {
        await insertFarmRow('seed_varieties', {
            brand: seed.brand,
            variety_name: seed.variety_name,
            type: seed.type,
            default_population: seed.default_population
        });
    };

    const updateSeed = async (id: string, seed: Partial<SeedVariety>) => {
        try {
            await updateFarmRow('seed_varieties', id, {
                brand: seed.brand,
                variety_name: seed.variety_name,
                type: seed.type,
                default_population: seed.default_population
            });
        } catch (error) {
            console.error('Failed to update seed', error);
            throw error;
        }
    };

    const deleteSeed = async (id: string) => {
        try {
            await deleteFarmRow('seed_varieties', id);
        } catch (error) {
            console.error('Failed to delete seed', error);
            throw error;
        }
    };

    const deletePlantingLog = async (id: string) => {
        try {
            await deleteFarmRow('planting_logs', id);
        } catch (error) {
            console.error('Failed to delete planting log', error);
            throw error;
        }
    };

    const getLastPopulation = async (fieldId: string, seedId: string): Promise<number | null> => {
        try {
            // 1. Check Field History (Specific to this field) - EXCLUDE VOIDED
            const fieldLog = await db.execute(
                'SELECT population FROM planting_logs WHERE farm_id = ? AND field_id = ? AND voided_at IS NULL ORDER BY planted_at DESC LIMIT 1',
                [farmId, fieldId]
            );
            if (fieldLog.rows?._array?.length > 0) {
                return fieldLog.rows._array[0].population;
            }

            // 2. Fallback to Seed History (Last used anywhere on farm) - EXCLUDE VOIDED
            const seedLog = await db.execute(
                'SELECT population FROM planting_logs WHERE farm_id = ? AND seed_id = ? AND voided_at IS NULL ORDER BY planted_at DESC LIMIT 1',
                [farmId, seedId]
            );
            if (seedLog.rows?._array?.length > 0) {
                return seedLog.rows._array[0].population;
            }

            return null;
        } catch (error) {
            console.warn('Failed to get last population', error);
            return null;
        }
    };

    return {
        seeds,
        plantingLogs,
        loading,
        addPlantingLog,
        addSeed,
        updateSeed,
        deleteSeed,
        deletePlantingLog,
        getLastPopulation,
        voidPlantingLog
    };
};
