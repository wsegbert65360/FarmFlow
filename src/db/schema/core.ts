import { Table, Column, ColumnType, Index } from '@powersync/common';

export const CoreTables = {
    farms: new Table({
        name: 'farms',
        columns: [
            new Column({ name: 'id', type: ColumnType.TEXT }),
            new Column({ name: 'name', type: ColumnType.TEXT }),
            new Column({ name: 'owner_id', type: ColumnType.TEXT }),
            new Column({ name: 'created_at', type: ColumnType.TEXT }),
        ],
    }),
    farm_members: new Table({
        name: 'farm_members',
        columns: [
            new Column({ name: 'id', type: ColumnType.TEXT }),
            new Column({ name: 'user_id', type: ColumnType.TEXT }),
            new Column({ name: 'farm_id', type: ColumnType.TEXT }),
            new Column({ name: 'role', type: ColumnType.TEXT }),
            new Column({ name: 'created_at', type: ColumnType.TEXT }),
        ],
        indexes: [
            Index.createAscending({ name: 'idx_farm_members_farm_id' }, ['farm_id'])
        ]
    }),
    invites: new Table({
        name: 'invites',
        columns: [
            new Column({ name: 'id', type: ColumnType.TEXT }),
            new Column({ name: 'farm_id', type: ColumnType.TEXT }),
            new Column({ name: 'token', type: ColumnType.TEXT }),
            new Column({ name: 'role', type: ColumnType.TEXT }),
            new Column({ name: 'expires_at', type: ColumnType.TEXT }),
            new Column({ name: 'created_at', type: ColumnType.TEXT }),
        ],
        indexes: [
            Index.createAscending({ name: 'idx_invites_farm_id' }, ['farm_id'])
        ]
    }),
    settings: new Table({
        name: 'settings',
        columns: [
            new Column({ name: 'id', type: ColumnType.TEXT }),
            new Column({ name: 'farm_name', type: ColumnType.TEXT }),
            new Column({ name: 'state', type: ColumnType.TEXT }),
            new Column({ name: 'units', type: ColumnType.TEXT }),
            new Column({ name: 'onboarding_completed', type: ColumnType.INTEGER }),
            new Column({ name: 'default_applicator_name', type: ColumnType.TEXT }),
            new Column({ name: 'default_applicator_cert', type: ColumnType.TEXT }),
            new Column({ name: 'farm_id', type: ColumnType.TEXT }),
            new Column({ name: 'supabase_anon_key', type: ColumnType.TEXT }),
            new Column({ name: 'farm_join_token', type: ColumnType.TEXT }),
            new Column({ name: 'updated_at', type: ColumnType.TEXT }),
        ],
    }),
};
