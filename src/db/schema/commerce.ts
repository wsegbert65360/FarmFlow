import { Table, Column, ColumnType } from '@powersync/common';

export const CommerceTables = {
    contracts: new Table({
        name: 'contracts',
        columns: [
            new Column({ name: 'id', type: ColumnType.TEXT }),
            new Column({ name: 'commodity', type: ColumnType.TEXT }),
            new Column({ name: 'total_bushels', type: ColumnType.REAL }),
            new Column({ name: 'price_per_bushel', type: ColumnType.REAL }),
            new Column({ name: 'delivery_deadline', type: ColumnType.TEXT }),
            new Column({ name: 'destination_name', type: ColumnType.TEXT }),
            new Column({ name: 'farm_id', type: ColumnType.TEXT }),
            new Column({ name: 'created_at', type: ColumnType.TEXT }),
        ],
    }),
    inventory: new Table({
        name: 'inventory',
        columns: [
            new Column({ name: 'id', type: ColumnType.TEXT }),
            new Column({ name: 'product_name', type: ColumnType.TEXT }),
            new Column({ name: 'quantity_on_hand', type: ColumnType.REAL }),
            new Column({ name: 'unit', type: ColumnType.TEXT }),
            new Column({ name: 'farm_id', type: ColumnType.TEXT }),
            new Column({ name: 'created_at', type: ColumnType.TEXT }),
        ],
    }),
};
