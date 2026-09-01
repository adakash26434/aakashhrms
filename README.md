This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Deployment on a cPanel server (Node.js + Phusion Passenger)

This is a full-stack Next.js 16 app (App Router, Server Actions) backed by
**PostgreSQL** via Drizzle ORM and authenticated with **NextAuth (Auth.js)**.
It is configured with `output: "standalone"`, so a production build produces
a self-contained Node server at `.next/standalone/server.js`. The repo also
ships an `app.js` entry point that cPanel's "Setup Node.js App" can launch.

### Requirements on the server

- cPanel account with **Setup Node.js App** (Phusion Passenger) enabled
- **Terminal / SSH** access (you'll run the build + migrations)
- **Git** access (Git Version Control in cPanel, or clone over SSH)
- A **PostgreSQL** database created in cPanel (PostgreSQL Databases)
- Node.js **20 LTS or 22 LTS** (pick one of these in the Node app selector)
  > Note: `nepali-date-library` advertises Node 24, but it works on 22. Use
  > 20 or 22 if 24 isn't available; the build warning is harmless.

### Required environment variables

See [`.env.example`](.env.example). Set these in cPanel under
*Setup Node.js App → Environment variables* (do **not** commit a real `.env`):

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string, e.g. `postgresql://user:pass@localhost:5432/payroll` |
| `AUTH_SECRET` | Secret for signing NextAuth JWTs. Generate with `openssl rand -base64 32` |
| `AUTH_URL` | (recommended) canonical public URL, e.g. `https://hrms.yourdomain.com` |
| `INITIAL_ADMIN_EMAIL` | Admin email created by `npm run db:seed:admin` |
| `INITIAL_ADMIN_PASSWORD` | Admin password (hashes to DB; rotate after first login) |

### Step-by-step

1. **Create the database**
   In cPanel → *PostgreSQL Databases*: create a database + user and grant the
   user all privileges on that database. Note the DB name, user and password.

2. **Get the code onto the server**
   Either use cPanel's *Git Version Control* to clone
   `https://github.com/Chandan5689/PayrollSystem.git`, or in the terminal:
   ```bash
   cd ~/your-app-folder
   git clone https://github.com/Chandan5689/PayrollSystem.git .
   ```

3. **Install dependencies & build**
   ```bash
   npm install --omit=dev   # runtime deps for the standalone server
   npm run build            # generates .next/standalone (+ server.js)
   ```
   The build needs a `DATABASE_URL` and `AUTH_SECRET` present (they're read at
   build time). If you haven't set them in cPanel yet, export throwaway values
   for the build only:
   ```bash
   DATABASE_URL="postgresql://mock:mock@localhost:5432/mock" \
   AUTH_SECRET="build_only_secret" npm run build
   ```
   > The dashboard routes use `dynamic = "force-dynamic"`, so the build will
   > NOT try to hit the database — a throwaway URL is fine just to satisfy the
   > env check. The real values are used at runtime.

4. **Place the static assets where the standalone server expects them**
   The standalone server only bundles server code; static files are served
   from `.next/static` and `public/`. Copy them next to the standalone output:
   ```bash
   cp -r .next/static .next/standalone/.next/static
   cp -r public .next/standalone/public
   ```

5. **Create the Node.js app in cPanel**
   - *Software → Setup Node.js App → Create Application*
   - **Node.js version:** 20 LTS or 22 LTS
   - **Application root:** your app folder
   - **Application URL:** your domain/subdomain
   - **Application startup file:** `app.js`
   - **Passenger log file:** enable (helps debugging)
   - Add the **environment variables** from the table above (real values).

6. **Create the database tables & seed data**
   Do this from the terminal inside the app folder (env vars must be present,
   e.g. via a temporary `.env` that you delete afterwards, or by exporting them):

   **Fresh deploy (empty DB or resetting schema):**
   ```bash
   npm run db:reset          # drops tables → recreates → seeds (one command)
   ```

   **Updating an existing DB (no data loss):**
   ```bash
   npm run db:push -- --force   # sync schema.ts → DB (add/alter columns)
   npm run db:seed              # re-seed roles / RBAC permissions
   npm run db:seed:leaves       # statutory leave types
   npm run db:seed:admin        # create the initial admin user
   ```

   > **PostgreSQL 10 note:** many shared hosts (cPanel) run PG 10, which has no
   > `gen_random_uuid()` (added in PG 13) and doesn't allow installing the
   > `pgcrypto` extension. This repo generates UUIDs at the **app layer** via
   > `node:crypto.randomUUID()` (Drizzle `$defaultFn`), so no DB-side UUID
   > function is needed. Run `npm run db:check` to verify the DB version and
   > UUID support. If `db:push` fails with "column cannot be cast to type
   > uuid", it means the existing tables have `text`/`varchar` id columns from
   > an old schema — run `npm run db:reset` to drop and recreate cleanly.

7. **Start / restart the app**
   In *Setup Node.js App* click **Run NPM Install** (only the first time) then
   **Restart**. Passenger spawns `app.js`, which launches the standalone server
   on the assigned `PORT`. Tail the Passenger log if the app doesn't respond:
   ```bash
   tail -f ~/logs/your-domain/passenger.log
   ```

8. **Post-deploy checklist**
   - Visit `https://your-domain/login` → log in with the seeded admin.
   - Change the admin password after first login.
   - Confirm `AUTH_URL` matches the public URL (avoids cookie/redirect issues).
   - If behind HTTPS only, ensure cookies use `Secure` (handled automatically
     when `AUTH_URL` is `https://...`).

### Common issues

- **502 / "cannot GET /"** — static assets weren't copied (step 4), or the
  startup file isn't `app.js`. Re-copy `.next/static` into `.next/standalone/.next`.
- **`connect ECONNREFUSED` at runtime** — `DATABASE_URL` is missing/wrong in
  cPanel's env vars. Use `localhost` (not `127.0.0.1` unless cPanel says so).
- **Login redirects loop / cookies not set** — set `AUTH_URL` to the exact
  public HTTPS URL.
- **Build fails on `nepali-date-library` engine warning** — ignore it; it's a
  warning, not an error. If the build truly breaks, use Node 22/24.
