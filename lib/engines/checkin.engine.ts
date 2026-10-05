// Web clock-in (4.5c): where an employee may clock in from. A branch rule
// says what is checked (office network, office location, either, both,
// anywhere, or off); the server decides from the client's IP (trusted proxy
// hops) and the location the browser reports, working the distance out
// itself (Haversine) and allowing for the reported accuracy. Outside the
// allowed place the punch goes for approval. Pure: no database access.

export const CHECKIN_RULES = ["off", "anywhere", "network", "location", "network_or_location", "network_and_location"] as const;
export type CheckinRule = (typeof CHECKIN_RULES)[number];

export const CHECKIN_RULE_LABEL: Record<CheckinRule, string> = {
  off: "Off (no web clock-in)",
  anywhere: "Anywhere",
  network: "Office network",
  location: "Office location",
  network_or_location: "Office network or location",
  network_and_location: "Office network and location",
};

export const DEFAULT_RADIUS_M = 150;
/** Accuracy counted in the employee's favour, at most. */
export const ACCURACY_ALLOWANCE_M = 50;
/** Worse than this the location is too rough to decide (desktops on Wi-Fi often are). */
export const MAX_ACCURACY_M = 500;
/** One punch a minute: a double tap does nothing. */
export const MIN_GAP_SECONDS = 60;

// ---------------------------------------------------------------------------
// Networks (IPv4 / IPv6 addresses and ranges)
// ---------------------------------------------------------------------------

type Parsed = { v: 4 | 6; bits: bigint; prefix: number };

function parseIpv4(s: string): bigint | null {
  const parts = s.split(".");
  if (parts.length !== 4) return null;
  let n = BigInt(0);
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p) || Number(p) > 255) return null;
    n = (n << BigInt(8)) | BigInt(Number(p));
  }
  return n;
}

function parseIpv6(s: string): bigint | null {
  let text = s.toLowerCase();
  // An IPv4 tail (::ffff:10.0.0.1) becomes two hex groups.
  const v4 = /(\d{1,3}(?:\.\d{1,3}){3})$/.exec(text);
  if (v4) {
    const n = parseIpv4(v4[1]);
    if (n === null) return null;
    text = text.slice(0, -v4[1].length) + `${(n >> BigInt(16)).toString(16)}:${(n & BigInt(0xffff)).toString(16)}`;
  }
  const halves = text.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missing = 8 - head.length - tail.length;
  if (halves.length === 1 ? head.length !== 8 : missing < 1) return null;
  const groups = [...head, ...Array(halves.length === 2 ? missing : 0).fill("0"), ...tail];
  let n = BigInt(0);
  for (const g of groups) {
    if (!/^[0-9a-f]{1,4}$/.test(g)) return null;
    n = (n << BigInt(16)) | BigInt(parseInt(g, 16));
  }
  return n;
}

function parseAddress(s: string): { v: 4 | 6; bits: bigint } | null {
  const t = s.trim();
  // An IPv4-mapped IPv6 address is the IPv4 address.
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(t);
  if (mapped) {
    const n = parseIpv4(mapped[1]);
    return n === null ? null : { v: 4, bits: n };
  }
  if (t.includes(":")) {
    const n = parseIpv6(t);
    return n === null ? null : { v: 6, bits: n };
  }
  const n = parseIpv4(t);
  return n === null ? null : { v: 4, bits: n };
}

/** An address or range ("103.10.28.5", "103.10.28.0/24", "2400:1a00::/32"); null when not valid. */
export function parseNetwork(s: string): Parsed | null {
  const [addr, prefixText, extra] = s.trim().split("/");
  if (extra !== undefined || !addr) return null;
  const a = parseAddress(addr);
  if (!a) return null;
  const max = a.v === 4 ? 32 : 128;
  const prefix = prefixText === undefined ? max : /^\d{1,3}$/.test(prefixText) ? Number(prefixText) : NaN;
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > max) return null;
  return { v: a.v, bits: a.bits, prefix };
}

/** Whether an IP is inside any of the networks (bad entries never match). */
export function ipInNetworks(ip: string, networks: readonly string[]): boolean {
  const a = parseAddress(ip);
  if (!a) return false;
  return networks.some((n) => {
    const net = parseNetwork(n);
    if (!net || net.v !== a.v) return false;
    const width = a.v === 4 ? 32 : 128;
    const shift = BigInt(width - net.prefix);
    return a.bits >> shift === net.bits >> shift;
  });
}

// ---------------------------------------------------------------------------
// Location
// ---------------------------------------------------------------------------

/** Metres between two points (Haversine, mean Earth radius). */
export function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371008.8;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export interface ReportedLocation {
  lat: number;
  lng: number;
  /** Metres (the browser's own estimate). */
  accuracy: number;
}

/** A location from the browser, range-checked; null when it is not one. */
export function parseLocation(raw: unknown): ReportedLocation | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.lat !== "number" || typeof r.lng !== "number" || typeof r.accuracy !== "number") return null;
  const { lat, lng, accuracy } = r as { lat: number; lng: number; accuracy: number };
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(accuracy)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180 || accuracy < 0 || accuracy > 100000) return null;
  return { lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6, accuracy: Math.round(accuracy) };
}

/** Inside the radius, counting up to 50 m of the reported accuracy in the employee's favour; too rough to tell over 500 m. */
export function checkLocation(distance: number, accuracy: number, radius: number): "inside" | "outside" | "too_rough" {
  if (accuracy > MAX_ACCURACY_M) return "too_rough";
  return distance - Math.min(accuracy, ACCURACY_ALLOWANCE_M) <= radius ? "inside" : "outside";
}

// ---------------------------------------------------------------------------
// The decision
// ---------------------------------------------------------------------------

export interface BranchPlace {
  name: string;
  rule: CheckinRule;
  networks: readonly string[];
  /** The office point (null when not set). */
  point: { lat: number; lng: number } | null;
  radiusM: number;
}

export interface ClockDecision {
  /** off: web clock-in is not available; punch: saved now; remote: outside, can go for approval. */
  outcome: "off" | "punch" | "remote";
  /** How the place was confirmed (for the punch note). */
  place: "network" | "location" | "anywhere" | "exception" | null;
  /** Plain words: why. */
  reason: string;
  distanceM: number | null;
}

const km = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`);

/**
 * Where this clock-in stands: off, a punch now (office network / location /
 * anywhere / an allowed-anywhere exception), or remote (outside: it can be
 * sent for approval). The server's own IP and distance decide.
 */
export function decideClock(p: { companyEnabled: boolean; branch: BranchPlace; ip: string; location: ReportedLocation | null; exception: boolean }): ClockDecision {
  const { branch } = p;
  if (!p.companyEnabled || branch.rule === "off") return { outcome: "off", place: null, reason: "Web clock-in is not switched on for your branch. Ask HR.", distanceM: null };
  const distance = p.location && branch.point ? Math.round(distanceMeters(p.location, branch.point)) : null;
  if (branch.rule === "anywhere") return { outcome: "punch", place: "anywhere", reason: "Clock-in from anywhere", distanceM: distance };
  if (p.exception) return { outcome: "punch", place: "exception", reason: "Allowed to clock in from anywhere", distanceM: distance };

  const onNetwork = ipInNetworks(p.ip, branch.networks);
  const needsLocation = branch.rule !== "network";
  let locationState: "inside" | "outside" | "too_rough" | "missing" | "not_set" = "missing";
  if (needsLocation) {
    if (!branch.point) locationState = "not_set";
    else if (p.location && distance !== null) locationState = checkLocation(distance, p.location.accuracy, branch.radiusM);
  }
  const atLocation = locationState === "inside";
  const ok =
    branch.rule === "network" ? onNetwork : branch.rule === "location" ? atLocation : branch.rule === "network_or_location" ? onNetwork || atLocation : onNetwork && atLocation;
  if (ok) {
    const place = branch.rule === "network" || (branch.rule === "network_or_location" && onNetwork) ? "network" : "location";
    return { outcome: "punch", place, reason: place === "network" ? `Office network (${branch.name})` : `${km(distance ?? 0)} from ${branch.name}`, distanceM: distance };
  }
  // Outside: say what was missing, one sentence each.
  const why: string[] = [];
  if (branch.rule !== "location" && !onNetwork) why.push(`You are not on ${branch.name}'s office network.`);
  if (needsLocation && !(branch.rule === "network_and_location" && !onNetwork && locationState === "inside")) {
    if (locationState === "not_set") why.push(`${branch.name}'s office location is not set yet.`);
    else if (locationState === "missing") why.push("Your location was not shared.");
    else if (locationState === "too_rough") why.push(`Your location is too rough to tell (±${km(p.location!.accuracy)}); try on a phone, or near a window.`);
    else if (locationState === "outside") why.push(`You are ${km(distance!)} from ${branch.name} (allowed ${km(branch.radiusM)}).`);
  }
  return { outcome: "remote", place: null, reason: why.join(" "), distanceM: distance };
}

/** In or out next: even punches today (counting waiting remote ones) = in, odd = out. */
export function nextKind(todayCount: number): "in" | "out" {
  return todayCount % 2 === 0 ? "in" : "out";
}
