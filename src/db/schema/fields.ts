import { Table, Column, ColumnType } from '@powersync/common';

export const FieldTables = {
    fields: new Table({
        name: 'fields',
        columns: [
            new Column({ name: 'id', type: ColumnType.TEXT }),
            new Column({ name: 'name', type: ColumnType.TEXT }),
            new Column({ name: 'acreage', type: ColumnType.REAL }),
            new Column({ name: 'last_gps_lat', type: ColumnType.REAL }),
            new Column({ name: 'last_gps_long', type: ColumnType.REAL }),
            new Column({ name: 'farm_id', type: ColumnType.TEXT }),
            new Column({ name: 'created_at', type: ColumnType.TEXT }),
        ],
    }),
};
