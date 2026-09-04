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

    // Idempotent column check for users authentication fields
    await sql.unsafe(`
      DO $$
      BEGIN
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
          ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR(255);
          ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0 NOT NULL;
          ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP;
          ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT false NOT NULL;
          ALTER TABLE users ADD COLUMN IF NOT EXISTS delegated_to_user_id UUID;
          ALTER TABLE users ADD COLUMN IF NOT EXISTS delegated_until TIMESTAMP;
          ALTER TABLE users ADD COLUMN IF NOT EXISTS assigned_branch_ids TEXT[] DEFAULT ARRAY[]::text[] NOT NULL;
          ALTER TABLE users ADD COLUMN IF NOT EXISTS assigned_department_ids TEXT[] DEFAULT ARRAY[]::text[] NOT NULL;
        END IF;
      END $$;
    `);
  } finally {
    await sql.end();
  }
}
