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
  return tenantContextStorage.run(context, fn);
}

export function getCurrentTenantContext(): TenantContext | undefined {
  return tenantContextStorage.getStore();
}

/**
 * Sets a global fallback tenant DB for the current request lifecycle.
 * This is used as a safety net when AsyncLocalStorage context is unavailable
 * (e.g. in server actions that execute outside the layout's render scope).
 */
let _requestScopeTenantDb: PostgresJsDatabase<typeof schema> | null = null;
let _requestScopeTenantSlug: string | null = null;

export function setRequestScopeTenantDb(slug: string, db: PostgresJsDatabase<typeof schema>) {
  _requestScopeTenantDb = db;
  _requestScopeTenantSlug = slug;
}

export function getRequestScopeTenantDb(): { slug: string; db: PostgresJsDatabase<typeof schema> } | null {
  if (_requestScopeTenantDb && _requestScopeTenantSlug) {
    return { slug: _requestScopeTenantSlug, db: _requestScopeTenantDb };
  }
  return null;
}

export function clearRequestScopeTenantDb() {
  _requestScopeTenantDb = null;
  _requestScopeTenantSlug = null;
}
