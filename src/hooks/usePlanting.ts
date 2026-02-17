import { useState, useEffect } from 'react';
import { db } from '../db/powersync';
import { v4 as uuidv4 } from 'uuid';

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

    useEffect(() => {
        const abortController = new AbortController();

        // Watch seeds
        db.watch(
            'SELECT * FROM seed_varieties',
            [],
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
             ORDER BY pl.start_time DESC`,
            [],
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
    }, []);

    const addPlantingLog = async (params: {
        fieldId: string;
        seedId: string;
        population: number;
        depth: number;
        notes?: string;
    }) => {
        try {
            const id = uuidv4();
            const now = new Date().toISOString();

            // 1. Insert the log
            await db.execute(
                'INSERT INTO planting_logs (id, field_id, seed_id, population, depth, start_time, end_time, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [id, params.fieldId, params.seedId, params.population, params.depth, now, now, params.notes || null, now]
            );

            // 2. Passive Inventory Update
            const seedResult = await db.execute('SELECT brand, variety_name FROM seed_varieties WHERE id = ?', [params.seedId]);
            const seed = seedResult.rows?._array[0];
            const fieldResult = await db.execute('SELECT acreage FROM fields WHERE id = ?', [params.fieldId]);
            const acreage = fieldResult.rows?._array[0]?.acreage || 0;

            if (seed) {
                const productName = `${seed.brand} ${seed.variety_name}`;
                const totalUsage = (params.population * acreage) / 80000;

                const invResult = await db.execute('SELECT quantity_on_hand FROM inventory WHERE product_name = ?', [productName]);
                const currentQty = invResult.rows?._array[0]?.quantity_on_hand || 0;
                const newQty = currentQty - totalUsage;

                await db.execute(
                    'INSERT OR REPLACE INTO inventory (id, product_name, quantity_on_hand, unit) VALUES ((SELECT id FROM inventory WHERE product_name = ?), ?, ?, ?)',
                    [productName, productName, newQty, 'Units']
                );
            }
            return id;
        } catch (error) {
            console.error('Failed to add planting log', error);
            throw error;
        }
    };

    const addSeed = async (seed: Omit<SeedVariety, 'id'>) => {
        const id = uuidv4();
        await db.execute(
            'INSERT INTO seed_varieties (id, brand, variety_name, type, default_population) VALUES (?, ?, ?, ?, ?)',
            [id, seed.brand, seed.variety_name, seed.type, seed.default_population]
        );
    };

    const updateSeed = async (id: string, seed: Partial<SeedVariety>) => {
        await db.execute(
            'UPDATE seed_varieties SET brand = ?, variety_name = ?, type = ?, default_population = ? WHERE id = ?',
            [seed.brand, seed.variety_name, seed.type, seed.default_population, id]
        );
    };

    const deleteSeed = async (id: string) => {
        await db.execute('DELETE FROM seed_varieties WHERE id = ?', [id]);
    };

    return {
        seeds,
        plantingLogs,
        loading,
        addPlantingLog,
        addSeed,
        updateSeed,
        deleteSeed
    };
};
