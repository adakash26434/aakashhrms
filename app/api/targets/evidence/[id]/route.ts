import { NextResponse } from 'next/server';
import { ensureTenantContext } from '@/lib/db';
import { checkPermissionWithScope } from '@/lib/auth/check-permission';
import { getSessionEmployeeId } from '@/lib/services/self-service.service';
import { toActionError } from '@/lib/errors/action-error';
import { openEvidence, type Viewer } from '@/lib/services/target.service';
import type { ScopeFilter } from '@/lib/auth/scope-filter';

const NOT_FOUND = () => NextResponse.json({ success: false, error: 'Not found.' }, { status: 404 });

/**
 * One evidence file (S42): the employee it belongs to, their supervisor, or an
 * office user with View on Targets within scope. Always sent as a download with
 * the type found in its content, never shown as a page on this site; never cached.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await ensureTenantContext();
  try {
    let scope: ScopeFilter | null = null;
    try {
      scope = await checkPermissionWithScope('VIEW', 'TARGETS');
    } catch {
      scope = null; // not an office reader; the portal session may still own or supervise it
    }
    let self: { employeeId: string; userId: string } | null = null;
    try {
      self = await getSessionEmployeeId();
    } catch {
      self = null;
    }
    const userId = scope?.userId ?? self?.userId;
    if (!userId) return NextResponse.json({ success: false, error: 'Forbidden: sign in first.' }, { status: 403 });
    const viewer: Viewer = { userId, employeeId: self?.employeeId ?? scope?.employeeId ?? null, scope };

    const { id } = await params;
    const file = await openEvidence(id, viewer);
    if (!file) return NOT_FOUND();
    const ascii = file.name.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
    return new NextResponse(new Uint8Array(file.content), {
      status: 200,
      headers: {
        'Content-Type': file.mime,
        'Content-Length': String(file.content.length),
        'Content-Disposition': `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(file.name)}`,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    const failure = toActionError(error, 'targets.open');
    return NextResponse.json(failure, { status: failure.ref ? 500 : 403 });
  }
}
