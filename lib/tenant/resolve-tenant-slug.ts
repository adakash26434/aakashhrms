/**
 * Shared tenant slug resolution utility.
 * 
 * Single source of truth for extracting a tenant slug from a host string.
 * All code that needs to resolve a tenant from a hostname should import
 * this function instead of implementing its own parsing logic.
 * 
 * This consolidation addresses Finding 2.1 from the security audit:
 * duplicated subdomain-parsing logic was found in lib/db/index.ts,
 * lib/auth/index.ts, and app/(dashboard)/onboarding/page.tsx.
 */

/**
 * Extracts a tenant subdomain slug from a host string.
 *
 * Examples:
 *   "acme.localhost:3000"        -> "acme"
 *   "himalayan.aakashhrms.com"   -> "himalayan"
 *   "localhost:3000"             -> null  (root domain, no tenant)
 *   "platform.localhost:3000"    -> null  (reserved subdomain)
 *   "127.0.0.1:3000"            -> null  (IP address, no tenant)
 *
 * Reserved subdomains ("platform", "admin") return null because they
 * are used by the Super Admin control plane, not by tenants.
 */
export function extractSubdomainFromHost(host: string | null): string | null {
  if (!host) return null;

  const cleanHost = host.split(':')[0].toLowerCase();
  const rootDomain = (process.env.ROOT_DOMAIN || 'localhost:3000').split(':')[0].toLowerCase();

  // Exact match on root domain or bare localhost/IP — no subdomain
  if (cleanHost === rootDomain || cleanHost === 'localhost' || cleanHost === '127.0.0.1') {
    return null;
  }

  // Handle *.localhost wildcard (local dev, e.g. acme.localhost)
  if (cleanHost.endsWith('.localhost')) {
    const parts = cleanHost.split('.');
    if (
      parts.length >= 2 &&
      parts[parts.length - 1] === 'localhost' &&
      parts[0] !== 'platform' &&
      parts[0] !== 'admin'
    ) {
      return parts[0];
    }
    return null;
  }

  // Handle production wildcard domain (e.g. acme.aakashhrms.com)
  if (cleanHost.endsWith(`.${rootDomain}`)) {
    const sub = cleanHost.replace(`.${rootDomain}`, '');
    if (sub && sub !== 'platform' && sub !== 'admin') {
      return sub;
    }
  }

  return null;
}
