/**
 * Resolves the client IP for rate limiting (S5).
 *
 * `X-Forwarded-For` is a comma-separated list where each proxy APPENDS the
 * address it received the request from. The left-most entries are whatever
 * the client chose to send and can be forged; only the entries appended by
 * our own proxies are trustworthy. With N trusted proxy hops in front of the
 * app (Apache/Passenger on cPanel = 1, add 1 for Cloudflare, etc.), the client
 * address is the N-th entry from the right.
 *
 * Configure with TRUSTED_PROXY_HOPS (default 1). Set 0 when the app is exposed
 * directly, in which case forwarding headers are ignored entirely.
 */

type HeaderSource = { get(name: string): string | null } | undefined | null;

export function getTrustedProxyHops(): number {
  const raw = Number.parseInt(process.env.TRUSTED_PROXY_HOPS ?? '1', 10);
  return Number.isFinite(raw) && raw >= 0 ? raw : 1;
}

export function getClientIp(headers: HeaderSource, trustedHops = getTrustedProxyHops()): string {
  if (!headers || trustedHops === 0) return 'unknown';

  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    const hops = forwarded
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
    if (hops.length > 0) {
      // N-th from the right; if the chain is shorter than expected, the
      // left-most entry is the best we have (it was added by our proxy).
      const index = Math.max(0, hops.length - trustedHops);
      return hops[index];
    }
  }

  // X-Real-IP is set (not appended) by a single trusted proxy.
  const realIp = headers.get('x-real-ip')?.trim();
  return realIp || 'unknown';
}
