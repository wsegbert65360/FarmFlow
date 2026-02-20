import { Table, Column, ColumnType } from '@powersync/common';

export const SystemTables = {
    attachments: new Table({
        name: 'attachments',
        columns: [
            new Column({ name: 'id', type: ColumnType.TEXT }),
            new Column({ name: 'filename', type: ColumnType.TEXT }),
            new Column({ name: 'type', type: ColumnType.TEXT }),
            new Column({ name: 'size', type: ColumnType.INTEGER }),
            new Column({ name: 'hash', type: ColumnType.TEXT }),
            new Column({ name: 'owner_record_id', type: ColumnType.TEXT }),
            new Column({ name: 'local_path', type: ColumnType.TEXT }),
            new Column({ name: 'remote_url', type: ColumnType.TEXT }),
            new Column({ name: 'status', type: ColumnType.TEXT }),
            new Column({ name: 'farm_id', type: ColumnType.TEXT }),
            new Column({ name: 'created_at', type: ColumnType.TEXT }),
        ],
    }),
    audit_logs: new Table({
        name: 'audit_logs',
        columns: [
            new Column({ name: 'id', type: ColumnType.TEXT }),
            new Column({ name: 'action', type: ColumnType.TEXT }),
            new Column({ name: 'table_name', type: ColumnType.TEXT }),
            new Column({ name: 'record_id', type: ColumnType.TEXT }),
            new Column({ name: 'changed_by', type: ColumnType.TEXT }),
            new Column({ name: 'changes', type: ColumnType.TEXT }),
            new Column({ name: 'farm_id', type: ColumnType.TEXT }),
            new Column({ name: 'created_at', type: ColumnType.TEXT }),
        ],
    }),
};
