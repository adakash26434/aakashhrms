/**
 * Full reset + reseed in one command for cPanel deploys.
 *
 * Runs: drop-all-tables → db:push --force → seed-rbac → seed-admin → seed-leaves
 *
 * Use this when the server DB needs a clean schema sync (e.g. after pulling
 * schema changes, or on a fresh deploy). It drops all existing tables + enum
 * types, recreates them from schema.ts, and re-seeds the baseline data.
 *
 * WARNING: This destroys all data in the database. Only use on a fresh deploy
 * or when you're OK losing the data (e.g. dev/staging, or production before
 * go-live with only seeded data).
 *
 * Run: npm run db:reset
 */
import { execSync } from "node:child_process";

const envFlag = "--env-file=.env";
const steps: Array<{ label: string; cmd: string }> = [
  { label: "Dropping all tables + enum types", cmd: `tsx ${envFlag} scripts/drop-all-tables.ts` },
  { label: "Pushing schema (db:push --force)", cmd: `drizzle-kit push --force` },
  { label: "Seeding RBAC (roles + permissions)", cmd: `tsx ${envFlag} scripts/seed-rbac.ts` },
  { label: "Seeding admin user", cmd: `tsx ${envFlag} scripts/seed-admin.ts` },
  { label: "Seeding statutory leaves", cmd: `tsx ${envFlag} scripts/seed-statutory-leaves.ts` },
];

console.log("┌─────────────────────────────────────────────┐");
console.log("│  ⚠️  DB RESET — destroys all data           │");
console.log("│  drop → push → seed (rbac + admin + leaves) │");
console.log("└─────────────────────────────────────────────┘\n");

for (const step of steps) {
  console.log(`\n▶ ${step.label}...`);
  try {
    execSync(step.cmd, { stdio: "inherit" });
    console.log(`✅ ${step.label} — done`);
  } catch (err) {
    console.error(`\n❌ FAILED at: ${step.label}`);
    console.error("Aborting db:reset. Fix the error above and re-run.\n");
    process.exit(1);
  }
}

console.log("\n┌─────────────────────────────────────────────┐");
console.log("│  ✅  DB RESET COMPLETE                      │");
console.log("│  Next: restart the app in cPanel            │");
console.log("└─────────────────────────────────────────────┘");
