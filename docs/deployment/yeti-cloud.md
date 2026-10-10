# Deploying AakashHRMS to Yeti Cloud

How the live system runs on Yeti Cloud (Jelastic PaaS), and how to put a new version live.

- Use this file before every deploy.
- Add a line to the **Release log** after every deploy.
- Never write secret values in this file. It lists `.env` variable names only.

---

## 1. How the server is set up

```
Browser
   │  HTTPS
   ▼
Yeti Cloud shared load balancer (SSL, reverse proxy) ── forwards to port 8080
   │
   ▼
Node.js container  node26201-aakash-hrms   /home/jelastic/ROOT
   PM2 process (name "aakash-hrms" in ecosystem.config.js; older setups used "payroll-app")
     app.js: HTTP bridge on 0.0.0.0:8080 ──► Next.js standalone server (.next/standalone/server.js) on 3000
   │
   ▼
PostgreSQL
   payroll_platform   control plane: companies, tenant_databases, platform_users, change requests,
                      company_leave_exceptions
   pay_t_<slug>       one database per company: employees, payroll, roles, leave, attendance …
```

| Item | Value |
|---|---|
| Platform | Yeti Cloud (Jelastic), one Node.js application server, node ID 26201 |
| App directory | `/home/jelastic/ROOT`, a git clone of `github.com/adakash26434/aakashhrms`, branch `main` |
| Node | v20 or newer (Next.js 16 needs ≥ 20.9) |
| PostgreSQL | 16.15 on its own node, `node26200-aakash-hrms` (local development uses PostgreSQL 10, so tenant SQL must stay PostgreSQL 10 compatible) |
| Process manager | PM2. Check the real name with `pm2 status` |
| Ports | The load balancer only reaches **8080**; Next.js listens on 3000; `app.js` bridges the two |
| Secrets | `/home/jelastic/ROOT/.env`, git-ignored (`.env*`), so `git reset --hard` never touches it |

### Files that make the server work (keep them unchanged unless the server changes)

| File | Job |
|---|---|
| `app.js` | Loads `.env`, starts `.next/standalone/server.js` on 3000, forwards 8080 → 3000. It passes headers unchanged (Host, X-Forwarded-For), so the app sees what the load balancer sent. |
| `ecosystem.config.js` | PM2 app definition (`NODE_ENV=production`). |
| `next.config.ts` | `output: "standalone"`. Memory-safe build: `experimental.cpus: 1`, `serverMinification: false`, `staticPageGenerationTimeout: 300`, `typescript.ignoreBuildErrors` (types are checked locally instead). Also security headers, and the API CSP (the page CSP comes from `proxy.ts`). |
| `package.json` | `"build": "next build --webpack"` and `"postbuild": "node scripts/copy-standalone-assets.js"`. The `version` shows in the status bar on wide screens. |
| `scripts/copy-standalone-assets.js` | Copies `.next/static`, `public/` and `lib/db/migrations` into `.next/standalone/`. Without it, pages load without CSS or JS. |
| `scripts/sync-schema.ts` | Brings every database up to date. Platform tables come from `ensurePlatformTablesExist` (`lib/platform/db.ts`). Then, for each ACTIVE company: `ensureTenantSchema` (`lib/db/tenant-schema-sync.ts`) and the RBAC seed (`seedRbacForDb`). |
| `instrumentation.ts` | At start, logs `[security] ERROR/WARNING` lines for missing, short or shared secrets (`lib/security/secrets.ts`). |

### How database changes reach the server
- Every migration in `lib/db/migrations/` is **mirrored** in `lib/db/tenant-schema-sync.ts` (`ensureTenantSchema`), written to be safe to run again: `IF NOT EXISTS`, guarded updates, PostgreSQL 10 compatible (`md5(...)::uuid`, never `gen_random_uuid()` in tenant SQL).
- This mirrored code runs in two places:
  1. `npx tsx scripts/sync-schema.ts` (deploy step S6), for every company database;
  2. whenever a company's database pool opens, so a restart also applies it.
- `drizzle-kit migrate` is **not** used on the server.
- Platform-database changes go in `ensurePlatformTablesExist` (`lib/platform/db.ts`).

### `.env` variables the server needs (names only)

| Variable | Notes |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Main connection (the platform database in multi-tenant mode) |
| `PLATFORM_DATABASE_URL` | Control-plane database |
| `SINGLE_TENANT_MODE` | Not `true` on the multi-tenant server |
| `AUTH_SECRET` | Tenant session JWTs. **At least 32 characters** |
| `AUTH_URL` / `NEXTAUTH_URL` | Public URL, if set |
| `PLATFORM_SECRETS_KEY` | Encrypts tenant database passwords. **Never change it** once companies exist, or their databases can't be opened |
| `PLATFORM_SESSION_SECRET` | Super-admin session and impersonation tokens. **Required in production** (platform login is refused without it). At least 32 characters, and different from the two secrets above. Changing it signs super admins out |
| `TRUSTED_PROXY_HOPS` | Proxies that append to X-Forwarded-For. Yeti load balancer = `1` (`app.js` doesn't append). Used for the client IP in login throttling, the audit log and the office-network clock-in |
| `FORCE_SSL` | `true` adds HSTS `includeSubDomains; preload` and `upgrade-insecure-requests`. Production sends a one-year HSTS without it |
| `ROOT_DOMAIN`, `SUPER_ADMIN_EMAIL`, `DEFAULT_TENANT_ADMIN_PASSWORD` | Platform setup |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | Credential and reset emails |

**Checking `.env` without showing a secret** (run on the server; these print names, lengths and a count only):
```bash
grep -oE '^[A-Z_]+=' .env | sort
awk -F= '/^(AUTH_SECRET|PLATFORM_SESSION_SECRET|PLATFORM_SECRETS_KEY)=/{print $1, length($2)}' .env
grep -E '^(AUTH_SECRET|PLATFORM_SESSION_SECRET|PLATFORM_SECRETS_KEY)=' .env | cut -d= -f2- | sort | uniq -d | wc -l   # must print 0
```
Values that are quoted count the quotes in `length`; allow for 2 extra characters.

To make a new secret: `openssl rand -base64 48`, then add it with `nano .env`.

---

## 2. Branches and releases

- **Work happens on stacked branches.** Each `redesign/<step>` branch starts from the previous one, so the newest branch holds everything.
- **`main` is what is live.** The server only ever follows `origin/main`.
- **A deploy:**
  1. **Fast-forward** local `main` to the signed-off tip: `git checkout main && git merge --ff-only <tip>`. Never merge-commit. When merging a pull request on GitHub instead, choose **Rebase and merge** (a plain "Merge" adds a merge commit, harmless but not straight history).
  2. **Tag it** `deploy-YYYY-MM-DD`.
  3. **Push:** `git push origin main <tag>`.
  4. **Start the next step** on a new branch from `main`.
- **Only push when the user asks**, and push only `main` and tags. The `redesign/*` branches stay local, since `main` contains them.
- **Pushing to `main` runs GitHub Actions** (`.github/workflows/main.yml`: install, audit, lint, type-check, test, build).
  - Lint is red until the old lint errors are cleaned up (see `CLAUDE.md` → Known debt).
  - That doesn't affect the server, which builds on its own.
- **Rollback points:**
  - `pre-redesign` = `7f20aaf`, the code that ran before the first redesign release;
  - every `deploy-*` tag is the code of that release.

---

## 3. Before a deploy (Claude's checklist, on the local machine)

1. **Every step going live is signed off** by the user, and the working tree is clean.
2. **List what changed since the last release:**
   `git diff --stat <last deploy tag> HEAD -- lib/db/ lib/platform/db.ts package.json package-lock.json .env.example next.config.ts app.js ecosystem.config.js scripts/`
3. **For each item, check:**
   - **New migration:**
     - the journal (`lib/db/migrations/meta/_journal.json`) and the mirror in `tenant-schema-sync.ts` are both there;
     - list the statements that change or delete existing data (`UPDATE`, `DELETE`, `DROP`, `ALTER COLUMN`). If there are any, **a database backup is mandatory** and rollback needs the restore.
   - **Platform table or column:** it is in `ensurePlatformTablesExist`.
   - **New env variable:** it is in `.env.example` and in the table above. Tell the user before the deploy.
   - **`package-lock.json` changed:** the server needs `npm ci`. It is in the runbook anyway.
   - **New RBAC permissions:** `sync-schema.ts` seeds them; existing roles may need them granted.
4. **Bump `version`** in `package.json`, so the status bar shows which build is live.
5. **Gates:**
   - `npx tsc --noEmit -p .`
   - `node --import tsx --test tests/*.test.ts`
   - `npm run build`: the same webpack build and postbuild as the server.
6. **Write it down:** a CHANGELOG entry and a **Release log** line (below). Commit, fast-forward `main`, tag, push.
7. **Give the user the runbook below,** with this release's notes: new env vars, backup needed, anything to check afterwards.

---

## 4. Server runbook (the user runs this in Yeti Web SSH)

Pick a quiet time; the app is down for about 5–10 minutes.

**S1. Check the server state**
```bash
cd /home/jelastic/ROOT && git status --short && git log -1 --oneline && pm2 status
```
- The commit should be the previous release.
- Any changed tracked file listed is **lost** at S4: keep a copy first if it matters.

**S2. Check `.env`** with the commands in section 1, and add any new variables for this release.

**S3. Back up the databases** (platform and every `pay_t_<slug>`)
- **Where:** open Web SSH on the **PostgreSQL node** (`node26200`), not the Node.js one.
- **Login:** use the user and password from `DATABASE_URL` (`webadmin`) and connect **through the host name**.
  - Through `127.0.0.1` the login is refused ("Ident authentication").
  - Through the local socket it asks for the `postgres` password, which we don't have.
- **Don't use "Reset password"** on the PostgreSQL node: the app connects as `webadmin`.
- **The Yeti "Backup" add-on** needs a separate paid Backup Storage environment. It is not set up.
- **Paste one line at a time** and type the password at each prompt. While a prompt is waiting, it swallows any further pasted lines as the password.

```bash
H=node26200-aakash-hrms.ktm.yetiappcloud.com
psql -h $H -U webadmin -d postgres -At -c "select datname from pg_database order by 1"
```
- **The databases on 2026-10-07:** `payroll_platform`, `pay_t_bihani_saccos`, `pay_t_janaki_finance`, `pay_t_kahunkot_saccos`, `pay_t_pokhara_saccos`.
- **Back up each one** (each line asks for the password):
```bash
mkdir -p ~/backups && cd ~/backups
pg_dump -h $H -U webadmin -Fc -d payroll_platform -f payroll_platform-$(date +%F).dump && echo saved
pg_dump -h $H -U webadmin -Fc -d pay_t_bihani_saccos -f pay_t_bihani_saccos-$(date +%F).dump && echo saved
# … one line per pay_t_ database, then:
ls -lh ~/backups
```
- **Expect** files of roughly 25–150 KB on 2026-10-07. Keep them until the release has been checked.
- **Never send a screenshot that shows a password** (for example the `DATABASE_URL` line).

**S4. Stop the app and fetch the code**
```bash
pm2 stop all
git fetch origin main --tags && git reset --hard origin/main && git log -1 --oneline
```
- Stopping frees memory for the build and keeps users off a half-updated database.
- `fetch` + `reset --hard`, never `git pull`: no merge prompts, no conflicts from build files. `.env` is git-ignored, so it is untouched.

**S5. Install exact dependencies**
```bash
npm ci --no-audit --no-fund
```

**S6. Update every database**
```bash
npx tsx scripts/sync-schema.ts
```
- Every company must print `✅ Tenant "…" synced`.
- **The script ends with "completed successfully" even if a company failed** (`❌ Failed syncing tenant`), so read the whole output.

**S7. Build**
```bash
NODE_OPTIONS="--max-old-space-size=1536" npm run build
```
- About 2–4 minutes.
- It must end with the `✓ Copied … into .next/standalone` lines.

**S8. Start and check the logs**
```bash
pm2 restart all && pm2 logs --lines 50
```
- **Expect:**
  - `✓ Dual-port active: listening on port 8080 -> forwarding to port 3000`
  - `Listening on port 3000`
- **There must be no `[security] ERROR` line.** A `WARNING` about `FORCE_SSL` is acceptable.

**S9. Smoke test** (the user signs in)
- **Version and sign-in:**
  - the status bar (wide window) shows the new version;
  - everyone signs in again if auth changed.
- **Open each module:** Home, Employees (register, a record, Edit tabs), Organization, Salary structure, Attendance, Leaves, Self-service.
- **Platform login** (`/platform/login`) proves `PLATFORM_SESSION_SECRET` works.
- **One real upload of the user's choice** (an employee photo or scan) proves the uploads' same-origin check works behind the proxy.
- **Security headers:**
  ```bash
  curl -sI https://<domain>/login | grep -iE 'content-security|strict-transport'
  ```

### Rollback
Use this if S6–S9 fail and the problem can't be fixed quickly:
```bash
pm2 stop all
git reset --hard <previous deploy tag, or pre-redesign>
npm ci --no-audit --no-fund
# restore the S3 backups when the release's migrations changed data (pg_restore --clean -d <db> <file>)
NODE_OPTIONS="--max-old-space-size=1536" npm run build
pm2 restart all
```

---

## 5. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `502 Bad Gateway` / Application Down | Nothing on 8080, or PM2 crashed | `pm2 status`, `pm2 logs`, `curl -I http://127.0.0.1:8080` |
| `spawn ENOMEM` during the build | Not enough memory | Stop the app first (`pm2 stop all`); keep `experimental.cpus: 1`; build with `NODE_OPTIONS="--max-old-space-size=1536"` |
| Pages without styles, 404 on `/_next/static` | postbuild didn't copy the assets | Run `node scripts/copy-standalone-assets.js`, then restart |
| `relation "…" does not exist` / `column … does not exist` | A company database is behind | `npx tsx scripts/sync-schema.ts`, then read every tenant line |
| `relation "permissions" does not exist` | A script was run against the platform database | Use `sync-schema.ts`, which finds the company databases itself |
| `[security] ERROR …` in the logs | Missing, short or shared secret | Fix `.env` (section 1), then `pm2 restart all` |
| Super-admin login refused | `PLATFORM_SESSION_SECRET` missing, or equal to another secret | Set a distinct one of at least 32 characters |
| Photo or scan upload says Forbidden | The Origin doesn't match Host / X-Forwarded-Host behind the proxy (`lib/security/same-origin.ts`) | Check what the load balancer forwards as Host; tell Claude the exact response |
| Everyone shares one login-throttle IP, or the audit IP is wrong | `TRUSTED_PROXY_HOPS` doesn't match the proxies | `1` for the Yeti load balancer; `2` if Cloudflare sits in front |
| `git reset` lost a server-side edit | A tracked file had been edited on the server | Never edit tracked files on the server: change them in the repo and deploy |
| Credential or reset email not sent | SMTP variables missing | Add `SMTP_*` to `.env`, restart |

---

## 6. Never run on the server

These scripts are for a local development database only:
- `scripts/drop-all-tables.ts`
- `scripts/db-reset.ts`

Also never run `drizzle-kit push` / `migrate`. Database changes reach the server only through `sync-schema.ts`.

---

## 7. Clean-up candidates (decide after the redesign, not before)

Kept for now because old screens may still use them, or because they record how old data was fixed. Review them in the final clean-up step.
- **`public/`:** the create-next-app icons `file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg`. Nothing in `app/`, `components/` or `lib/` references them.
- **One-off scripts:** `migrate-address-columns.ts`, `migrate-all-tenant-address-columns.ts`, `migrate-all-tenant-grade-count.ts`, `migrate-grade-count.ts`, `migrate-columns.js`, `apply-migration.ts`, `check-db-version.ts`. Their work is now in `ensureTenantSchema`.
- **Development-only scripts** (keep, but never on the server): `drop-all-tables.ts`, `db-reset.ts`.
- **Old `components/ui/*` pickers** and old screens: removed module by module as the redesign replaces them (`CLAUDE.md` → Known debt).
- **Database columns marked "drop in Phase 8"** in `CLAUDE.md`: for example the old `employee_personal` document columns, `departments.employee_count`, `leave_rules`.

---

## 8. Release log

Newest first. One line per deploy: date · tag · commit · what went live · migrations · notes.

| Date | Tag | Commit | Contents | Migrations | Notes |
|---|---|---|---|---|---|
| 2026-10-08 | `deploy-2026-10-08` | `40c0dca` | 4.4b Salary structure: payslip-style breakdown with income tax estimate and net payable, Add new / Bulk add for new hires, templates (Employees count, Apply to employees, preview, delete), Print salary revision wording and part rules; employee form without the re-enter account field | none | No new env, packages unchanged. `40c0dca` is GitHub's PR #1 merge commit; its files equal `cafa6c9`. **Result: live.** `sync-schema` ✅ for every company, build OK, app online, screens checked by the user. Version label still v0.2.0 (not bumped this time; bump in the next release). |
| 2026-10-07 | `deploy-2026-10-07` | `56314a9` | First redesign release (v0.2.0): security phase 0, design system, app frame, kit, Home, Employees (incl. documents and photo), Organization, Salary structure, Attendance (shifts, web clock-in), Leaves (ledger, entitlements, policies, exceptions, company types) | 0035–0046, plus platform `company_leave_exceptions` and `company_change_requests.kind` | New required env: `PLATFORM_SESSION_SECRET`. `npm ci` needed. Backup required (0038, 0039, 0042, 0044, 0046 change data). Rollback tag `pre-redesign` = `7f20aaf`. **Result: live.** Backups taken; secrets checked (all different); `sync-schema` ✅ for all 4 companies; build OK; app online (v0.2.0), `/login` 200 with the security headers. The logs show "column already exists" NOTICEs (harmless) and bots probing server actions ("Server Reference ID … Received \"x\"", rejected). The `[security] WARNING` about `FORCE_SSL` remains: set `FORCE_SSL=true` once HTTPS is confirmed everywhere. **Follow-up:** the database password was shown in a screenshot during this deploy, so change it (`webadmin` on the PostgreSQL node, and `DATABASE_URL` / `PLATFORM_DATABASE_URL` together, plus any tenant credentials that use `webadmin`). |
