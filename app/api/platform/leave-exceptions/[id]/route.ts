import { NextResponse } from 'next/server';
import { requirePlatformAuth } from '@/lib/platform/auth';
import { revokeException, exceptionFailure } from '@/lib/platform/leave-exceptions';

export const dynamic = 'force-dynamic';

/** Revokes an exception (reason required); the company's setting goes back to the law. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePlatformAuth(request);
  if (actor instanceof NextResponse) return actor;
  try {
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as { reason?: unknown };
    const r = await revokeException({ id, reason: typeof body.reason === 'string' ? body.reason : '', actorId: actor.id });
    return NextResponse.json({ success: true, data: r });
  } catch (error) {
    return exceptionFailure(error, 'leave-exceptions.revoke');
  }
}
