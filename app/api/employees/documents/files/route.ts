import { NextResponse } from "next/server";
import { ensureTenantContext } from "@/lib/db";
import { checkPermissionWithScope } from "@/lib/auth/check-permission";
import { isSameOriginRequest } from "@/lib/security/same-origin";
import { toActionError } from "@/lib/errors/action-error";
import { uploadScan } from "@/lib/services/employee-document.service";
import { DOCUMENT_MAX_BYTES } from "@/lib/types/employee-document";

// Room for the multipart boundaries and the file name around a 3 MB file.
const MAX_BODY = DOCUMENT_MAX_BYTES + 64 * 1024;

/**
 * Upload one document scan (S25) for an employee form that is not saved yet.
 * Checks, in order: same origin, a declared body size within the limit (before
 * anything is read), the permission (Edit for an existing employee, in scope;
 * Add for a new one); the service then checks the content.
 */
export async function POST(request: Request) {
  if (!isSameOriginRequest(request.headers)) {
    return NextResponse.json({ success: false, error: "Refused." }, { status: 403 });
  }
  const length = Number(request.headers.get("content-length"));
  if (!Number.isFinite(length) || length <= 0) {
    return NextResponse.json({ success: false, error: "The upload has no size." }, { status: 411 });
  }
  if (length > MAX_BODY) {
    return NextResponse.json({ success: false, error: "The file is larger than 3 MB. Scan at a lower resolution or save it as JPG." }, { status: 413 });
  }

  await ensureTenantContext();
  try {
    const employeeId = new URL(request.url).searchParams.get("employee") || null;
    const scope = await checkPermissionWithScope(employeeId ? "EDIT" : "ADD", "EMPLOYEES");
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: "Choose a file." }, { status: 400 });
    }
    const ref = await uploadScan(
      { bytes: new Uint8Array(await file.arrayBuffer()), name: file.name, employeeId },
      scope
    );
    return NextResponse.json({ success: true, data: ref });
  } catch (error) {
    const failure = toActionError(error, "employee-document.upload");
    const status = failure.ref ? 500 : /^(Unauthorized|Forbidden):/.test(failure.error) ? 403 : 400;
    return NextResponse.json(failure, { status });
  }
}
