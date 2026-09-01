import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import path from 'path';
import * as schema from '../../db/schema';

/**
 * Executes all Drizzle migration SQL files against the target tenant database connection.
 */
export async function migrateTenantDatabase(connectionUrl: string): Promise<void> {
  const sql = postgres(connectionUrl, { max: 1 });
  const tenantDb = drizzle(sql, { schema });

  try {
    const migrationsFolder = path.resolve(process.cwd(), 'lib/db/migrations');
    await migrate(tenantDb, { migrationsFolder });
  } finally {
    await sql.end();
  }
}
