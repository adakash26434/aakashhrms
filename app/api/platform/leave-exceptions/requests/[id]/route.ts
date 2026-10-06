import { NextResponse } from 'next/server';
import { requirePlatformAuth } from '@/lib/platform/auth';
import { rejectExceptionRequest, exceptionFailure } from '@/lib/platform/leave-exceptions';

export const dynamic = 'force-dynamic';

/** Rejects a company's exception request with the reason the company sees. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePlatformAuth(request);
  if (actor instanceof NextResponse) return actor;
  try {
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as { reason?: unknown };
    await rejectExceptionRequest({ requestId: id, reason: typeof body.reason === 'string' ? body.reason : '', actorId: actor.id });
    return NextResponse.json({ success: true });
  } catch (error) {
    return exceptionFailure(error, 'leave-exceptions.reject');
  }
}
