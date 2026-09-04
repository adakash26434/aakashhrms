// eslint-disable-next-line @typescript-eslint/no-require-imports
require("dotenv").config({ path: ".env" });
// eslint-disable-next-line @typescript-eslint/no-require-imports
const http = require("http");

// Native Next.js standalone server port
const appPort = 3000;
process.env.PORT = String(appPort);
process.env.HOSTNAME = "0.0.0.0";

// Start Next.js standalone server on port 3000
// eslint-disable-next-line @typescript-eslint/no-require-imports
require("./.next/standalone/server.js");

// Jelastic / Yeti Cloud Shared Load Balancer (SLB) defaults to port 8080 for Node.js.
// Start a lightweight, robust forwarder on 8080 -> 3000 so BOTH ports are always active.
const proxyPort = 8080;
const proxyServer = http.createServer((req, res) => {
  const options = {
    hostname: "127.0.0.1",
    port: appPort,
    path: req.url,
    method: req.method,
    headers: req.headers,
  };

  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });

  proxyReq.on("error", (err) => {
    if (!res.headersSent) {
      res.writeHead(502, { "Content-Type": "text/plain" });
      res.end("Next.js app starting or unavailable: " + err.message);
    }
  });

  req.pipe(proxyReq, { end: true });
});

proxyServer.on("error", (err) => {
  // If port 8080 is already bound by container reverse-proxy, log cleanly
  console.log(`[Proxy 8080] Notice on port 8080: ${err.message}`);
});

try {
  proxyServer.listen(proxyPort, "0.0.0.0", () => {
    console.log(`✓ Dual-port active: listening on port ${proxyPort} -> forwarding to port ${appPort}`);
  });
} catch (listenErr) {
  console.log(`[Proxy 8080] Listen error handled: ${listenErr.message}`);
}
