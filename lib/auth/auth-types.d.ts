import NextAuth, { type DefaultSession } from "next-auth";
import { JWT } from "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      roleId: string | null;
      tenantSlug: string | null;
      scopeType: string | null;
      employeeId: string | null;
      mustChangePassword?: boolean;
      /** Idle lock (2.8): set by the server-signed session update flow. */
      locked?: boolean;
      lockedAt?: number;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    roleId: string | null;
    tenantSlug?: string | null;
    scopeType?: string | null;
    employeeId?: string | null;
    mustChangePassword?: boolean;
    locked?: boolean;
    lockedAt?: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    roleId: string | null;
    tenantSlug?: string | null;
    scopeType?: string | null;
    employeeId?: string | null;
    mustChangePassword?: boolean;
    locked?: boolean;
    lockedAt?: number;
  }
}