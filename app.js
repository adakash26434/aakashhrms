// cPanel entry point for the Next.js standalone server.
//
// cPanel's "Setup Node.js App" runs the app through Phusion Passenger, which
// spawns the startup file and reverse-proxies requests to the port it
// advertises via the PORT environment variable.
//
// `npm run build` (with output: "standalone") generates a self-contained
// Node server at `.next/standalone/server.js` that listens on process.env.PORT
// and bundles all server-side dependencies, so this file just needs to launch
// it. See the "Deployment on a cPanel server" section of README.md for the
// full setup (copying .next/static & public in, env vars, migrations, etc.).
//
// dotenv is loaded explicitly because the standalone server (unlike `next dev`)
// does not auto-read a .env file; this keeps .env as the single source of
// truth for both the running app and the drizzle/seed CLI scripts.
// eslint-disable-next-line @typescript-eslint/no-require-imports
require("dotenv").config({ path: ".env" });
require("./.next/standalone/server.js");
