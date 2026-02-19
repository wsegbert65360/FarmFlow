import { useState, useEffect } from 'react';
import { db } from '../db/powersync';
import { v4 as uuidv4 } from 'uuid';
import { useSettings } from './useSettings';
import { recordAudit } from '../utils/DatabaseUtility';

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
    start_time: string;
    end_time: string | null;
}

export const usePlanting = () => {
    const [seeds, setSeeds] = useState<SeedVariety[]>([]);
    const [plantingLogs, setPlantingLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const { settings, loading: settingsLoading } = useSettings();
    const farmId = settings?.farm_id;

    useEffect(() => {
        if (!farmId || settingsLoading) return;
        const abortController = new AbortController();

        // Watch seeds
        db.watch(
            'SELECT * FROM seed_varieties WHERE farm_id = ?',
            [farmId],
            {
                onResult: (result) => setSeeds(result.rows?._array || []),
                onError: (e) => console.error('Failed to watch seeds', e)
            },
            { signal: abortController.signal }
        );

        // Watch planting_logs with joins
        db.watch(
            `SELECT pl.*, sv.brand, sv.variety_name, f.name as field_name 
             FROM planting_logs pl
             LEFT JOIN seed_varieties sv ON pl.seed_id = sv.id
             LEFT JOIN fields f ON pl.field_id = f.id
             WHERE pl.farm_id = ?
             ORDER BY pl.start_time DESC`,
            [farmId],
            {
                onResult: (result) => {
                    setPlantingLogs(result.rows?._array || []);
                    setLoading(false);
                },
                onError: (e) => console.error('Failed to watch planting_logs', e)
            },
            { signal: abortController.signal }
        );

        return () => abortController.abort();
    }, [farmId]);

    const addPlantingLog = async (params: {
        fieldId: string;
        seedId: string;
        population: number;
        depth: number;
        notes?: string;
    }) => {
        if (!farmId) throw new Error('No farm selected');
        try {
            const id = uuidv4();
            const now = new Date().toISOString();

            // 1. Insert the log
            await db.execute(
                'INSERT INTO planting_logs (id, field_id, seed_id, population, depth, start_time, end_time, notes, farm_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [id, params.fieldId, params.seedId, params.population, params.depth, now, now, params.notes || null, farmId, now]
            );

            // 2. Passive Inventory Update
            const seedResult = await db.execute('SELECT brand, variety_name FROM seed_varieties WHERE id = ? AND farm_id = ?', [params.seedId, farmId]);
            const seed = seedResult.rows?._array[0];
            const fieldResult = await db.execute('SELECT acreage FROM fields WHERE id = ? AND farm_id = ?', [params.fieldId, farmId]);
            const acreage = fieldResult.rows?._array[0]?.acreage || 0;

            if (seed) {
                const productName = `${seed.brand} ${seed.variety_name}`;
                const totalUsage = (params.population * acreage) / 80000;

                const invResult = await db.execute('SELECT id, quantity_on_hand FROM inventory WHERE product_name = ? AND farm_id = ?', [productName, farmId]);
                const existing = invResult.rows?._array[0];

                if (existing) {
                    const newQty = (existing.quantity_on_hand || 0) - totalUsage;
                    await db.execute(
                        'UPDATE inventory SET quantity_on_hand = ? WHERE id = ?',
                        [newQty, existing.id]
                    );
                } else {
                    const newId = uuidv4();
                    const newQty = -totalUsage;
                    await db.execute(
                        'INSERT INTO inventory (id, product_name, quantity_on_hand, unit, farm_id, created_at) VALUES (?, ?, ?, ?, ?, ?)',
                        [newId, productName, newQty, 'Units', farmId, new Date().toISOString()]
                    );
                }
            }

            await recordAudit({
                action: 'INSERT',
                tableName: 'planting_logs',
                recordId: id,
                farmId: farmId,
                changes: params
            });

            return id;
        } catch (error) {
            console.error('Failed to add planting log', error);
            throw error;
        }
    };

    const addSeed = async (seed: Omit<SeedVariety, 'id'>) => {
        if (!farmId) throw new Error('No farm selected');
        const id = uuidv4();
        await db.execute(
            'INSERT INTO seed_varieties (id, brand, variety_name, type, default_population, farm_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [id, seed.brand, seed.variety_name, seed.type, seed.default_population, farmId, new Date().toISOString()]
        );
        await recordAudit({ action: 'INSERT', tableName: 'seed_varieties', recordId: id, farmId: farmId, changes: seed });
    };

    const updateSeed = async (id: string, seed: Partial<SeedVariety>) => {
        if (!farmId) throw new Error('No farm selected');
        await db.execute(
            'UPDATE seed_varieties SET brand = ?, variety_name = ?, type = ?, default_population = ? WHERE id = ? AND farm_id = ?',
            [seed.brand, seed.variety_name, seed.type, seed.default_population, id, farmId]
        );
        await recordAudit({ action: 'UPDATE', tableName: 'seed_varieties', recordId: id, farmId: farmId, changes: seed });
    };

    const deleteSeed = async (id: string) => {
        if (!farmId) throw new Error('No farm selected');
        await db.execute('DELETE FROM seed_varieties WHERE id = ? AND farm_id = ?', [id, farmId]);
        await recordAudit({ action: 'DELETE', tableName: 'seed_varieties', recordId: id, farmId: farmId, changes: { id } });
    };

    const deletePlantingLog = async (id: string) => {
        if (!farmId) throw new Error('No farm selected');
        await db.execute('DELETE FROM planting_logs WHERE id = ? AND farm_id = ?', [id, farmId]);
        await recordAudit({ action: 'DELETE', tableName: 'planting_logs', recordId: id, farmId: farmId, changes: { id } });
    };

    return {
        seeds,
        plantingLogs,
        loading,
        addPlantingLog,
        addSeed,
        updateSeed,
        deleteSeed,
        deletePlantingLog
    };
};
