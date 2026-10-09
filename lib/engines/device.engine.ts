// Attendance devices (G3, docs/redesign/06-hrms-gap-analysis.md): pure
// ADMS / iclock parsing — no database access, unit-tested in
// tests/device.engine.test.ts.
//
// A ZKTeco-class terminal set to "ADMS" / cloud server pushes its data:
//   GET  /iclock/cdata?SN=<serial>&options=all   — handshake; we answer the
//        registry block so the device starts pushing.
//   POST /iclock/cdata?SN=<serial>&table=ATTLOG  — one punch per line:
//        PIN<TAB>YYYY-MM-DD HH:MM:SS<TAB>status<TAB>verify[...]
//        the time is the DEVICE'S LOCAL clock; the device's registered
//        tz offset converts it to an instant.
//   GET  /iclock/getrequest?SN=<serial>          — command poll; "OK" = none.
// Other tables (OPERLOG, USERINFO…) are acknowledged and ignored.

export interface ParsedPunch {
  deviceUserId: string;
  /** The punch instant (UTC), from the device-local time and tz offset. */
  punchedAt: Date;
  /** The original line, for the unmatched list. */
  raw: string;
}

/** Serial numbers as devices send them: letters, digits, a few separators. */
export function isValidSerial(sn: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9_-]{3,59}$/.test(sn);
}

const LOCAL_TIME = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/;

/** A device-local "YYYY-MM-DD HH:MM:SS" to an instant, given the device's offset from UTC in minutes. */
export function localTimeToInstant(local: string, tzOffsetMinutes: number): Date | null {
  const m = LOCAL_TIME.exec(local.trim());
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m;
  const utcMs = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s)) - tzOffsetMinutes * 60000;
  const date = new Date(utcMs);
  // Refuse nonsense the device could not have produced (clock resets to 2000, far future).
  if (date.getUTCFullYear() < 2010 || date.getUTCFullYear() > 2100) return null;
  return date;
}

/**
 * Parses an ATTLOG body: one punch per line, tab-separated, PIN then local
 * time; extra fields (status, verify mode, workcode) are ignored. Malformed
 * lines are counted, never fatal — a push is a batch and the rest must land.
 */
export function parseAttlog(body: string, tzOffsetMinutes: number): { punches: ParsedPunch[]; malformed: number } {
  const punches: ParsedPunch[] = [];
  let malformed = 0;
  for (const rawLine of body.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const parts = line.split('\t');
    const deviceUserId = (parts[0] ?? '').trim();
    const punchedAt = localTimeToInstant(parts[1] ?? '', tzOffsetMinutes);
    if (!deviceUserId || !/^[A-Za-z0-9._-]{1,30}$/.test(deviceUserId) || !punchedAt) {
      malformed += 1;
      continue;
    }
    punches.push({ deviceUserId, punchedAt, raw: line.slice(0, 200) });
  }
  return { punches, malformed };
}

/** De-duplicates a batch on (PIN, instant) — devices resend on weak networks. */
export function dedupePunches(punches: ParsedPunch[]): ParsedPunch[] {
  const seen = new Set<string>();
  const out: ParsedPunch[] = [];
  for (const p of punches) {
    const key = `${p.deviceUserId}@${p.punchedAt.getTime()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

/**
 * The handshake body a device expects on GET cdata?options=all. Stamp=9999…
 * asks the device to push everything it still holds; realtime pushes punches
 * as they happen.
 */
export function handshakeResponse(serialNo: string): string {
  return [
    `GET OPTION FROM: ${serialNo}`,
    'ATTLOGStamp=None',
    'OPERLOGStamp=9999',
    'ATTPHOTOStamp=None',
    'ErrorDelay=30',
    'Delay=10',
    'TransTimes=00:00;14:00',
    'TransInterval=1',
    'TransFlag=TransData AttLog',
    'TimeZone=5.75',
    'Realtime=1',
    'Encrypt=None',
  ].join('\r\n');
}

/** How a device looks on the health card. */
export function deviceHealth(lastSeenAt: Date | null, now: Date): 'online' | 'quiet' | 'silent' | 'never' {
  if (!lastSeenAt) return 'never';
  const minutes = (now.getTime() - lastSeenAt.getTime()) / 60000;
  if (minutes <= 15) return 'online';
  if (minutes <= 24 * 60) return 'quiet';
  return 'silent';
}
