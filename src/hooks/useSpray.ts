import { useState, useEffect } from 'react';
import { db } from '../db/powersync';
import { v4 as uuidv4 } from 'uuid';

export interface Recipe {
    id: string;
    name: string;
    product_name: string;
    epa_number: string;
    rate_per_acre: number;
    water_rate_per_acre: number;
    phi_days: number;
    rei_hours: number;
}

export interface SprayLog {
    id: string;
    field_id: string;
    recipe_id: string;
    start_time: string;
    end_time: string | null;
    total_gallons: number | null;
    total_product: number | null;
    weather_temp: number | null;
    weather_wind_speed: number | null;
    weather_wind_dir: string | null;
    weather_humidity: number | null;
    target_crop: string | null;
    target_pest: string | null;
    applicator_name: string | null;
    applicator_cert: string | null;
    acres_treated: number | null;
    phi_days: number | null;
    rei_hours: number | null;
}

export const useSpray = () => {
    const [recipes, setRecipes] = useState<Recipe[]>([]);
    const [sprayLogs, setSprayLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const abortController = new AbortController();

        // Watch recipes
        db.watch(
            'SELECT * FROM recipes',
            [],
            {
                onResult: (result) => setRecipes(result.rows?._array || []),
                onError: (e) => console.error('Failed to watch recipes', e)
            },
            { signal: abortController.signal }
        );

        // Watch spray_logs with joins for reporting
        db.watch(
            `SELECT sl.*, 
                    r.name as recipe_name, r.product_name, r.epa_number, r.rate_per_acre, r.water_rate_per_acre,
                    f.name as field_name, f.acreage as field_acreage
             FROM spray_logs sl
             LEFT JOIN recipes r ON sl.recipe_id = r.id
             LEFT JOIN fields f ON sl.field_id = f.id
             ORDER BY sl.start_time DESC`,
            [],
            {
                onResult: (result) => {
                    setSprayLogs(result.rows?._array || []);
                    setLoading(false);
                },
                onError: (e) => console.error('Failed to watch spray_logs', e)
            },
            { signal: abortController.signal }
        );

        return () => abortController.abort();
    }, []);

    const addSprayLog = async (params: {
        fieldId: string;
        recipeId: string;
        totalGallons: number;
        totalProduct: number;
        weather: {
            temp: number;
            windSpeed: number;
            windDir: string;
            humidity: number;
        } | null;
        targetCrop?: string;
        targetPest?: string;
        applicatorName?: string;
        applicatorCert?: string;
        acresTreated?: number;
        phi_days?: number;
        rei_hours?: number;
        notes?: string;
        id?: string;
    }) => {
        try {
            const id = params.id || uuidv4();
            const {
                targetCrop,
                targetPest,
                applicatorName,
                applicatorCert,
                acresTreated,
                phi_days,
                rei_hours,
            } = params;

            const now = new Date();
            const startTime = now.toISOString();

            // Duration calculation: (acres * 83 seconds) + 10 minutes (600 seconds)
            const durationSeconds = (acresTreated || 0) * 83 + 600;
            const endTime = new Date(now.getTime() + durationSeconds * 1000).toISOString();

            // If total gallons or product are missing, try to calculate from fixedAcreage
            // (Note: LogSessionScreen already does this calculation, this is a safety)

            // 1. Insert the log
            await db.execute(
                `INSERT INTO spray_logs (
                    id, field_id, recipe_id, start_time, end_time, 
                    total_gallons, total_product, 
                    weather_temp, weather_wind_speed, weather_wind_dir, weather_humidity,
                    target_crop, target_pest, applicator_name, applicator_cert, acres_treated,
                    phi_days, rei_hours,
                    notes,
                    created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    id, params.fieldId, params.recipeId, startTime, endTime,
                    params.totalGallons, params.totalProduct,
                    params.weather?.temp || null,
                    params.weather?.windSpeed || null,
                    params.weather?.windDir || null,
                    params.weather?.humidity || null,
                    targetCrop || null,
                    targetPest || null,
                    applicatorName || null,
                    applicatorCert || null,
                    acresTreated || null,
                    phi_days || null,
                    rei_hours || null,
                    params.notes || null,
                    now
                ]
            );

            // 2. Passive Inventory Update
            const recipeResult = await db.execute('SELECT product_name FROM recipes WHERE id = ?', [params.recipeId]);
            const productName = recipeResult.rows?._array[0]?.product_name;

            if (productName) {
                const invResult = await db.execute('SELECT quantity_on_hand FROM inventory WHERE product_name = ?', [productName]);
                const currentQty = invResult.rows?._array[0]?.quantity_on_hand || 0;
                const newQty = currentQty - params.totalProduct;

                await db.execute(
                    'INSERT OR REPLACE INTO inventory (id, product_name, quantity_on_hand, unit) VALUES ((SELECT id FROM inventory WHERE product_name = ?), ?, ?, ?)',
                    [productName, productName, newQty, 'Gal']
                );
            }
            return id;
        } catch (error) {
            console.error('Failed to add spray log', error);
            throw error;
        }
    };

    const addRecipe = async (recipe: Omit<Recipe, 'id'>) => {
        const id = uuidv4();
        await db.execute(
            'INSERT INTO recipes (id, name, product_name, epa_number, rate_per_acre, water_rate_per_acre) VALUES (?, ?, ?, ?, ?, ?)',
            [id, recipe.name, recipe.product_name, recipe.epa_number, recipe.rate_per_acre, recipe.water_rate_per_acre]
        );
    };

    const updateRecipe = async (id: string, recipe: Partial<Recipe>) => {
        await db.execute(
            'UPDATE recipes SET name = ?, product_name = ?, epa_number = ?, rate_per_acre = ?, water_rate_per_acre = ? WHERE id = ?',
            [recipe.name, recipe.product_name, recipe.epa_number, recipe.rate_per_acre, recipe.water_rate_per_acre, id]
        );
    };

    const deleteRecipe = async (id: string) => {
        await db.execute('DELETE FROM recipes WHERE id = ?', [id]);
    };

    return {
        recipes,
        sprayLogs,
        loading,
        addSprayLog,
        addRecipe,
        updateRecipe,
        deleteRecipe
    };
};
