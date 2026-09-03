import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
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
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
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
      { source: "/setup", destination: "/setup/system-control", permanent: false },
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
      { source: "/system-control", destination: "/setup/system-control", permanent: false },
      { source: "/fiscal-year", destination: "/setup/fiscal-year", permanent: false },
      { source: "/tax-rates", destination: "/setup/tax-rates", permanent: false },
      { source: "/pay-heads", destination: "/setup/pay-heads", permanent: false },
      { source: "/holidays", destination: "/setup/holidays", permanent: false },
      { source: "/users", destination: "/admin/users", permanent: false },
      { source: "/roles", destination: "/admin/roles", permanent: false },
      { source: "/audit-log", destination: "/admin/audit-log", permanent: false },
    ];
  },
};

export default nextConfig;
