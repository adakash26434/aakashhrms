/**
 * Cross-site request check for route handlers that change data (S25). Server
 * actions get this from Next.js; a route handler with cookie auth must check
 * it itself, or another site could post to it with the user's session.
 *
 * Same origin = the browser says so (Sec-Fetch-Site, when sent) and the Origin
 * header names this host (X-Forwarded-Host behind the cPanel proxy, else Host).
 * A request without an Origin is refused: browsers always send it on POST.
 */
export function isSameOriginRequest(headers: Headers): boolean {
  const site = headers.get("sec-fetch-site");
  if (site && site !== "same-origin") return false;
  const origin = headers.get("origin");
  if (!origin) return false;
  let originHost: string;
  try {
    originHost = new URL(origin).host.toLowerCase();
  } catch {
    return false;
  }
  const host = (headers.get("x-forwarded-host")?.split(",")[0] ?? headers.get("host") ?? "").trim().toLowerCase();
  return host !== "" && originHost === host;
}
