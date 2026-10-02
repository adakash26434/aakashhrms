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
