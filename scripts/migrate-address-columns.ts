import postgres from 'postgres';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env' });

async function migrateEmployeeAddressColumns() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('DATABASE_URL is not set.');
    process.exit(1);
  }

  const sql = postgres(dbUrl, { max: 1 });

  try {
    console.log('🔍 Checking employee_personal columns in database...');

    // 1. Check existing columns in employee_personal
    const columns = await sql<{ column_name: string }[]>`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'employee_personal';
    `;
    const colNames = columns.map((c) => c.column_name);
    console.log('Current columns in employee_personal:', colNames);

    // 2. Add permanent_address and temporary_address if they do not exist
    if (!colNames.includes('permanent_address')) {
      console.log('➕ Adding permanent_address column to employee_personal...');
      await sql`ALTER TABLE employee_personal ADD COLUMN IF NOT EXISTS permanent_address TEXT;`;
      
      // If address1 exists, copy data over
      if (colNames.includes('address1')) {
        console.log('📦 Migrating data from address1 to permanent_address...');
        await sql`UPDATE employee_personal SET permanent_address = address1 WHERE permanent_address IS NULL;`;
      }
      
      // Set NOT NULL once populated
      await sql`UPDATE employee_personal SET permanent_address = '' WHERE permanent_address IS NULL;`;
      await sql`ALTER TABLE employee_personal ALTER COLUMN permanent_address SET NOT NULL;`;
    }

    if (!colNames.includes('temporary_address')) {
      console.log('➕ Adding temporary_address column to employee_personal...');
      await sql`ALTER TABLE employee_personal ADD COLUMN IF NOT EXISTS temporary_address TEXT;`;
      
      // If address2 exists, copy data over
      if (colNames.includes('address2')) {
        console.log('📦 Migrating data from address2 to temporary_address...');
        await sql`UPDATE employee_personal SET temporary_address = address2 WHERE temporary_address IS NULL;`;
      }
    }

    console.log('✅ Column migration for employee_personal completed successfully!');
    
    // Verify columns
    const updatedColumns = await sql<{ column_name: string }[]>`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'employee_personal';
    `;
    console.log('Updated columns in employee_personal:', updatedColumns.map((c) => c.column_name));
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

migrateEmployeeAddressColumns();
