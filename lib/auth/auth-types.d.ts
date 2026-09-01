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
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    roleId: string | null;
    tenantSlug?: string | null;
    scopeType?: string | null;
    employeeId?: string | null;
    mustChangePassword?: boolean;
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
  }
}