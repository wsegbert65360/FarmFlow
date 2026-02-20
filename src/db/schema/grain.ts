import { Table, Column, ColumnType } from '@powersync/common';

export const GrainTables = {
    bins: new Table({
        name: 'bins',
        columns: [
            new Column({ name: 'id', type: ColumnType.TEXT }),
            new Column({ name: 'name', type: ColumnType.TEXT }),
            new Column({ name: 'capacity', type: ColumnType.REAL }),
            new Column({ name: 'crop_type', type: ColumnType.TEXT }),
            new Column({ name: 'landlord_id', type: ColumnType.TEXT }),
            new Column({ name: 'landlord_share_pct', type: ColumnType.REAL }),
            new Column({ name: 'farm_id', type: ColumnType.TEXT }),
            new Column({ name: 'created_at', type: ColumnType.TEXT }),
        ],
    }),
    grain_lots: new Table({
        name: 'grain_lots',
        columns: [
            new Column({ name: 'id', type: ColumnType.TEXT }),
            new Column({ name: 'farm_id', type: ColumnType.TEXT }),
            new Column({ name: 'crop_type', type: ColumnType.TEXT }),
            new Column({ name: 'crop_year', type: ColumnType.INTEGER }),
            new Column({ name: 'source_field_id', type: ColumnType.TEXT }),
            new Column({ name: 'created_at', type: ColumnType.TEXT }),
            new Column({ name: 'updated_at', type: ColumnType.TEXT }),
        ],
    }),
    lot_movements: new Table({
        name: 'lot_movements',
        columns: [
            new Column({ name: 'id', type: ColumnType.TEXT }),
            new Column({ name: 'farm_id', type: ColumnType.TEXT }),
            new Column({ name: 'lot_id', type: ColumnType.TEXT }),
            new Column({ name: 'movement_type', type: ColumnType.TEXT }),
            new Column({ name: 'bin_id', type: ColumnType.TEXT }),
            new Column({ name: 'destination_name', type: ColumnType.TEXT }),
            new Column({ name: 'bushels_net', type: ColumnType.REAL }),
            new Column({ name: 'moisture', type: ColumnType.REAL }),
            new Column({ name: 'test_weight', type: ColumnType.REAL }),
            new Column({ name: 'occurred_at', type: ColumnType.TEXT }),
            new Column({ name: 'note', type: ColumnType.TEXT }),
            new Column({ name: 'source_grain_log_id', type: ColumnType.TEXT }),
            new Column({ name: 'created_at', type: ColumnType.TEXT }),
            new Column({ name: 'updated_at', type: ColumnType.TEXT }),
            new Column({ name: 'status', type: ColumnType.TEXT }),
            new Column({ name: 'movement_token', type: ColumnType.TEXT }),
        ],
    }),
};
