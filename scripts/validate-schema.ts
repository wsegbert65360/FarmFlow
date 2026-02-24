import fs from 'fs';
import path from 'path';

/**
 * safeReadFileSync - guard against attempting to read directories which would
 * cause EISDIR. Throws a helpful error if the path is not a file.
 */
function safeReadFileSync(filePath: string, encoding: BufferEncoding | null = 'utf8'): string {
    try {
        const st = fs.statSync(filePath);
        if (!st.isFile()) {
            throw new Error(`[safeReadFileSync] Path is not a file: ${filePath}`);
        }
    } catch (err: any) {
        if (err && err.code === 'ENOENT') {
            throw new Error(`[safeReadFileSync] File not found: ${filePath}`);
        }
        throw err;
    }
    const raw = fs.readFileSync(filePath, encoding as any);
    return (raw as unknown) as string;
}
import { AppSchema } from '../src/db/schema/index';

/**
 * Migration Validator
 * Ensures that the Supabase migration SQL matches the PowerSync TypeScript schema.
 */

async function validateSchema() {
    console.log('--- Database Schema Validation ---');

    const migrationPath = path.join(__dirname, '../supabase/migrations/20240215_complete_schema.sql');
    const sql = safeReadFileSync(migrationPath, 'utf8').toLowerCase();

    let hasErrors = false;
    const tables = AppSchema.tables;

    console.log(`Validating ${tables.length} tables...`);

    for (const table of tables) {
        // 1. Check if table exists in SQL
        if (!sql.includes(`create table if not exists ${table.name}`) &&
            !sql.includes(`create table ${table.name}`)) {
            console.error(`❌ Missing Table: ${table.name}`);
            hasErrors = true;
            continue;
        }

        // 2. Check if all columns exist
        for (const column of table.columns) {
            // Very basic regex-like check for column presence in the CREATE TABLE block
            // A more robust solution would use a SQL parser
            const columnPattern = new RegExp(`${column.name}\\s+([a-z]+)`, 'i');
            if (!columnPattern.test(sql)) {
                console.error(`❌ Table [${table.name}]: Missing Column [${column.name}]`);
                hasErrors = true;
            }
        }

        // 3. Check for RLS policy
        if (!sql.includes(`enable row level security`) || !sql.includes(`on ${table.name}`)) {
            // Basic check - we want to see "ON tablename" in the policy section
            if (!sql.includes(`on ${table.name}`)) {
                console.warn(`⚠️ Table [${table.name}]: Potential Missing RLS Policy`);
            }
        }
    }

    if (hasErrors) {
        process.exit(1);
    } else {
        console.log('✅ Schema validation passed!');
    }
}

validateSchema().catch(err => {
    console.error('Validation failed:', err);
    process.exit(1);
});
