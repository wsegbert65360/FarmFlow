import { Schema } from '@powersync/common';
import { CoreTables } from './core';
import { FieldTables } from './fields';
import { ProductionTables } from './production';
import { LogTables } from './logs';
import { GrainTables } from './grain';
import { LandlordTables } from './landlords';
import { CommerceTables } from './commerce';
import { SystemTables } from './system';

export const AppSchema = new Schema([
    ...Object.values(CoreTables),
    ...Object.values(FieldTables),
    ...Object.values(ProductionTables),
    ...Object.values(LogTables),
    ...Object.values(GrainTables),
    ...Object.values(LandlordTables),
    ...Object.values(CommerceTables),
    ...Object.values(SystemTables),
]);

export * from './core';
export * from './fields';
export * from './production';
export * from './logs';
export * from './grain';
export * from './landlords';
export * from './commerce';
export * from './system';
