import { useState, useEffect } from 'react';
import { db } from '../db/powersync';
import { recordAudit } from '../utils/DatabaseUtility';
import { useDatabase } from './useDatabase';
import { v4 as uuidv4 } from 'uuid';
import { Recipe, SprayLog } from '../types/spray';
import { SprayUtility } from '../utils/SprayUtility';

export const useSpray = () => {
    const [recipes, setRecipes] = useState<Recipe[]>([]);
    const [sprayLogs, setSprayLogs] = useState<SprayLog[]>([]);
    const [loading, setLoading] = useState(true);
    const { farmId, watchFarmQuery, insertFarmRow, bulkInsertFarmRows, updateFarmRow, deleteFarmRow } = useDatabase();

    useEffect(() => {
        if (!farmId) return;
        const abortController = new AbortController();

        // Watch recipes with items joined
        const unsubRecipes = watchFarmQuery(
            `SELECT r.*, 
                    ri.id as item_id, ri.product_name as item_product_name, 
                    ri.epa_number as item_epa_number, ri.rate as item_rate, ri.unit as item_unit
             FROM recipes r 
             LEFT JOIN recipe_items ri ON r.id = ri.recipe_id
             WHERE r.farm_id = ?`,
            [farmId],
            {
                onResult: (result: any) => {
                    const rows = result.rows?._array || [];
                    const transformed = SprayUtility.transformRecipeRows(rows);
                    setRecipes(prev => {
                        if (JSON.stringify(prev) === JSON.stringify(transformed)) return prev;
                        return transformed;
                    });
                },
                onError: (e: any) => console.error('Failed to watch recipes', e)
            }
        );

        // Watch spray logs with items joined
        const unsubLogs = watchFarmQuery(
            `SELECT sl.*, sli.id as item_id, sli.product_name as item_product_name, 
                    sli.epa_number as item_epa_number, sli.rate as item_rate, sli.rate_unit as item_unit,
                    sli.total_amount as item_total_amount, sli.total_unit as item_total_unit
             FROM spray_logs sl 
             LEFT JOIN spray_log_items sli ON sl.id = sli.spray_log_id
             WHERE sl.farm_id = ?
             ORDER BY sl.sprayed_at DESC`,
            [farmId],
            {
                onResult: (result: any) => {
                    const rows = result.rows?._array || [];
                    const transformed = SprayUtility.transformSprayLogRows(rows);
                    setSprayLogs(prev => {
                        if (JSON.stringify(prev) === JSON.stringify(transformed)) return prev;
                        return transformed;
                    });
                    setLoading(false);
                },
                onError: (e: any) => console.error('Failed to watch spray logs', e)
            }
        );

        return () => {
            abortController.abort();
            unsubRecipes();
            unsubLogs();
        };
    }, [farmId, watchFarmQuery]);

    const voidSprayLog = async (logId: string, reason: string) => {
        try {
            const now = new Date().toISOString();

            // 1. Mark as voided
            await updateFarmRow('spray_logs', logId, {
                voided_at: now,
                void_reason: reason
            });

            // 2. Add BACK to inventory from snapshot items - DISABLED for Phase 10
            // const snapshotItems = await db.getAll('SELECT * FROM spray_log_items WHERE spray_log_id = ?', [logId]) as any[];
            // if (snapshotItems && snapshotItems.length > 0) {
            //     for (const item of snapshotItems) {
            //         await insertFarmRow('inventory_adjustments', {
            //             id: uuidv4(),
            //             product_name: item.product_name,
            //             amount: item.total_amount, // Positive = addition back to hand
            //             reason: 'LOG_VOIDED',
            //             reference_id: logId
            //         });
            //     }
            // }


        } catch (error) {
            console.error('Failed to void spray log', error);
            throw error;
        }
    };

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
        weatherSource?: 'AUTO' | 'MANUAL';
        targetCrop?: string;
        targetPest?: string;
        applicatorName?: string;
        applicatorCert?: string;
        acresTreated?: number;
        phi_days?: number;
        rei_hours?: number;
        notes?: string;
        sprayedAt?: string;
        replacesLogId?: string;
        voidReason?: string;
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
                replacesLogId,
                voidReason
            } = params;

            // 0. If replacing an old log, void it first
            if (replacesLogId) {
                await voidSprayLog(replacesLogId, voidReason || 'Replaced by correction');
            }

            const sprayedAt = params.sprayedAt || new Date().toISOString();

            // 1. Insert the log using the audit-ready model
            await insertFarmRow('spray_logs', {
                id,
                field_id: params.fieldId,
                recipe_id: params.recipeId,
                sprayed_at: sprayedAt,
                weather_source: params.weatherSource || 'AUTO',
                replaces_log_id: replacesLogId || null,
                total_gallons: params.totalGallons,
                total_product: params.totalProduct,
                weather_temp: params.weather?.temp ?? null,
                weather_wind_speed: params.weather?.windSpeed ?? null,
                weather_wind_dir: params.weather?.windDir ?? null,
                weather_humidity: params.weather?.humidity ?? null,
                target_crop: targetCrop || null,
                target_pest: targetPest || null,
                applicator_name: applicatorName || null,
                applicator_cert: applicatorCert || null,
                acres_treated: acresTreated || null,
                phi_days: phi_days || null,
                rei_hours: rei_hours || null,
                notes: params.notes || null,
            });

            // 2. Snapshot recipe items and update inventory
            const selectedRecipe = recipes.find((r: Recipe) => r.id === params.recipeId);
            if (selectedRecipe?.items && selectedRecipe.items.length > 0) {
                const itemRows = selectedRecipe.items.map(item => ({
                    spray_log_id: id,
                    product_name: item.product_name,
                    epa_number: item.epa_number,
                    rate: item.rate,
                    rate_unit: item.unit,
                    total_amount: (item.rate || 0) * (params.acresTreated || 0),
                    total_unit: item.unit
                }));

                await bulkInsertFarmRows('spray_log_items', itemRows);

                // Audit Adjustment (Deduction) for each item - DISABLED for Phase 10
                // const adjustmentRows = selectedRecipe.items.map(item => ({
                //     id: uuidv4(),
                //     product_name: item.product_name,
                //     amount: -(item.rate * (params.acresTreated || 0)), // Negative because it's a deduction
                //     unit: item.unit,
                //     source_type: 'SPRAY_LOG',
                //     source_id: id,
                //     notes: `App: ${params.applicatorName || 'N/A'}`
                // }));

                // await bulkInsertFarmRows('inventory_adjustments', adjustmentRows);
            } else if (selectedRecipe?.product_name) {
                // FALLBACK for legacy recipes
                const productName = selectedRecipe.product_name;

                await insertFarmRow('spray_log_items', {
                    id: uuidv4(),
                    spray_log_id: id,
                    product_name: productName,
                    epa_number: selectedRecipe.epa_number,
                    rate: selectedRecipe.rate_per_acre || 0,
                    rate_unit: 'Gal',
                    total_amount: params.totalProduct,
                    total_unit: 'Gal'
                });

                // await insertFarmRow('inventory_adjustments', {
                //     id: uuidv4(),
                //     product_name: productName,
                //     amount: -params.totalProduct, // Negative = deduction
                //     reason: replacesLogId ? 'LOG_CORRECTION' : 'LOG_CREATED',
                //     reference_id: id
                // });
            }

            return id;
        } catch (error) {
            console.error('Failed to add spray log', error);
            throw error;
        }
    };

    const addRecipe = async (recipe: Omit<Recipe, 'id'>) => {
        const id = await insertFarmRow('recipes', {
            name: recipe.name,
            water_rate_per_acre: recipe.water_rate_per_acre,
            phi_days: recipe.phi_days,
            rei_hours: recipe.rei_hours
        });

        if (recipe.items && recipe.items.length > 0) {
            for (const item of recipe.items) {
                await insertFarmRow('recipe_items', {
                    recipe_id: id,
                    product_name: item.product_name,
                    epa_number: item.epa_number,
                    rate: item.rate,
                    unit: item.unit
                });
            }
        }
    };

    const updateRecipe = async (id: string, recipe: Partial<Recipe>) => {
        try {
            await updateFarmRow('recipes', id, {
                name: recipe.name,
                water_rate_per_acre: recipe.water_rate_per_acre,
                phi_days: recipe.phi_days,
                rei_hours: recipe.rei_hours
            });

            if (recipe.items) {
                // Re-sync items: delete and re-insert for simplicity
                // Note: recipe_items table also has farm_id, so we use deleteFarmRow if we wanted to be super safe, 
                // but usually they are wiped by ID prefix.
                await db.execute('DELETE FROM recipe_items WHERE recipe_id = ? AND farm_id = ?', [id, farmId]);
                for (const item of recipe.items) {
                    await insertFarmRow('recipe_items', {
                        recipe_id: id,
                        product_name: item.product_name,
                        epa_number: item.epa_number,
                        rate: item.rate,
                        unit: item.unit
                    });
                }
            }
        } catch (error) {
            console.error('Failed to update recipe', error);
            throw error;
        }
    };

    const deleteRecipe = async (id: string) => {
        try {
            await deleteFarmRow('recipes', id);
            await db.execute('DELETE FROM recipe_items WHERE recipe_id = ? AND farm_id = ?', [id, farmId]);
        } catch (error) {
            console.error('Failed to delete recipe', error);
            throw error;
        }
    };

    const deleteSprayLog = async (id: string) => {
        try {
            if (!farmId) throw new Error('[useSpray] Cannot delete spray log without active farm context.');

            await db.writeTransaction(async (tx: any) => {
                // Remove any snapshot items first
                await tx.execute('DELETE FROM spray_log_items WHERE spray_log_id = ? AND farm_id = ?', [id, farmId]);
                // Remove the log itself
                await tx.execute('DELETE FROM spray_logs WHERE id = ? AND farm_id = ?', [id, farmId]);

                // Record an audit row for the deletion
                try {
                    await recordAudit({
                        action: 'DELETE',
                        tableName: 'spray_logs',
                        recordId: id,
                        farmId,
                        changes: { id }
                    }, tx);
                } catch (e) {
                    // Audit failures should not block the delete, but log them
                    console.warn('[useSpray] audit failed for deleteSprayLog', e);
                }
            });
        } catch (error) {
            console.error('Failed to delete spray log', error);
            throw error;
        }
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
