import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Normalize NODE_ENV to strip trailing whitespace or CRLF from cloud/cPanel env files
const envObj = process.env as Record<string, string | undefined>;
if (envObj.NODE_ENV) {
  envObj.NODE_ENV = envObj.NODE_ENV.trim().replace(/\r/g, "");
}
if (process.env.npm_lifecycle_event === "build" || process.argv.includes("build")) {
  envObj.NODE_ENV = "production";
}

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  typescript: {
    // Verified via `npm run type-check` and tests. Prevents OOM crashes in memory-constrained cloud containers.
    ignoreBuildErrors: true,
  },
  // Explicitly enable Turbopack alongside webpack fallback for cPanel
  turbopack: {
    root: projectRoot,
  },
  output: "standalone",
  images: {
    unoptimized: true,
  },
  // cPanel/CloudLinux LVE limits process memory and the single-worker build
  // (see experimental.cpus below) takes longer, so give it more headroom.
  staticPageGenerationTimeout: 300,
  experimental: {
    cpus: 1,
    serverMinification: false,
    optimizePackageImports: [
      "lucide-react",
      "recharts",
      "nepali-date-library",
      "decimal.js",
      "libphonenumber-js",
      "clsx",
      "tailwind-merge",
    ],
  },
  // Security headers for production hardening.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          ...(process.env.FORCE_SSL === "true"
            ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" }]
            : [{ key: "Strict-Transport-Security", value: "max-age=0" }]),
        ],
      },
    ];
  },
  webpack: (config) => {
    config.resolve ??= {};
    config.resolve.alias = {
      ...config.resolve.alias,
      "@": projectRoot,
    };
    return config;
  },
  async redirects() {
    return [
      // Section Roots
      { source: "/payroll", destination: "/payroll/generate", permanent: false },
      { source: "/timeAndLeave", destination: "/timeAndLeave/attendance", permanent: false },
      { source: "/time-and-leave", destination: "/timeAndLeave/attendance", permanent: false },
      { source: "/time-and-leave/:path*", destination: "/timeAndLeave/:path*", permanent: false },
      { source: "/workforce", destination: "/workforce/employees", permanent: false },
      { source: "/admin", destination: "/admin/users", permanent: false },

      // Shorthand Shortcuts
      { source: "/employees", destination: "/workforce/employees", permanent: false },
      { source: "/departments", destination: "/workforce/departments", permanent: false },
      { source: "/salary-mapping", destination: "/workforce/salary-mapping", permanent: false },
      { source: "/attendance", destination: "/timeAndLeave/attendance", permanent: false },
      { source: "/leave-types", destination: "/timeAndLeave/leave-types", permanent: false },
      { source: "/leave-rules", destination: "/timeAndLeave/leave-rules", permanent: false },
      { source: "/applications", destination: "/timeAndLeave/applications", permanent: false },
      { source: "/approvals", destination: "/timeAndLeave/approvals", permanent: false },
      { source: "/ot-rules", destination: "/timeAndLeave/ot-rules", permanent: false },
      { source: "/system-control", destination: "/setup/payroll-rules?tab=rules-defaults", permanent: false },
      { source: "/fiscal-year", destination: "/setup/payroll-rules?tab=fiscal-year", permanent: false },
      { source: "/tax-rates", destination: "/setup/payroll-rules?tab=tax-rates", permanent: false },
      { source: "/pay-heads", destination: "/setup/payroll-rules?tab=pay-heads", permanent: false },
      { source: "/holidays", destination: "/setup/holidays", permanent: false },
      { source: "/users", destination: "/admin/users", permanent: false },
      { source: "/roles", destination: "/admin/roles", permanent: false },
      { source: "/audit-log", destination: "/admin/audit-log", permanent: false },
    ];
  },
};

export default nextConfig;
