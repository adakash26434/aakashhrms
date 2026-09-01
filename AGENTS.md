# AakashHRMS — Project Knowledge

## Stack
- **Next.js 16** (App Router, Server Actions) — `output: "standalone"` for cPanel
- **Drizzle ORM** + **PostgreSQL** — schema at `lib/db/schema.ts`, config `drizzle.config.ts`
- **NextAuth (Auth.js)** — credentials provider
- Deployed on **cPanel** (Phusion Passenger) — entry point is `app.js`

## DB Scripts (package.json)
| Script | Purpose |
|--------|---------|
| `npm run db:reset` | **Full reset**: drop tables + enums → push schema → seed (rbac + admin + leaves). Destroys all data. Use for fresh deploys / schema resets. |
| `npm run db:drop-all` | Drop all tables + enum types (CASCADE). Keeps schema. |
| `npm run db:push -- --force` | Sync `schema.ts` → DB (no prompts). Use `--force` to skip interactive TTY prompts. |
| `npm run db:check` | Print PG version + whether `gen_random_uuid()` is available. |
| `npm run db:seed` | Seed RBAC (175 permissions, 7 roles). |
| `npm run db:seed:admin` | Create admin user from `INITIAL_ADMIN_EMAIL`/`INITIAL_ADMIN_PASSWORD`. |
| `npm run db:seed:leaves` | Seed statutory leave types + rules. |

## Critical: PostgreSQL 10 on cPanel
Shared cPanel hosting often runs **PostgreSQL 10.23** with these constraints:
- **No `gen_random_uuid()`** — only in PG 13+
- **No `pgcrypto` / `uuid-ossp` extensions** — can't install on shared hosting
- **App user is NOT schema owner** — `DROP SCHEMA public` fails ("must be owner of schema public"); use `DROP TABLE ... CASCADE` instead

### How UUIDs work in this repo
All `uuid` columns use **app-layer generation** via Drizzle `$defaultFn`:
```ts
id: uuid('id').$defaultFn(() => randomUUID()).primaryKey(),
```
This makes Drizzle call `node:crypto.randomUUID()` on insert — no `DEFAULT gen_random_uuid()` in the SQL. Works on PG 10+. **Never** use `.defaultRandom()` — it emits `gen_random_uuid()` which breaks on PG 10.

### Deploy gotchas (already solved, documented for future)
1. **`gen_random_uuid() does not exist`** → fixed by app-layer UUID (`$defaultFn`). Don't reintroduce `defaultRandom()`.
2. **`column "id" cannot be cast automatically to type uuid`** → happens when existing tables have `text`/`varchar` id columns from an old schema. Fix: `npm run db:reset` (drops + recreates with `uuid` type).
3. **`must be owner of schema public`** → `drop-all-tables.ts` drops tables individually (CASCADE), not the schema.

## cPanel Deploy Sequence
```bash
# Activate Node env first (npm isn't on PATH until you do):
source ~/nodevenv/app/20/bin/activate

git pull origin main
npm install
npm run build
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public

# Fresh DB or schema changed:
npm run db:reset

# Then: cPanel → Setup Node.js App → Restart
```

## Build Notes
- `next.config.ts` uses `experimental.workerThreads: true` — CloudLinux/cPanel LVE caps nproc, so the default child_process.fork workers hit EAGAIN. worker_threads share the parent process.
- Build needs `DATABASE_URL` + `AUTH_SECRET` present (env check), but dashboard routes are `force-dynamic` so the build won't hit the DB — throwaway values are fine for build-only.
- `.next/standalone/server.js` is the actual server; `app.js` just loads dotenv + requires it.

## Schema Conventions
- All primary keys are `uuid` with `$defaultFn(() => randomUUID())` — app-layer, PG 10 safe
- 37 tables total
- Enum types: `scope_type`, `action`, `payroll_run_status`, `leave_salary_run_status`, etc. — dropped by `db:drop-all` before re-push

## Testing Locally (PG 10)
```bash
sudo dockerd > /dev/null 2>&1 &
sudo docker run -d --name pg10 -e POSTGRES_PASSWORD=testpass -e POSTGRES_DB=testdb -e POSTGRES_USER=testuser -p 5433:5432 postgres:10
# Set DATABASE_URL=postgresql://testuser:testpass@localhost:5433/testdb in .env
npm run db:reset
npm run build
PORT=3100 HOSTNAME=127.0.0.1 node app.js
```
