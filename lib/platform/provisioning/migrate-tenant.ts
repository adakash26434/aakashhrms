import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import path from 'path';
import * as schema from '../../db/schema';

import { ensureTenantSchema } from '../../db/tenant-schema-sync';

/**
 * Executes all Drizzle migration SQL files against the target tenant database connection.
 */
export async function migrateTenantDatabase(connectionUrl: string): Promise<void> {
  const sql = postgres(connectionUrl, { max: 1 });
  const tenantDb = drizzle(sql, { schema });

  try {
    // 1. Ensure enum values exist before running migration transactions
    await ensureTenantSchema(sql);

    // 2. Run Drizzle migrations
    const migrationsFolder = path.resolve(process.cwd(), 'lib/db/migrations');
    await migrate(tenantDb, { migrationsFolder });

    // 3. Ensure all columns are in place after migration
    await ensureTenantSchema(sql);
  } finally {
    await sql.end();
  }
}
