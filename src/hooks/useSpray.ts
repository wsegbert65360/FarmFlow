import { useState, useEffect, useMemo } from 'react';
import { db } from '../db/powersync';
import { v4 as uuidv4 } from 'uuid';
import { recordAudit } from '../utils/DatabaseUtility';
import { useSettings } from './useSettings';

export interface RecipeItem {
    id: string;
    recipe_id: string;
    product_name: string;
    epa_number: string;
    rate: number;
    unit: string;
}

export interface Recipe {
    id: string;
    name: string;
    water_rate_per_acre: number;
    phi_days: number;
    rei_hours: number;
    items?: RecipeItem[];
    // Legacy support fields for backward compatibility
    product_name?: string;
    rate_per_acre?: number;
    epa_number?: string;
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
    const { settings } = useSettings();
    const farmId = settings?.farm_id || 'default_farm';

    useEffect(() => {
        const abortController = new AbortController();

        // Watch recipes with items joined
        db.watch(
            `SELECT r.*, 
                    ri.id as item_id, ri.product_name as item_product_name, 
                    ri.epa_number as item_epa_number, ri.rate as item_rate, ri.unit as item_unit
             FROM recipes r 
             LEFT JOIN recipe_items ri ON r.id = ri.recipe_id
             WHERE r.farm_id = ?`,
            [farmId],
            {
                onResult: (result) => {
                    const rows = result.rows?._array || [];
                    const recipeMap: Record<string, Recipe> = {};

                    rows.forEach((row: any) => {
                        if (!recipeMap[row.id]) {
                            recipeMap[row.id] = {
                                id: row.id,
                                name: row.name,
                                water_rate_per_acre: row.water_rate_per_acre,
                                phi_days: row.phi_days,
                                rei_hours: row.rei_hours,
                                items: []
                            };
                        }

                        if (row.item_id) {
                            recipeMap[row.id].items!.push({
                                id: row.item_id,
                                recipe_id: row.id,
                                product_name: row.item_product_name,
                                epa_number: row.item_epa_number,
                                rate: row.item_rate,
                                unit: row.item_unit
                            });
                        }
                    });

                    setRecipes(Object.values(recipeMap));
                },
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
             WHERE sl.farm_id = ?
             ORDER BY sl.start_time DESC`,
            [farmId],
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
    }, [farmId]);

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

            // 1. Insert the log
            await db.execute(
                `INSERT INTO spray_logs (
                    id, field_id, recipe_id, start_time, end_time, 
                    total_gallons, total_product, 
                    weather_temp, weather_wind_speed, weather_wind_dir, weather_humidity,
                    target_crop, target_pest, applicator_name, applicator_cert, acres_treated,
                    phi_days, rei_hours,
                    notes,
                    farm_id,
                    created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    id, params.fieldId, params.recipeId, startTime, endTime,
                    params.totalGallons, params.totalProduct,
                    params.weather?.temp ?? null,
                    params.weather?.windSpeed ?? null,
                    params.weather?.windDir ?? null,
                    params.weather?.humidity ?? null,
                    targetCrop || null,
                    targetPest || null,
                    applicatorName || null,
                    applicatorCert || null,
                    acresTreated || null,
                    phi_days || null,
                    rei_hours || null,
                    params.notes || null,
                    farmId,
                    now.toISOString()
                ]
            );

            // 2. Passive Inventory Update for MULTIPLE products
            const selectedRecipe = recipes.find(r => r.id === params.recipeId);
            if (selectedRecipe?.items && selectedRecipe.items.length > 0) {
                for (const item of selectedRecipe.items) {
                    const productName = item.product_name;
                    // We need to handle unit conversion here eventually. 
                    // For now, assuming inventory and rate use same unit or simple subtraction.
                    // rate is usually per acre. totalProduct = rate * acreage.
                    const itemUsage = item.rate * (acresTreated || 0);

                    const invResult = await db.execute('SELECT id, quantity_on_hand FROM inventory WHERE product_name = ? AND farm_id = ?', [productName, farmId]);
                    const existing = invResult.rows?._array[0];

                    if (existing) {
                        const newQty = (existing.quantity_on_hand || 0) - itemUsage;
                        await db.execute(
                            'UPDATE inventory SET quantity_on_hand = ? WHERE id = ?',
                            [newQty, existing.id]
                        );
                    } else {
                        const newId = uuidv4();
                        const newQty = -itemUsage;
                        await db.execute(
                            'INSERT INTO inventory (id, product_name, quantity_on_hand, unit, farm_id, created_at) VALUES (?, ?, ?, ?, ?, ?)',
                            [newId, productName, newQty, item.unit, farmId, new Date().toISOString()]
                        );
                    }
                }
            } else if (selectedRecipe?.product_name) {
                // FALLBACK for legacy recipes
                const productName = selectedRecipe.product_name;
                const invResult = await db.execute('SELECT id, quantity_on_hand FROM inventory WHERE product_name = ? AND farm_id = ?', [productName, farmId]);
                const existing = invResult.rows?._array[0];
                if (existing) {
                    const newQty = (existing.quantity_on_hand || 0) - params.totalProduct;
                    await db.execute('UPDATE inventory SET quantity_on_hand = ? WHERE id = ?', [newQty, existing.id]);
                }
            }

            await recordAudit({
                action: 'INSERT',
                tableName: 'spray_logs',
                recordId: id,
                farmId: farmId,
                changes: params
            });

            return id;
        } catch (error) {
            console.error('Failed to add spray log', error);
            throw error;
        }
    };

    const addRecipe = async (recipe: Omit<Recipe, 'id'>) => {
        const id = uuidv4();
        const now = new Date().toISOString();

        await db.execute(
            'INSERT INTO recipes (id, name, water_rate_per_acre, phi_days, rei_hours, farm_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [id, recipe.name, recipe.water_rate_per_acre, recipe.phi_days, recipe.rei_hours, farmId, now]
        );

        if (recipe.items && recipe.items.length > 0) {
            for (const item of recipe.items) {
                const itemId = uuidv4();
                await db.execute(
                    'INSERT INTO recipe_items (id, recipe_id, product_name, epa_number, rate, unit, farm_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                    [itemId, id, item.product_name, item.epa_number, item.rate, item.unit, farmId, now]
                );
            }
        }

        await recordAudit({ action: 'INSERT', tableName: 'recipes', recordId: id, farmId: farmId, changes: recipe });
    };

    const updateRecipe = async (id: string, recipe: Partial<Recipe>) => {
        const now = new Date().toISOString();

        await db.execute(
            'UPDATE recipes SET name = ?, water_rate_per_acre = ?, phi_days = ?, rei_hours = ? WHERE id = ? AND farm_id = ?',
            [recipe.name, recipe.water_rate_per_acre, recipe.phi_days, recipe.rei_hours, id, farmId]
        );

        if (recipe.items) {
            // Re-sync items: delete and re-insert for simplicity
            await db.execute('DELETE FROM recipe_items WHERE recipe_id = ? AND farm_id = ?', [id, farmId]);
            for (const item of recipe.items) {
                const itemId = uuidv4();
                await db.execute(
                    'INSERT INTO recipe_items (id, recipe_id, product_name, epa_number, rate, unit, farm_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                    [itemId, id, item.product_name, item.epa_number, item.rate, item.unit, farmId, now]
                );
            }
        }

        await recordAudit({ action: 'UPDATE', tableName: 'recipes', recordId: id, farmId: farmId, changes: recipe });
    };

    const deleteRecipe = async (id: string) => {
        await db.execute('DELETE FROM recipes WHERE id = ? AND farm_id = ?', [id, farmId]);
        await db.execute('DELETE FROM recipe_items WHERE recipe_id = ? AND farm_id = ?', [id, farmId]);
        await recordAudit({ action: 'DELETE', tableName: 'recipes', recordId: id, farmId: farmId, changes: { id } });
    };

    const deleteSprayLog = async (id: string) => {
        await db.execute('DELETE FROM spray_logs WHERE id = ? AND farm_id = ?', [id, farmId]);
        await recordAudit({ action: 'DELETE', tableName: 'spray_logs', recordId: id, farmId: farmId, changes: { id } });
    };

    return {
        recipes,
        sprayLogs,
        loading,
        addSprayLog,
        addRecipe,
        updateRecipe,
        deleteRecipe,
        deleteSprayLog
    };
};
