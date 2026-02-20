import { Table, Column, ColumnType } from '@powersync/common';

export const LandlordTables = {
    landlords: new Table({
        name: 'landlords',
        columns: [
            new Column({ name: 'id', type: ColumnType.TEXT }),
            new Column({ name: 'name', type: ColumnType.TEXT }),
            new Column({ name: 'email', type: ColumnType.TEXT }),
            new Column({ name: 'farm_id', type: ColumnType.TEXT }),
            new Column({ name: 'created_at', type: ColumnType.TEXT }),
        ],
    }),
    landlord_shares: new Table({
        name: 'landlord_shares',
        columns: [
            new Column({ name: 'id', type: ColumnType.TEXT }),
            new Column({ name: 'field_id', type: ColumnType.TEXT }),
            new Column({ name: 'landlord_id', type: ColumnType.TEXT }),
            new Column({ name: 'share_percentage', type: ColumnType.REAL }),
            new Column({ name: 'farm_id', type: ColumnType.TEXT }),
            new Column({ name: 'created_at', type: ColumnType.TEXT }),
        ],
    }),
    rent_agreements: new Table({
        name: 'rent_agreements',
        columns: [
            new Column({ name: 'id', type: ColumnType.TEXT }),
            new Column({ name: 'farm_id', type: ColumnType.TEXT }),
            new Column({ name: 'landlord_id', type: ColumnType.TEXT }),
            new Column({ name: 'crop_year', type: ColumnType.INTEGER }),
            new Column({ name: 'rent_type', type: ColumnType.TEXT }),
            new Column({ name: 'landlord_share_pct', type: ColumnType.REAL }),
            new Column({ name: 'cash_rent_per_acre', type: ColumnType.REAL }),
            new Column({ name: 'cash_rent_total', type: ColumnType.REAL }),
            new Column({ name: 'split_basis', type: ColumnType.TEXT }),
            new Column({ name: 'created_at', type: ColumnType.TEXT }),
            new Column({ name: 'updated_at', type: ColumnType.TEXT }),
        ],
    }),
    agreement_fields: new Table({
        name: 'agreement_fields',
        columns: [
            new Column({ name: 'agreement_id', type: ColumnType.TEXT }),
            new Column({ name: 'field_id', type: ColumnType.TEXT }),
            new Column({ name: 'farm_id', type: ColumnType.TEXT }),
        ],
    }),
};
