import { db } from "../lib/db";
import { sql } from "drizzle-orm";

/**
 * Checks the database environment for UUID generation capabilities.
 * Reports: PostgreSQL version, available extensions, and whether
 * gen_random_uuid() / uuid_generate_v4() already work.
 *
 * Run: npx tsx --env-file=.env scripts/check-db-version.ts
 */
async function checkDb() {
  console.log("=== Checking database environment ===\n");

  const [version] = await db.select({ v: sql<string>`version()` }).from(sql`none`).limit(1).catch(async () => {
    const res = await db.execute(sql`SELECT version();`);
    return [{ v: (res[0] as any)?.version ?? "unknown" }];
  });
  console.log("PostgreSQL version:", version?.v ?? "unknown", "\n");

  const hasGenRandom = await db.execute(sql`SELECT gen_random_uuid() AS u;`)
    .then(() => true)
    .catch(() => false);
  console.log("gen_random_uuid() available:", hasGenRandom);

  const hasUuidOssp = await db.execute(sql`SELECT uuid_generate_v4() AS u;`)
    .then(() => true)
    .catch(() => false);
  console.log("uuid_generate_v4() available:", hasUuidOssp);

  const exts = await db.execute(sql`SELECT name, default_version, installed_version FROM pg_available_extensions ORDER BY name;`)
    .then((r) => r as unknown as Array<{ name: string; default_version: string | null; installed_version: string | null }>)
    .catch(() => [] as Array<{ name: string; default_version: string | null; installed_version: string | null }>);
  if (exts.length > 0) {
    console.log("\nAvailable extensions:");
    for (const e of exts) {
      console.log(`  ${e.name} (default: ${e.default_version ?? "?"}, installed: ${e.installed_version ?? "no"})`);
    }
  }

  console.log("\n=== Summary ===");
  if (hasGenRandom) {
    console.log("✅ gen_random_uuid() works — db:push should succeed as-is.");
  } else if (hasUuidOssp) {
    console.log("⚠️ uuid_generate_v4() works — need to switch schema default to uuid-ossp.");
  } else {
    console.log("❌ No DB-side UUID function available. Must generate UUIDs at the app layer.");
  }
  process.exit(0);
}

checkDb().catch((err) => {
  console.error("❌ Failed:", err);
  process.exit(1);
});
