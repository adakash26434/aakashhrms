import { NextResponse } from 'next/server';
import { resolveDeviceTenantAndRun } from '@/lib/services/device-tenant';
import { devicePoll } from '@/lib/services/device.service';

// ZKTeco ADMS / iclock command poll (G3): the device asks for commands every
// few seconds; "OK" means none. Registered + enabled serials only (else 404).

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const sn = url.searchParams.get('SN') ?? '';
  const result = await resolveDeviceTenantAndRun(sn, () => devicePoll(sn));
  if (result === null) return new NextResponse(null, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  return new NextResponse(result, { status: 200, headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' } });
}
