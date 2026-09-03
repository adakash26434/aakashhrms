// eslint-disable-next-line @typescript-eslint/no-require-imports
require("dotenv").config({ path: ".env" });

// Force binding to 0.0.0.0 and port 3000 for Yeti Cloud / Jelastic reverse proxy
const targetPort =
  process.env.PORT === "8080" || !process.env.PORT ? "3000" : process.env.PORT;
process.env.PORT = targetPort;
process.env.HOSTNAME = "0.0.0.0";

// eslint-disable-next-line @typescript-eslint/no-require-imports
require("./.next/standalone/server.js");
