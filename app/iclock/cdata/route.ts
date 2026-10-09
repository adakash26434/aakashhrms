import { NextResponse } from 'next/server';
import { resolveDeviceTenantAndRun } from '@/lib/services/device-tenant';
import { deviceHandshake, devicePush } from '@/lib/services/device.service';

// ZKTeco ADMS / iclock endpoint (G3). The path is fixed by the devices
// themselves (they always call /iclock/cdata on the configured host), so it
// lives at the root; proxy.ts skips /iclock like /api, and this handler does
// its own checks: a registered, enabled serial number or a bare 404. The
// response is plain text exactly as devices expect; body size is capped.
// Punches are raw data — nothing here changes attendance results, which stay
// with the 4.5 day engine and HR review.

export const dynamic = 'force-dynamic';

const text = (body: string) => new NextResponse(body, { status: 200, headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' } });
const NOT_FOUND = () => new NextResponse(null, { status: 404, headers: { 'Cache-Control': 'no-store' } });

const MAX_BODY = 2_000_000; // ~5k punches; devices push in far smaller batches

export async function GET(request: Request) {
  const url = new URL(request.url);
  const sn = url.searchParams.get('SN') ?? '';
  const result = await resolveDeviceTenantAndRun(sn, () => deviceHandshake(sn));
  return result === null ? NOT_FOUND() : text(result);
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const sn = url.searchParams.get('SN') ?? '';
  const table = url.searchParams.get('table') ?? '';

  const declared = Number(request.headers.get('content-length') ?? 0);
  if (declared > MAX_BODY) return NOT_FOUND();
  const body = await request.text();
  if (body.length > MAX_BODY) return NOT_FOUND();

  const result = await resolveDeviceTenantAndRun(sn, () => devicePush(sn, table, body));
  if (result === null) return NOT_FOUND();
  return text(`OK: ${result.matched + result.unmatched}`);
}
