import { db } from "../lib/db";
import { sql } from "drizzle-orm";

/**
 * Drops all tables in the public schema (CASCADE) so db:push can recreate
 * them from scratch with the correct uuid column types.
 *
 * Needed because the server's existing tables have id columns as text/varchar
 * (from an old schema), and PG can't auto-cast text -> uuid, so
 * `ALTER COLUMN ... SET DATA TYPE uuid` fails with
 * "column cannot be cast automatically to type uuid".
 *
 * Dropping everything is safe here: the only data is seeded
 * (RBAC, admin user, statutory leaves), which we re-seed after.
 *
 * Run: npx tsx --env-file=.env scripts/drop-all-tables.ts
 */
async function dropAllTables() {
  console.log("⚠️  Dropping ALL tables in public schema (CASCADE)...");

  const tables = await db.execute<{ tablename: string }>(sql`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename != '__drizzle_migrations'
    ORDER BY tablename;
  `).then((r) => r as unknown as Array<{ tablename: string }>);

  if (tables.length === 0) {
    console.log("No tables found. Nothing to drop.");
    process.exit(0);
  }

  console.log(`Found ${tables.length} tables to drop.`);
  for (const t of tables) {
    console.log(`  dropping: ${t.tablename}`);
  }

  if (tables.length > 0) {
    // Drop all tables individually with CASCADE.
    // We can't DROP SCHEMA because the app user isn't the schema owner
    // on shared cPanel hosting ("must be owner of schema public").
    // The app user owns the tables though, so DROP TABLE works.
    const tableList = tables
      .map((t) => `"${t.tablename}"`)
      .join(", ");
    await db.execute(sql.raw(`DROP TABLE IF EXISTS ${tableList} CASCADE;`));
  }

  // Also drop any leftover enum types so db:push can recreate cleanly
  const types = await db.execute<{ typname: string }>(sql`
    SELECT t.typname
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typtype = 'e'
    ORDER BY t.typname;
  `).then((r) => r as unknown as Array<{ typname: string }>);

  if (types.length > 0) {
    console.log(`\nDropping ${types.length} enum types:`);
    for (const ty of types) {
      console.log(`  dropping type: ${ty.typname}`);
    }
    const typeList = types.map((t) => `"${t.typname}"`).join(", ");
    await db.execute(sql.raw(`DROP TYPE IF EXISTS ${typeList};`));
  }

  console.log(`✅ Dropped ${tables.length} tables + ${types.length} types. Schema is now clean.`);
  console.log("\nNext steps:");
  console.log("  npm run db:push -- --force");
  console.log("  npm run db:seed");
  console.log("  npm run db:seed:admin");
  console.log("  npm run db:seed:leaves");
  process.exit(0);
}

dropAllTables().catch((err) => {
  console.error("❌ Failed:", err);
  process.exit(1);
});
