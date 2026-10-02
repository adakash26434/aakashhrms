// Content-Security-Policy (security plan S6).
//
// Scripts are locked to a per-request nonce: proxy.ts generates it, sends the
// policy on the request (Next.js reads the nonce from it and stamps its own
// <script> tags) and on the response (the browser enforces it). That needs
// dynamic rendering, which the root layout already forces.
//
// Styles allow 'unsafe-inline' on purpose. React renders style="" attributes
// (progress widths, chart sizing) and nonces cannot cover attributes. Do not
// add a nonce to style-src: when a nonce is present, browsers ignore
// 'unsafe-inline' and every inline style would break.

export interface CspOptions {
  nonce: string;
  /** Development needs 'unsafe-eval' for React's error overlay and HMR. */
  isDev?: boolean;
  /** Only when the site is served over HTTPS (FORCE_SSL=true). */
  upgradeInsecureRequests?: boolean;
}

/** 128-bit random nonce, base64. Uses Web Crypto so it runs in any runtime. */
export function generateCspNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function buildContentSecurityPolicy({
  nonce,
  isDev = false,
  upgradeInsecureRequests = false,
}: CspOptions): string {
  if (!/^[A-Za-z0-9+/_-]+={0,2}$/.test(nonce)) {
    throw new Error("Invalid CSP nonce");
  }

  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", ...(isDev ? ["'unsafe-eval'"] : [])],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:"],
    "font-src": ["'self'", "data:"],
    "connect-src": ["'self'", ...(isDev ? ["ws:", "wss:"] : [])],
    "media-src": ["'self'"],
    "worker-src": ["'self'", "blob:"],
    "frame-src": ["'self'", "blob:"],
    "manifest-src": ["'self'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };

  const policy = Object.entries(directives).map(([name, sources]) => `${name} ${sources.join(" ")}`);
  if (upgradeInsecureRequests) policy.push("upgrade-insecure-requests");
  return policy.join("; ");
}

/** Policy for JSON API responses: nothing may load, nothing may frame them. */
export const API_CONTENT_SECURITY_POLICY = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'";
