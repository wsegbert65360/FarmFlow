import { Recipe, SprayLog } from '../types/spray';

export class SprayUtility {
    static transformRecipeRows(rows: any[]): Recipe[] {
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

        return Object.values(recipeMap);
    }

    static transformSprayLogRows(rows: any[]): SprayLog[] {
        const logMap: Record<string, SprayLog> = {};

        rows.forEach((row: any) => {
            if (!logMap[row.id]) {
                logMap[row.id] = {
                    ...row,
                    items: []
                };
            }
            if (row.item_id) {
                logMap[row.id].items!.push({
                    id: row.item_id,
                    spray_log_id: row.id,
                    product_name: row.item_product_name,
                    epa_number: row.item_epa_number,
                    rate: row.item_rate,
                    unit: row.item_unit,
                    total_amount: row.item_total_amount,
                    total_unit: row.item_total_unit
                });
            }
        });

        return Object.values(logMap);
    }
}
