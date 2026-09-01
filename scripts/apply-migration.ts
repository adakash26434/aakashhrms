import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import path from 'path';
import * as dotenv from 'dotenv';
import * as schema from '../lib/db/schema';

dotenv.config({ path: '.env' });

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error('DATABASE_URL is not set.');

  console.log('🔄 Running Drizzle migrations on primary database...');
  const sql = postgres(dbUrl, { max: 1 });
  const db = drizzle(sql, { schema });

  try {
    const migrationsFolder = path.resolve(process.cwd(), 'lib/db/migrations');
    await migrate(db, { migrationsFolder });
    console.log('✅ Migrations applied successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();
