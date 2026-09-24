import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';

async function run() {
  try {
    const db = getDb();
    await db.execute(sql`ALTER TABLE employees ADD COLUMN IF NOT EXISTS grade_count integer DEFAULT 0 NOT NULL;`);
    await db.execute(sql`ALTER TABLE employee_salary_map ADD COLUMN IF NOT EXISTS grade_count integer DEFAULT 0 NOT NULL;`);
    console.log('✅ grade_count columns added/verified successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Migration error:', err);
    process.exit(1);
  }
}

run();
