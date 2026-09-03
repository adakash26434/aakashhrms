import { AsyncLocalStorage } from 'async_hooks';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type * as schema from './schema';

export interface TenantContext {
  tenantSlug: string;
  companyCode?: string;
  db: PostgresJsDatabase<typeof schema>;
}

export const tenantContextStorage = new AsyncLocalStorage<TenantContext>();

export function runWithTenantContext<T>(
  context: TenantContext,
  fn: () => T | Promise<T>
): T | Promise<T> {
  // Also seed the global request scope so any un-scoped async child promises can resolve
  setRequestScopeTenantDb(context.tenantSlug, context.db);
  return tenantContextStorage.run(context, fn);
}

export function getCurrentTenantContext(): TenantContext | undefined {
  return tenantContextStorage.getStore();
}

/**
 * Sets a global fallback tenant DB for the current request lifecycle.
 * Uses globalThis so that it persists reliably across Next.js / Turbopack bundle boundaries.
 */
const globalForTenant = globalThis as unknown as {
  _requestScopeTenantDb?: PostgresJsDatabase<typeof schema> | null;
  _requestScopeTenantSlug?: string | null;
};

export function setRequestScopeTenantDb(slug: string, db: PostgresJsDatabase<typeof schema>) {
  globalForTenant._requestScopeTenantDb = db;
  globalForTenant._requestScopeTenantSlug = slug;
}

export function getRequestScopeTenantDb(): { slug: string; db: PostgresJsDatabase<typeof schema> } | null {
  if (globalForTenant._requestScopeTenantDb && globalForTenant._requestScopeTenantSlug) {
    return { slug: globalForTenant._requestScopeTenantSlug, db: globalForTenant._requestScopeTenantDb };
  }
  return null;
}

export function clearRequestScopeTenantDb() {
  globalForTenant._requestScopeTenantDb = null;
  globalForTenant._requestScopeTenantSlug = null;
}
