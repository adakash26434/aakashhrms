// Server-signed session updates (security plan S14, idle lock 2.8).
//
// NextAuth lets the *browser* trigger a JWT update (POST /api/auth/session
// with any JSON body), and the jwt() callback receives that body as
// `session`. Anything that relaxes a restriction (clearing the forced password
// change, unlocking an idle-locked session) must therefore carry a grant that
// only the server can produce: an HMAC over the user id, purpose, context and
// a short expiry, keyed from AUTH_SECRET. Tightening (locking) needs no grant.
//
// Web Crypto only, so this runs wherever the jwt() callback runs.

export type SessionGrantPurpose = "password-changed" | "unlock";

export interface SessionGrant {
  userId: string;
  purpose: SessionGrantPurpose;
  /** Binds the grant to one specific state, e.g. the lock it releases. */
  context: string;
  /** Expiry, epoch milliseconds. */
  exp: number;
  sig: string;
}

/** Shape of the token fields this module reads and writes. */
export interface LockableToken {
  id?: string;
  mustChangePassword?: boolean;
  locked?: boolean;
  lockedAt?: number;
}

const GRANT_TTL_MS = 60_000;
const encoder = new TextEncoder();

function authSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not configured");
  return secret;
}

async function hmacHex(message: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(`session-grant:v1:${secret}`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(message)));
  return Array.from(signature, (b) => b.toString(16).padStart(2, "0")).join("");
}

function grantMessage(g: Omit<SessionGrant, "sig">): string {
  return JSON.stringify([g.userId, g.purpose, g.context, g.exp]);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function signSessionGrant(
  userId: string,
  purpose: SessionGrantPurpose,
  context = "",
  { now = Date.now(), secret = authSecret() }: { now?: number; secret?: string } = {}
): Promise<SessionGrant> {
  const unsigned = { userId, purpose, context, exp: now + GRANT_TTL_MS };
  return { ...unsigned, sig: await hmacHex(grantMessage(unsigned), secret) };
}

export async function verifySessionGrant(
  grant: unknown,
  expected: { userId: string; purpose: SessionGrantPurpose; context?: string },
  { now = Date.now(), secret = authSecret() }: { now?: number; secret?: string } = {}
): Promise<boolean> {
  if (!grant || typeof grant !== "object") return false;
  const g = grant as Partial<SessionGrant>;
  if (
    typeof g.userId !== "string" ||
    typeof g.purpose !== "string" ||
    typeof g.context !== "string" ||
    typeof g.exp !== "number" ||
    typeof g.sig !== "string"
  ) {
    return false;
  }
  if (g.userId !== expected.userId || g.purpose !== expected.purpose) return false;
  if (g.context !== (expected.context ?? "")) return false;
  if (g.exp < now || g.exp > now + GRANT_TTL_MS) return false;
  const sig = await hmacHex(grantMessage({ userId: g.userId, purpose: g.purpose, context: g.context, exp: g.exp }), secret);
  return timingSafeEqual(sig, g.sig);
}

/**
 * Applies a client- or server-triggered session update to the JWT.
 * Only three things are honoured:
 *   { lock: true }                       → lock (anyone may lock themselves)
 *   { grant: <password-changed grant> }  → clear the forced password change
 *   { grant: <unlock grant> }            → unlock the current lock
 * Everything else in the payload (including user.mustChangePassword) is ignored.
 */
export async function applySessionUpdate<T extends LockableToken>(
  token: T,
  update: unknown,
  options: { now?: number; secret?: string } = {}
): Promise<T> {
  if (!update || typeof update !== "object" || !token.id) return token;
  const payload = update as { lock?: unknown; grant?: unknown };
  const now = options.now ?? Date.now();

  if (payload.lock === true && !token.locked) {
    token.locked = true;
    token.lockedAt = now;
  }

  if (payload.grant) {
    if (await verifySessionGrant(payload.grant, { userId: token.id, purpose: "password-changed" }, options)) {
      token.mustChangePassword = false;
    } else if (
      token.locked &&
      (await verifySessionGrant(
        payload.grant,
        { userId: token.id, purpose: "unlock", context: String(token.lockedAt ?? "") },
        options
      ))
    ) {
      token.locked = false;
      delete token.lockedAt;
    }
  }

  return token;
}

/**
 * Defence in depth for server actions. Actions can be POSTed from any page,
 * including /locked and /change-password, so permission helpers refuse a
 * session that is locked or still owes a password change.
 */
export function assertSessionUsable(
  user: { locked?: boolean; mustChangePassword?: boolean } | undefined
): void {
  if (user?.locked) {
    throw new Error("Unauthorized: Session is locked");
  }
  if (user?.mustChangePassword) {
    throw new Error("Unauthorized: Password change required");
  }
}
