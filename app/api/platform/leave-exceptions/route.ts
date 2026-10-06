import { NextResponse } from 'next/server';
import { requirePlatformAuth } from '@/lib/platform/auth';
import { ExceptionValidationError, exceptionFailure, grantException, platformExceptionsPage, readExceptionInput } from '@/lib/platform/leave-exceptions';

export const dynamic = 'force-dynamic';

// Leave exceptions (4.6d): super admins only. Lists requests and exceptions;
// grants one (from a company's request, or directly), checked by the engine.

export async function GET(request: Request) {
  const actor = await requirePlatformAuth(request);
  if (actor instanceof NextResponse) return actor;
  try {
    return NextResponse.json({ success: true, data: await platformExceptionsPage() });
  } catch (error) {
    return exceptionFailure(error, 'leave-exceptions.list');
  }
}

export async function POST(request: Request) {
  const actor = await requirePlatformAuth(request);
  if (actor instanceof NextResponse) return actor;
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const companyId = typeof body.companyId === 'string' ? body.companyId : '';
    const requestId = typeof body.requestId === 'string' && body.requestId ? body.requestId : null;
    if (!companyId) throw new ExceptionValidationError({ companyId: 'Choose the company' });
    const r = await grantException({ companyId, requestId, input: readExceptionInput(body), actorId: actor.id });
    return NextResponse.json({ success: true, data: r });
  } catch (error) {
    return exceptionFailure(error, 'leave-exceptions.grant');
  }
}
