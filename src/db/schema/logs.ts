import { Table, Column, ColumnType, Index } from '@powersync/common';

export const LogTables = {
    spray_logs: new Table({
        name: 'spray_logs',
        columns: [
            new Column({ name: 'id', type: ColumnType.TEXT }),
            new Column({ name: 'field_id', type: ColumnType.TEXT }),
            new Column({ name: 'recipe_id', type: ColumnType.TEXT }),
            new Column({ name: 'sprayed_at', type: ColumnType.TEXT }),
            new Column({ name: 'weather_source', type: ColumnType.TEXT }),
            new Column({ name: 'voided_at', type: ColumnType.TEXT }),
            new Column({ name: 'void_reason', type: ColumnType.TEXT }),
            new Column({ name: 'replaces_log_id', type: ColumnType.TEXT }),
            new Column({ name: 'total_gallons', type: ColumnType.REAL }),
            new Column({ name: 'total_product', type: ColumnType.REAL }),
            new Column({ name: 'weather_temp', type: ColumnType.REAL }),
            new Column({ name: 'weather_wind_speed', type: ColumnType.REAL }),
            new Column({ name: 'weather_wind_dir', type: ColumnType.TEXT }),
            new Column({ name: 'weather_humidity', type: ColumnType.REAL }),
            new Column({ name: 'target_crop', type: ColumnType.TEXT }),
            new Column({ name: 'target_pest', type: ColumnType.TEXT }),
            new Column({ name: 'applicator_name', type: ColumnType.TEXT }),
            new Column({ name: 'applicator_cert', type: ColumnType.TEXT }),
            new Column({ name: 'acres_treated', type: ColumnType.REAL }),
            new Column({ name: 'phi_days', type: ColumnType.INTEGER }),
            new Column({ name: 'rei_hours', type: ColumnType.INTEGER }),
            new Column({ name: 'notes', type: ColumnType.TEXT }),
            new Column({ name: 'farm_id', type: ColumnType.TEXT }),
            new Column({ name: 'created_at', type: ColumnType.TEXT }),
            new Column({ name: 'updated_at', type: ColumnType.TEXT }),
            new Column({ name: 'start_time', type: ColumnType.TEXT }),
            new Column({ name: 'end_time', type: ColumnType.TEXT }),
        ],
        indexes: [
            Index.createAscending({ name: 'idx_spray_logs_farm_id' }, ['farm_id']),
            Index.createAscending({ name: 'idx_spray_logs_field_id' }, ['field_id']),
            Index.createAscending({ name: 'idx_spray_logs_sprayed_at' }, ['sprayed_at'])
        ]
    }),
    spray_log_items: new Table({
        name: 'spray_log_items',
        columns: [
            new Column({ name: 'id', type: ColumnType.TEXT }),
            new Column({ name: 'farm_id', type: ColumnType.TEXT }),
            new Column({ name: 'spray_log_id', type: ColumnType.TEXT }),
            new Column({ name: 'product_name', type: ColumnType.TEXT }),
            new Column({ name: 'epa_number', type: ColumnType.TEXT }),
            new Column({ name: 'rate', type: ColumnType.REAL }),
            new Column({ name: 'rate_unit', type: ColumnType.TEXT }),
            new Column({ name: 'total_amount', type: ColumnType.REAL }),
            new Column({ name: 'total_unit', type: ColumnType.TEXT }),
            new Column({ name: 'sort_order', type: ColumnType.INTEGER }),
            new Column({ name: 'created_at', type: ColumnType.TEXT }),
            new Column({ name: 'updated_at', type: ColumnType.TEXT }),
        ],
        indexes: [
            Index.createAscending({ name: 'idx_spray_log_items_log_id' }, ['spray_log_id']),
            Index.createAscending({ name: 'idx_spray_log_items_farm_id' }, ['farm_id'])
        ]
    }),
    planting_logs: new Table({
        name: 'planting_logs',
        columns: [
            new Column({ name: 'id', type: ColumnType.TEXT }),
            new Column({ name: 'field_id', type: ColumnType.TEXT }),
            new Column({ name: 'seed_id', type: ColumnType.TEXT }),
            new Column({ name: 'population', type: ColumnType.REAL }),
            new Column({ name: 'depth', type: ColumnType.REAL }),
            new Column({ name: 'start_time', type: ColumnType.TEXT }),
            new Column({ name: 'end_time', type: ColumnType.TEXT }),
            new Column({ name: 'notes', type: ColumnType.TEXT }),
            new Column({ name: 'farm_id', type: ColumnType.TEXT }),
            new Column({ name: 'voided_at', type: ColumnType.TEXT }),
            new Column({ name: 'void_reason', type: ColumnType.TEXT }),
            new Column({ name: 'replaces_log_id', type: ColumnType.TEXT }),
            new Column({ name: 'planted_at', type: ColumnType.TEXT }),
            new Column({ name: 'created_at', type: ColumnType.TEXT }),
        ],
        indexes: [
            Index.createAscending({ name: 'idx_planting_logs_farm_id' }, ['farm_id']),
            Index.createAscending({ name: 'idx_planting_logs_field_id' }, ['field_id']),
            Index.createAscending({ name: 'idx_planting_logs_planted_at' }, ['planted_at'])
        ]
    }),
    grain_logs: new Table({
        name: 'grain_logs',
        columns: [
            new Column({ name: 'id', type: ColumnType.TEXT }),
            new Column({ name: 'type', type: ColumnType.TEXT }),
            new Column({ name: 'field_id', type: ColumnType.TEXT }),
            new Column({ name: 'bin_id', type: ColumnType.TEXT }),
            new Column({ name: 'destination_type', type: ColumnType.TEXT }),
            new Column({ name: 'destination_name', type: ColumnType.TEXT }),
            new Column({ name: 'contract_id', type: ColumnType.TEXT }),
            new Column({ name: 'bushels_net', type: ColumnType.REAL }),
            new Column({ name: 'moisture', type: ColumnType.REAL }),
            new Column({ name: 'start_time', type: ColumnType.TEXT }),
            new Column({ name: 'end_time', type: ColumnType.TEXT }),
            new Column({ name: 'notes', type: ColumnType.TEXT }),
            new Column({ name: 'farm_id', type: ColumnType.TEXT }),
            new Column({ name: 'created_at', type: ColumnType.TEXT }),
        ],
        indexes: [
            Index.createAscending({ name: 'idx_grain_logs_farm_id' }, ['farm_id']),
            Index.createAscending({ name: 'idx_grain_logs_bin_id' }, ['bin_id']),
            Index.createAscending({ name: 'idx_grain_logs_end_time' }, ['end_time'])
        ]
    }),
    inventory_adjustments: new Table({
        name: 'inventory_adjustments',
        columns: [
            new Column({ name: 'id', type: ColumnType.TEXT }),
            new Column({ name: 'farm_id', type: ColumnType.TEXT }),
            new Column({ name: 'product_name', type: ColumnType.TEXT }),
            new Column({ name: 'amount', type: ColumnType.REAL }),
            new Column({ name: 'reason', type: ColumnType.TEXT }),
            new Column({ name: 'reference_id', type: ColumnType.TEXT }),
            new Column({ name: 'created_at', type: ColumnType.TEXT }),
            new Column({ name: 'updated_at', type: ColumnType.TEXT }),
        ],
        indexes: [
            Index.createAscending({ name: 'idx_inventory_adj_farm_id' }, ['farm_id']),
            Index.createAscending({ name: 'idx_inventory_adj_product' }, ['product_name'])
        ]
    }),
};
