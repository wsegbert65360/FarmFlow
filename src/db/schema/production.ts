import { Table, Column, ColumnType, Index } from '@powersync/common';

export const ProductionTables = {
    recipes: new Table({
        name: 'recipes',
        columns: [
            new Column({ name: 'id', type: ColumnType.TEXT }),
            new Column({ name: 'name', type: ColumnType.TEXT }),
            new Column({ name: 'product_name', type: ColumnType.TEXT }),
            new Column({ name: 'epa_number', type: ColumnType.TEXT }),
            new Column({ name: 'rate_per_acre', type: ColumnType.REAL }),
            new Column({ name: 'water_rate_per_acre', type: ColumnType.REAL }),
            new Column({ name: 'phi_days', type: ColumnType.INTEGER }),
            new Column({ name: 'rei_hours', type: ColumnType.INTEGER }),
            new Column({ name: 'farm_id', type: ColumnType.TEXT }),
            new Column({ name: 'created_at', type: ColumnType.TEXT }),
        ],
        indexes: [
            Index.createAscending({ name: 'idx_recipes_farm_id' }, ['farm_id'])
        ]
    }),
    recipe_items: new Table({
        name: 'recipe_items',
        columns: [
            new Column({ name: 'id', type: ColumnType.TEXT }),
            new Column({ name: 'recipe_id', type: ColumnType.TEXT }),
            new Column({ name: 'product_name', type: ColumnType.TEXT }),
            new Column({ name: 'epa_number', type: ColumnType.TEXT }),
            new Column({ name: 'rate', type: ColumnType.REAL }),
            new Column({ name: 'unit', type: ColumnType.TEXT }),
            new Column({ name: 'farm_id', type: ColumnType.TEXT }),
            new Column({ name: 'created_at', type: ColumnType.TEXT }),
        ],
        indexes: [
            Index.createAscending({ name: 'idx_recipe_items_recipe_id' }, ['recipe_id']),
            Index.createAscending({ name: 'idx_recipe_items_farm_id' }, ['farm_id'])
        ]
    }),
    seed_varieties: new Table({
        name: 'seed_varieties',
        columns: [
            new Column({ name: 'id', type: ColumnType.TEXT }),
            new Column({ name: 'brand', type: ColumnType.TEXT }),
            new Column({ name: 'variety_name', type: ColumnType.TEXT }),
            new Column({ name: 'type', type: ColumnType.TEXT }),
            new Column({ name: 'default_population', type: ColumnType.REAL }),
            new Column({ name: 'farm_id', type: ColumnType.TEXT }),
            new Column({ name: 'created_at', type: ColumnType.TEXT }),
        ],
        indexes: [
            Index.createAscending({ name: 'idx_seed_varieties_farm_id' }, ['farm_id'])
        ]
    }),
};
