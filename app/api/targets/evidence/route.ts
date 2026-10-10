import { NextResponse } from 'next/server';
import { ensureTenantContext } from '@/lib/db';
import { getSessionEmployeeId } from '@/lib/services/self-service.service';
import { isSameOriginRequest } from '@/lib/security/same-origin';
import { toActionError } from '@/lib/errors/action-error';
import { uploadEvidence } from '@/lib/services/target.service';
import { DOCUMENT_MAX_BYTES } from '@/lib/types/employee-document';

// Room for the multipart boundaries and the file name around a 3 MB file.
const MAX_BODY = DOCUMENT_MAX_BYTES + 64 * 1024;

/**
 * Stage one evidence file for the signed-in employee's achievement (S42).
 * Checks, in order: same origin, a declared body size within the limit (before
 * anything is read), the signed-in employee (taken from the session); the
 * service then checks the content. The file is attached when the achievement
 * is saved.
 */
export async function POST(request: Request) {
  if (!isSameOriginRequest(request.headers)) {
    return NextResponse.json({ success: false, error: 'Refused.' }, { status: 403 });
  }
  const length = Number(request.headers.get('content-length'));
  if (!Number.isFinite(length) || length <= 0) {
    return NextResponse.json({ success: false, error: 'The upload has no size.' }, { status: 411 });
  }
  if (length > MAX_BODY) {
    return NextResponse.json({ success: false, error: 'The file is larger than 3 MB.' }, { status: 413 });
  }
  await ensureTenantContext();
  try {
    const { employeeId, userId } = await getSessionEmployeeId();
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: 'Choose a file.' }, { status: 400 });
    }
    const ref = await uploadEvidence({ bytes: new Uint8Array(await file.arrayBuffer()), name: file.name }, { employeeId, userId });
    return NextResponse.json({ success: true, data: ref });
  } catch (error) {
    const failure = toActionError(error, 'targets.upload');
    const status = failure.ref ? 500 : /^(Unauthorized|Forbidden):/.test(failure.error) ? 403 : 400;
    return NextResponse.json(failure, { status });
  }
}
